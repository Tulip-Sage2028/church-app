// ════════════════════════════════════════════════════════════════════
//  恩典生命团契 Church App - 推送订阅工具
//  位置: lib/push.ts
//  作用: 封装订阅、取消订阅、检查订阅状态等浏览器 Push API 操作
// ════════════════════════════════════════════════════════════════════

import { supabase } from "./supabase";

// VAPID 公钥 — 公开值,可以放前端
// 对应的私钥在 Supabase Edge Function Secrets (VAPID_PRIVATE_KEY) 里
const VAPID_PUBLIC_KEY = "BPy0D1SiHqNczsAgYNzIriDBEN0wlSpCOonhMicSda3TajHDKEwlSyEtUMYFzMLjyU0nHsKNJ-Bhxq-cKIN7ybI";

// ────────────────────────────────────────────────────────────────────
// 检查浏览器是否支持 Web Push
// ────────────────────────────────────────────────────────────────────
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false; // SSR 环境
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// ────────────────────────────────────────────────────────────────────
// 检查是否是 iOS 设备(iPhone/iPad)
// iOS 推送有特殊限制:必须从主屏幕图标打开 PWA 才能用
// ────────────────────────────────────────────────────────────────────
export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

// ────────────────────────────────────────────────────────────────────
// 检查当前是否运行在 PWA 模式(已添加到主屏幕)
// iOS 用户必须从主屏幕打开才能订阅推送
// ────────────────────────────────────────────────────────────────────
export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

// ────────────────────────────────────────────────────────────────────
// 获取当前的浏览器通知权限状态
// 返回值:"default" | "granted" | "denied"
// ────────────────────────────────────────────────────────────────────
export function getNotificationPermission(): NotificationPermission {
  if (typeof Notification === "undefined") return "default";
  return Notification.permission;
}

// ────────────────────────────────────────────────────────────────────
// 注册 Service Worker
// ────────────────────────────────────────────────────────────────────
async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("浏览器不支持 Service Worker");
  }
  const registration = await navigator.serviceWorker.register("/sw.js");
  // 等待 Service Worker 激活
  if (registration.installing) {
    await new Promise<void>((resolve) => {
      registration.installing!.addEventListener("statechange", function () {
        if (this.state === "activated") resolve();
      });
    });
  }
  return registration;
}

// ────────────────────────────────────────────────────────────────────
// VAPID 公钥从 base64url 转 Uint8Array(浏览器 PushManager 要求)
// ────────────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ────────────────────────────────────────────────────────────────────
// 检查当前用户当前设备是否已订阅
// ────────────────────────────────────────────────────────────────────
export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch (e) {
    console.error("isSubscribed error:", e);
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────
// 订阅推送
// 流程:1) 注册 SW 2) 申请通知权限 3) 浏览器订阅 4) 写入 Supabase
// 返回:订阅成功 true / 失败 false
// ────────────────────────────────────────────────────────────────────
export async function subscribeToPush(): Promise<{ success: boolean; error?: string }> {
  // 1. 检查浏览器支持
  if (!isPushSupported()) {
    return { success: false, error: "您的浏览器不支持推送通知" };
  }

  // 2. iOS 必须先添加到主屏幕
  if (isIOS() && !isStandalonePWA()) {
    return {
      success: false,
      error: "iOS 用户请先把 App 添加到主屏幕,然后从主屏幕图标打开,才能开启推送",
    };
  }

  try {
    // 3. 注册 Service Worker
    const registration = await registerServiceWorker();

    // 4. 申请通知权限(浏览器会弹窗)
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, error: "您拒绝了通知权限。如需开启,请到浏览器设置中允许通知" };
    }

    // 5. 浏览器订阅推送(向 Google/Apple/Mozilla 申请 endpoint)
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // 6. 把订阅信息写入数据库
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    // 取出订阅的关键字段
    const subJSON = subscription.toJSON();
    const endpoint = subscription.endpoint;
    const p256dh = subJSON.keys?.p256dh || "";
    const auth = subJSON.keys?.auth || "";

    // upsert — 如果同一个 endpoint 已存在,更新即可
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.substring(0, 500),
        },
        { onConflict: "endpoint" }
      );

    if (error) {
      console.error("Supabase upsert error:", error);
      return { success: false, error: `保存订阅失败:${error.message}` };
    }

    return { success: true };
  } catch (err: any) {
    console.error("subscribeToPush error:", err);
    return { success: false, error: err?.message || "订阅失败" };
  }
}

// ────────────────────────────────────────────────────────────────────
// 取消订阅
// ────────────────────────────────────────────────────────────────────
export async function unsubscribeFromPush(): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: "浏览器不支持" };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return { success: true }; // 没注册过,直接当成成功

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return { success: true };

    const endpoint = subscription.endpoint;

    // 1. 取消浏览器订阅
    await subscription.unsubscribe();

    // 2. 从数据库删除
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);

    if (error) {
      console.error("Supabase delete error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("unsubscribeFromPush error:", err);
    return { success: false, error: err?.message || "取消订阅失败" };
  }
}
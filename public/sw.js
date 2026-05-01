// ════════════════════════════════════════════════════════════════════
//  恩典生命团契 Church App - Service Worker
//  位置: public/sw.js (会被 Vercel 自动放到根目录 /sw.js)
//  作用: 浏览器后台脚本,负责接收推送、显示通知、处理点击
//  生命周期: 用户首次访问 App 时自动注册,之后即使 App 关闭也保持激活
// ════════════════════════════════════════════════════════════════════

// ── 安装阶段 ────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Service Worker installed");
  // 立刻激活,不等待页面刷新
  self.skipWaiting();
});

// ── 激活阶段 ────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Service Worker activated");
  // 立刻接管页面
  event.waitUntil(clients.claim());
});

// ── 收到推送时 ─────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  console.log("[SW] Push received");

  let data = {
    title: "恩典生命团契",
    body: "您有一条新通知",
    url: "/",
  };

  // 解析推送内容(Edge Function 发来的 JSON)
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      // 如果不是 JSON,当纯文本处理
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/icon.png",        // 推送通知左上角的小图标(教会 logo)
    badge: "/badge.png",      // Android 状态栏小图标(单色)
    data: {
      url: data.url || "/",
      timestamp: Date.now(),
    },
    requireInteraction: false, // 通知是否需要用户主动关闭(false = 几秒后自动消失)
    tag: "church-notification", // 同 tag 的新通知会替换旧通知,避免堆积
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── 用户点击通知时 ─────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked");
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  // 如果 App 已经打开,聚焦那个窗口;否则打开新窗口
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // 找一个已经打开的 App 窗口
      for (const client of windowClients) {
        if ("focus" in client) {
          client.focus();
          // 让前端跳转到目标页(通过 postMessage 通信)
          if ("postMessage" in client) {
            client.postMessage({ type: "navigate", url: targetUrl });
          }
          return;
        }
      }
      // 没有打开的窗口,新开一个
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── 推送订阅过期时(浏览器主动通知) ──────────────────────────
self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[SW] Push subscription changed (expired)");
  // 这里可以重新订阅,但实现复杂,先不处理
  // 用户下次打开 App 时,前端会自动检测并重新订阅
});
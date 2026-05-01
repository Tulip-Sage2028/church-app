// ════════════════════════════════════════════════════════════════════
//  恩典生命团契 - 推送通知 Edge Function
//  位置: supabase/functions/send-push/index.ts
//  权限: leader / pastor / admin
//  功能: 给所有订阅了推送的用户发送通知
//  调用: POST /functions/v1/send-push
//        body: { title: "公告标题", body: "内容预览", url: "/" }
// ════════════════════════════════════════════════════════════════════

import webpush from "https://esm.sh/web-push@3.6.7";
import {
    corsHeaders,
    createAdminClient,
    errorResponse,
    successResponse,
    verifyCallerRole,
} from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  // CORS 预检
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    // ─── 第 1 步:验证调用者权限 ───────────────────────────────
    const { profile: caller } = await verifyCallerRole(req, ["admin", "pastor", "leader"]);

    // ─── 第 2 步:解析请求体 ─────────────────────────────────
    const body = await req.json();
    const { title, body: pushBody, url } = body;

    if (!title || typeof title !== "string") {
      return errorResponse("缺少参数:title");
    }
    if (!pushBody || typeof pushBody !== "string") {
      return errorResponse("缺少参数:body");
    }

    // ─── 第 3 步:配置 web-push 使用 VAPID ─────────────────────
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:GCFofLF@gmail.com";

    if (!vapidPublicKey || !vapidPrivateKey) {
      return errorResponse("VAPID 密钥未配置,请检查 Supabase Secrets", 500);
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // ─── 第 4 步:取所有订阅 ─────────────────────────────────
    const adminClient = createAdminClient();
    const { data: subscriptions, error: fetchError } = await adminClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id");

    if (fetchError) {
      return errorResponse(`查询订阅失败: ${fetchError.message}`, 500);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return successResponse({
        message: "目前没有用户订阅推送",
        sent: 0,
        failed: 0,
      });
    }

    // ─── 第 5 步:循环发推送 ─────────────────────────────────
    const payload = JSON.stringify({
      title: title.substring(0, 80),       // 标题最多 80 字
      body: pushBody.substring(0, 200),    // 内容最多 200 字
      url: url || "/",
    });

    let sent = 0;
    let failed = 0;
    const expiredIds: number[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );
        sent++;
      } catch (err: any) {
        failed++;
        // 410 Gone / 404 = 订阅已失效,从数据库删除
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredIds.push(sub.id);
        }
        console.error(`Push failed for sub ${sub.id}: ${err?.statusCode} ${err?.body || err?.message}`);
      }
    }

    // ─── 第 6 步:清理失效的订阅 ─────────────────────────────
    if (expiredIds.length > 0) {
      await adminClient
        .from("push_subscriptions")
        .delete()
        .in("id", expiredIds);
      console.log(`Cleaned up ${expiredIds.length} expired subscriptions`);
    }

    // ─── 第 7 步:返回结果 ───────────────────────────────────
    console.log(
      `[send-push] ${caller.username} sent push to ${sent} devices, ${failed} failed`
    );

    return successResponse({
      message: `推送完成:成功 ${sent} 个设备${failed > 0 ? `,失败 ${failed} 个(已自动清理失效订阅)` : ""}`,
      sent,
      failed,
      cleaned: expiredIds.length,
    });

  } catch (err) {
    console.error("send-push error:", err);
    const message = err instanceof Error ? err.message : "未知错误";
    return errorResponse(message, 401);
  }
});
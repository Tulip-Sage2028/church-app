// ════════════════════════════════════════════════════════════════════
//  恩典生命团契 — 重置密码 Edge Function
//  位置: supabase/functions/reset-password/index.ts
//  功能: 让 admin/pastor 重置任意用户的密码为 "111111"
//  调用: POST /functions/v1/reset-password  body: { user_id: "..." }
// ════════════════════════════════════════════════════════════════════

import {
    corsHeaders,
    createAdminClient,
    errorResponse,
    successResponse,
    verifyCallerRole,
} from "../_shared/auth.ts";

const TEMP_PASSWORD = "111111";

Deno.serve(async (req: Request) => {
  // CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 只允许 POST
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    // ─── 第 1 步:验证调用者权限 ─────────────────────────────────────
    // 只有 admin 和 pastor 才能重置密码
    const { profile: caller } = await verifyCallerRole(req, ["admin", "pastor"]);

    // ─── 第 2 步:解析请求体 ─────────────────────────────────────────
    const body = await req.json();
    const { user_id: targetUserId } = body;

    if (!targetUserId) {
      return errorResponse("缺少参数:user_id");
    }

    // 不允许重置自己的密码(应该走个人资料页)
    if (targetUserId === caller.user_id) {
      return errorResponse("无法重置自己的密码,请使用「个人资料 → 修改密码」");
    }

    // ─── 第 3 步:用 admin 权限重置密码 ──────────────────────────────
    const adminClient = createAdminClient();

    // 取目标用户信息(用于日志和返回)
    const { data: targetProfile, error: fetchError } = await adminClient
      .from("profiles")
      .select("username, role")
      .eq("user_id", targetUserId)
      .single();

    if (fetchError || !targetProfile) {
      return errorResponse("找不到目标用户");
    }

    // 安全策略:不允许重置同级或更高级的角色
    // admin 可以重置任何人(除了自己,前面已挡)
    // pastor 不能重置 admin 或其他 pastor
    if (caller.role === "pastor") {
      if (targetProfile.role === "admin" || targetProfile.role === "pastor") {
        return errorResponse(`牧师不能重置 ${targetProfile.role} 角色的密码`);
      }
    }

    // 真正的密码重置
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetUserId,
      { password: TEMP_PASSWORD }
    );

    if (updateError) {
      console.error("Password reset failed:", updateError);
      return errorResponse(`重置失败: ${updateError.message}`, 500);
    }

    // ─── 第 4 步:返回成功 ──────────────────────────────────────────
    console.log(
      `[reset-password] ${caller.username} (${caller.role}) reset password for ${targetProfile.username}`
    );

    return successResponse({
      message: `已将 ${targetProfile.username} 的密码重置为 ${TEMP_PASSWORD}`,
      username: targetProfile.username,
      temp_password: TEMP_PASSWORD,
    });

  } catch (err) {
    console.error("reset-password error:", err);
    const message = err instanceof Error ? err.message : "未知错误";
    return errorResponse(message, 401);
  }
});
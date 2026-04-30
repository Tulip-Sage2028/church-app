// ════════════════════════════════════════════════════════════════════
//  恩典生命团契 — Edge Functions 共享权限验证
//  位置: supabase/functions/_shared/auth.ts
//  作用: 验证调用 Edge Function 的人是否真的是登录用户、且有指定角色
//  以后所有 Edge Functions(发短信、发推送、群发邮件等)都会用这个文件
// ════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * 验证调用者身份和权限
 *
 * @param req - HTTP 请求对象,需要包含 Authorization header(用户的 access token)
 * @param allowedRoles - 允许调用此 function 的角色列表,例如 ["admin", "pastor"]
 * @returns { user, profile } 验证通过的用户信息
 * @throws Error 验证失败时抛出错误
 */
export async function verifyCallerRole(
  req: Request,
  allowedRoles: string[]
): Promise<{ user: any; profile: any }> {
  // 从请求头取 token
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("缺少 Authorization 头,请重新登录");
  }

  const token = authHeader.replace("Bearer ", "");

  // 用 anon key 创建一个客户端,用 token 验证用户身份
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // 验证 token 拿到用户
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    throw new Error("身份验证失败,请重新登录");
  }

  // 查这个用户的 profile 看角色
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, username, role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("找不到用户资料");
  }

  // 检查角色是否在允许列表里
  if (!allowedRoles.includes(profile.role)) {
    throw new Error(`权限不足,此操作仅限 ${allowedRoles.join("/")} 角色`);
  }

  return { user, profile };
}

/**
 * 创建一个使用 service_role key 的 admin 客户端
 * 这个客户端可以绕过 RLS、修改任何数据,所以只能在服务器端用,绝不能返回给前端
 */
export function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * 标准化的 CORS 响应头(允许前端从浏览器调用)
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * 标准化的成功响应
 */
export function successResponse(data: any) {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * 标准化的错误响应
 */
export function errorResponse(message: string, status: number = 400) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
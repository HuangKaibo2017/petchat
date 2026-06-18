import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AppError } from "./errors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
)!;

export function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export interface AuthUser {
  id: number; // our t_user.f_id
  supabaseUserId: string; // auth.users.id (UUID)
  isAnonymous: boolean;
}

/**
 * Verify JWT from Authorization header.
 * Returns the authenticated user's DB-level id.
 */
export async function verifyJWT(req: Request): Promise<AuthUser> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED", "请先登录", 401);
  }

  const token = authHeader.slice(7);
  const supabase = getServiceClient();

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new AppError("UNAUTHORIZED", "登录已过期，请重新登录", 401);
  }

  const supabaseUserId = user.id;

  // Map auth.users.id to our t_user.f_id
  const { data: tUser, error: dbErr } = await supabase
    .from("t_user")
    .select("f_id, f_is_anonymous")
    .eq("f_public_id", supabaseUserId)
    .single();

  if (dbErr || !tUser) {
    throw new AppError("UNAUTHORIZED", "用户未注册", 401);
  }

  return {
    id: tUser.f_id as number,
    supabaseUserId,
    isAnonymous: (tUser.f_is_anonymous as boolean) ?? false,
  };
}

/**
 * Exchange WeChat login code for Supabase JWT.
 *
 * Flow:
 *  1. wx.login() → code
 *  2. Call this function: exchange code for Supabase session
 *  3. Return JWT + user info to mini program
 */
export async function exchangeWechatCode(
  wxCode: string,
  userInfo?: { nickName?: string; avatarUrl?: string },
): Promise<{ token: string; user: Record<string, unknown> }> {
  const supabase = getServiceClient();
  const appId = Deno.env.get("WECHAT_APPID")!;
  const appSecret = Deno.env.get("WECHAT_SECRET")!;

  // Step 1: Exchange code for openid + session_key
  const wxRes = await fetch(
    `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${wxCode}&grant_type=authorization_code`,
  );
  const wxData = await wxRes.json();

  if (wxData.errcode) {
    throw new AppError(
      "WECHAT_AUTH_FAILED",
      `微信授权失败: ${wxData.errmsg}`,
      401,
    );
  }

  const openid = wxData.openid;

  // Step 2: Upsert Supabase auth user (use openid as email-like identity)
  const email = `${openid}@wechat.gengdongta.local`;
  const password = wxData.session_key;

  // Try sign-in first, fall back to sign-up
  let authRes = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authRes.error) {
    authRes = await supabase.auth.signUp({ email, password });
    if (authRes.error) {
      throw new AppError(
        "AUTH_FAILED",
        "账号创建失败",
        500,
      );
    }
  }

  const supabaseUserId = authRes.data.user!.id;
  const token = authRes.data.session!.access_token;

  // Step 3: Upsert into our t_user table
  const { data: existing } = await supabase
    .from("t_user")
    .select("f_id")
    .eq("f_public_id", supabaseUserId)
    .single();

  if (!existing) {
    await supabase.from("t_user").insert({
      f_public_id: supabaseUserId,
      f_wechat_openid: openid,
      f_nick_name: userInfo?.nickName ?? "",
      f_avatar_url: userInfo?.avatarUrl ?? "",
      f_is_anonymous: false,
    });
  }

  return { token, user: { openid, supabaseUserId } };
}

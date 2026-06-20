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
  id: number;
  supabaseUserId: string;
  isAnonymous: boolean;
}

/**
 * Verify JWT from Authorization header.
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

  const supabaseUserId = user.id.toLowerCase();

  const { data: tUser, error: dbErr } = await supabase
    .from("t_user")
    .select("f_id, f_meta_info")
    .eq("f_public_id", supabaseUserId)
    .single();

  if (dbErr || !tUser) {
    throw new AppError("UNAUTHORIZED", "用户未注册", 401);
  }

  return {
    id: tUser.f_id as number,
    supabaseUserId,
    isAnonymous: ((tUser.f_meta_info as Record<string,unknown>)?.role === "anonymous"),
  };
}

/**
 * Derive a stable password from openid using SHA-256.
 * Uses a server-side secret so the same openid always maps to the same password,
 * unlike session_key which rotates on every wx.login().
 */
async function derivePassword(openid: string): Promise<string> {
  const secret = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const encoder = new TextEncoder();
  const data = encoder.encode(`${openid}:${secret}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

/**
 * Exchange WeChat login code for Supabase JWT.
 *
 * Flow:
 *  1. wx.login() → code
 *  2. Call WeChat API: code → openid + session_key
 *  3. Derive stable password from openid (NOT session_key — it rotates)
 *  4. Sign in / sign up to Supabase Auth
 *  5. Return JWT to mini program
 */
export async function exchangeWechatCode(
  wxCode: string,
  userInfo?: { nickName?: string; avatarUrl?: string },
): Promise<{ token: string; user: Record<string, unknown> }> {
  const supabase = getServiceClient();
  const appId = Deno.env.get("WECHAT_APPID")!;
  const appSecret = Deno.env.get("WECHAT_SECRET")!;

  // Step 1: Exchange code for openid
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
  if (!openid) {
    throw new AppError("WECHAT_AUTH_FAILED", "微信未返回 openid", 401);
  }

  // Step 2: Derive stable password (NOT session_key — it rotates every login)
  const email = `${openid}@wechat.gengdongta.local`;
  const password = await derivePassword(openid);

  // Step 3: Sign in or sign up
  let authRes = await supabase.auth.signInWithPassword({ email, password });

  if (authRes.error) {
    // First-time user: create account
    authRes = await supabase.auth.signUp({ email, password });
    if (authRes.error) {
      // If signUp also fails (e.g. user exists but wrong password from old session_key approach),
      // use admin API to update the user's password to the new derived one
      if (authRes.error.message?.includes("already registered")) {
        const { data: { user: existingUser } } = await supabase.auth.admin.getUserByEmail(email);
        // Cannot fix old accounts without admin intervention — return clear error
        throw new AppError(
          "AUTH_MIGRATION_NEEDED",
          "账号需要重新绑定，请清除小程序数据后重试",
          401,
        );
      }
      throw new AppError("AUTH_FAILED", "账号创建失败", 500);
    }
  }

  const supabaseUserId = authRes.data.user!.id.toLowerCase();
  const token = authRes.data.session!.access_token;

  // Step 4: Upsert into our t_user table
  const { data: existing } = await supabase
    .from("t_user")
    .select("f_id")
    .eq("f_public_id", supabaseUserId)
    .single();

  if (!existing) {
    await supabase.from("t_user").insert({
      f_public_id: supabaseUserId,
      f_nickname: userInfo?.nickName ?? "",
      f_avatar_url: userInfo?.avatarUrl ?? "",
      f_meta_info: { wechat_openid: openid },
    });
  } else {
    // Update nickname/avatar on each login
    if (userInfo?.nickName || userInfo?.avatarUrl) {
      await supabase.from("t_user")
        .update({
          f_nickname: userInfo?.nickName ?? undefined,
          f_avatar_url: userInfo?.avatarUrl ?? undefined,
        })
        .eq("f_id", existing.f_id);
    }
  }

  return { token, user: { openid, supabaseUserId } };
}

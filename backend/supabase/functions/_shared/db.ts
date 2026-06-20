import { getServiceClient } from "./auth.ts";
import { AppError, ERR } from "./errors.ts";

/**
 * Check and deduct user quota for a given feature.
 * Returns the remaining quota, or throws QUOTA_EXCEEDED.
 */
// NOTE: Quota check and recordUsage are separate calls — a race condition
// could allow slightly exceeding limits under concurrent requests.
// For production, use a DB-level unique constraint or serializable transaction.
export async function checkQuota(
  userId: number,
  featureCode: string,
): Promise<number> {
  const supabase = getServiceClient();

  // Get active feature definition
  const { data: feature } = await supabase
    .from("t_feature_quota")
    .select("f_id, f_quota_limit, f_quota_period, f_quota_unit")
    .eq("f_code", featureCode)
    .eq("f_is_active", true)
    .order("f_ver", { ascending: false })
    .limit(1)
    .single();

  if (!feature) {
    // No quota defined = unlimited
    return -1;
  }

  if (feature.f_quota_limit === -1) return -1; // unlimited

  // Get current usage in this period
  const now = new Date();
  const periodStart = new Date(
    now.getTime() - feature.f_quota_period * 24 * 60 * 60 * 1000,
  );

  const { count } = await supabase
    .from("t_usage_record")
    .select("*", { count: "exact", head: true })
    .eq("f_user_id", userId)
    .eq("f_feature_id", feature.f_id)
    .gte("f_used_at", periodStart.toISOString());

  const used = count ?? 0;
  const remaining = feature.f_quota_limit - used;

  if (remaining < feature.f_quota_unit) {
    throw new AppError(
      ERR.QUOTA_EXCEEDED.code,
      ERR.QUOTA_EXCEEDED.message,
      ERR.QUOTA_EXCEEDED.status,
    );
  }

  return remaining;
}

/**
 * Record a usage event after successful operation.
 */
export async function recordUsage(
  userId: number,
  featureCode: string,
  relatedReportId?: number,
): Promise<void> {
  const supabase = getServiceClient();

  const { data: feature } = await supabase
    .from("t_feature_quota")
    .select("f_id, f_quota_unit")
    .eq("f_code", featureCode)
    .eq("f_is_active", true)
    .order("f_ver", { ascending: false })
    .limit(1)
    .single();

  if (!feature) return;

  await supabase.from("t_usage_record").insert({
    f_user_id: userId,
    f_feature_id: feature.f_id,
    f_quota_used: feature.f_quota_unit,
    f_related_report_id: relatedReportId ?? -1,
    f_used_at: new Date().toISOString(),
  });
}

/**
 * Get prompt by code + language (latest active version).
 */
export async function getPrompt(
  code: string,
  lang: string = "zh-CN",
): Promise<string> {
  const supabase = getServiceClient();

  const { data } = await supabase
    .from("t_prompt")
    .select("f_content")
    .eq("f_code", code)
    .eq("f_lang", lang)
    .eq("f_is_active", true)
    .order("f_ver", { ascending: false })
    .limit(1)
    .single();

  return data?.f_content ?? "";
}

/**
 * Fill prompt template with variables.
 * Supports {{varName}} placeholders.
 */
export function fillPrompt(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

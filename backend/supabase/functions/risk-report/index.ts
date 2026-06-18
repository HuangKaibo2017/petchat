// /functions/risk-report/index.ts
// POST: Human-pet risk assessment via Coze constitution agent

import { corsResponse } from "../_shared/cors.ts";
import { verifyJWT, getServiceClient } from "../_shared/auth.ts";
import { checkQuota, recordUsage } from "../_shared/db.ts";
import { cozeChat, parseAIJson } from "../_shared/ai.ts";
import { AppError, errorResponse, ERR } from "../_shared/errors.ts";

interface RiskRequest {
  petId: number;
  reportId?: number;
  ownerBirthday: string;
  tongueImage?: string;
}

interface RiskReport {
  petImbalance: string;
  qiRisk: string;
  microbiomeRisk: string;
  lifestyleRisk: string;
  jointCarePlan: string;
  medicalAdvice: string;
  riskLevel: "low" | "medium" | "high";
  riskScore: number;
  riskFactors: Array<{ factor: string; level: string }>;
  recommendations: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const user = await verifyJWT(req);
    const remaining = await checkQuota(user.id, "risk_report");

    const body: RiskRequest = await req.json();
    if (!body.petId || !body.ownerBirthday) {
      return errorResponse(ERR.INVALID_PARAMS.code, "请提供宠物ID和主人生日", 400);
    }

    const supabase = getServiceClient();
    const { data: pet } = await supabase
      .from("t_pet")
      .select("f_id, f_name, f_pet_type_id, f_birth_date, f_weight")
      .eq("f_id", body.petId)
      .eq("f_user_id", user.id)
      .single();

    if (!pet) return errorResponse(ERR.NOT_FOUND.code, "宠物不存在", 404);

    // Get health report context if provided
    let healthContext = "";
    if (body.reportId) {
      const { data: hr } = await supabase
        .from("t_report_health")
        .select("f_health_score, f_health_level, f_input_symptoms")
        .eq("f_id", body.reportId)
        .single();
      if (hr) healthContext = JSON.stringify(hr.f_input_symptoms);
    }

    const projectId = Deno.env.get("COZE_CONSTITUTION_PROJECT_ID")!;
    if (!projectId) return errorResponse("CONFIG_ERROR", "Coze 项目未配置", 500);

    let reportJson: RiskReport;
    try {
      const raw = await cozeChat(projectId, String(user.id), {
        petName: pet.f_name,
        petBirthDate: pet.f_birth_date ?? "",
        petWeight: pet.f_weight,
        ownerBirthday: body.ownerBirthday,
        healthContext,
        tongueImage: body.tongueImage ?? "",
      });
      reportJson = parseAIJson<RiskReport>(raw);
    } catch (aiErr) {
      console.error("Coze error:", aiErr);
      return errorResponse(ERR.AI_FAILED.code, ERR.AI_FAILED.message, 503);
    }

    const riskLevelMap: Record<string, number> = { low: 1, medium: 2, high: 3 };

    const { data: savedReport } = await supabase
      .from("t_report_human_pet_risk")
      .insert({
        f_user_id: user.id,
        f_pet_id: body.petId,
        f_lang: "zh-CN",
        f_report_type_id: 3,
        f_owner_info: { birthDate: body.ownerBirthday },
        f_risk_level_id: riskLevelMap[reportJson.riskLevel] ?? 2,
        f_risk_score: reportJson.riskScore,
        f_risk_factors: reportJson.riskFactors,
        f_risk_recommendations: reportJson.recommendations,
        f_meta_info: {
          petImbalance: reportJson.petImbalance,
          qiRisk: reportJson.qiRisk,
          microbiomeRisk: reportJson.microbiomeRisk,
          lifestyleRisk: reportJson.lifestyleRisk,
          jointCarePlan: reportJson.jointCarePlan,
          medicalAdvice: reportJson.medicalAdvice,
        },
      })
      .select("f_id")
      .single();

    await recordUsage(user.id, "risk_report", savedReport?.f_id);

    return corsResponse({
      reportId: savedReport?.f_id,
      petName: pet.f_name,
      time: new Date().toLocaleString("zh-CN"),
      riskLevel: {
        level: reportJson.riskLevel,
        label:
          reportJson.riskLevel === "high" ? "高风险"
          : reportJson.riskLevel === "medium" ? "中等风险"
          : "低风险",
      },
      ...reportJson,
      remaining,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.status);
    }
    console.error("risk-report error:", err);
    return errorResponse("INTERNAL", "报告生成失败", 500);
  }
});

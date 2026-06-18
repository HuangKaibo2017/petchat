// /functions/health-report/index.ts
// POST: Generate pet health assessment via Coze agent

import { corsResponse } from "../_shared/cors.ts";
import { verifyJWT, getServiceClient } from "../_shared/auth.ts";
import { checkQuota, recordUsage } from "../_shared/db.ts";
import { cozeChat, parseAIJson } from "../_shared/ai.ts";
import { AppError, errorResponse, ERR } from "../_shared/errors.ts";

interface HealthRequest {
  petId: number;
  symptom: string;
  duration: string;
  abnormal?: string;
  numbers?: string[];
  imageUrl?: string;
}

interface HealthReport {
  currentSymptoms: string;
  symptomMapping: Array<{ area: string; symptoms: string }>;
  potentialDeficiencies: string;
  deficiencyDetails: Array<{ type: string; manifestations: string }>;
  emergency: string;
  futureRisk: string;
  healthScore: string;
  carePlan: Array<{ title: string; desc: string }>;
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
    const remaining = await checkQuota(user.id, "health_report");

    const body: HealthRequest = await req.json();
    if (!body.petId || !body.symptom || !body.duration) {
      return errorResponse(ERR.INVALID_PARAMS.code, "请提供宠物ID、症状和持续时间", 400);
    }

    const supabase = getServiceClient();
    const { data: pet } = await supabase
      .from("t_pet")
      .select("f_id, f_name, f_pet_type_id, f_gender_id, f_birth_date, f_weight, f_sterilized, f_vaccinated")
      .eq("f_id", body.petId)
      .eq("f_user_id", user.id)
      .single();

    if (!pet) return errorResponse(ERR.NOT_FOUND.code, "宠物不存在", 404);

    const projectId = Deno.env.get("COZE_HEALTH_CHECK_PROJECT_ID")!;
    if (!projectId) return errorResponse("CONFIG_ERROR", "Coze 项目未配置", 500);

    let reportJson: HealthReport;
    try {
      const raw = await cozeChat(projectId, String(user.id), {
        petName: pet.f_name,
        petWeight: pet.f_weight,
        petSterilized: pet.f_sterilized,
        petVaccinated: pet.f_vaccinated,
        symptom: body.symptom,
        duration: body.duration,
        abnormal: body.abnormal ?? "",
        numbers: (body.numbers ?? []).join(","),
        imageUrl: body.imageUrl ?? "",
      });
      reportJson = parseAIJson<HealthReport>(raw);
    } catch (aiErr) {
      console.error("Coze error:", aiErr);
      return errorResponse(ERR.AI_FAILED.code, ERR.AI_FAILED.message, 503);
    }

    const healthStars = (reportJson.healthScore?.match(/★/g) ?? []).length;
    let healthLevel: string;
    if (healthStars >= 4) healthLevel = "健康良好";
    else if (healthStars >= 3) healthLevel = "亚健康";
    else if (healthStars >= 2) healthLevel = "需要关注";
    else healthLevel = "建议就医";

    const { data: savedReport } = await supabase
      .from("t_report_health")
      .insert({
        f_user_id: user.id,
        f_pet_id: body.petId,
        f_lang: "zh-CN",
        f_report_type_id: 2,
        f_health_score: healthStars,
        f_health_level: healthLevel,
        f_check_mode: "symptom_input",
        f_input_symptoms: {
          symptom: body.symptom,
          duration: body.duration,
          abnormal: body.abnormal ?? "",
          numbers: body.numbers ?? [],
          imageUrl: body.imageUrl ?? "",
        },
        f_meta_info: {
          symptomMapping: reportJson.symptomMapping,
          potentialDeficiencies: reportJson.potentialDeficiencies,
          deficiencyDetails: reportJson.deficiencyDetails,
          emergency: reportJson.emergency,
          futureRisk: reportJson.futureRisk,
          carePlan: reportJson.carePlan,
        },
      })
      .select("f_id")
      .single();

    await recordUsage(user.id, "health_report", savedReport?.f_id);

    return corsResponse({
      reportId: savedReport?.f_id,
      petName: pet.f_name,
      time: new Date().toLocaleString("zh-CN"),
      ...reportJson,
      remaining,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.status);
    }
    console.error("health-report error:", err);
    return errorResponse("INTERNAL", "报告生成失败", 500);
  }
});

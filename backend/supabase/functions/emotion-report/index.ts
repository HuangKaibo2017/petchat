// /functions/emotion-report/index.ts
// POST: Generate pet emotion interpretation via Coze agent

import { okResponse, failResponse } from "../_shared/cors.ts";
import { verifyJWT, getServiceClient } from "../_shared/auth.ts";
import { checkQuota, recordUsage } from "../_shared/db.ts";
import { cozeChat, checkRateLimit, parseAIJson } from "../_shared/ai.ts";
import { AppError, errorResponse, ERR } from "../_shared/errors.ts";

interface EmotionRequest {
  petId: number;
  question: string;
  divSystem: "liuyao" | "meihua" | "daliuren" | "tarot";
  numbers?: string[];
  imageUrl?: string;
  reportType: "emotion" | "personality";
}

interface EmotionReport {
  coreAnswer: string;
  coreBasis: string;
  foodSatisfaction: string;
  moodLevel: string;
  bodyStatus: string;
  statusSummary: string;
  ownerView: string;
  petMessage: string;
  petWish: string;
  carePlan: Array<{ title: string; desc: string }>;
  products: Array<{ name: string; reason: string }>;
}

const DIV_SYSTEM_NAMES: Record<string, string> = {
  liuyao: "六爻起卦",
  meihua: "梅花易数",
  daliuren: "大六壬",
  tarot: "塔罗",
};

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
    if (!checkRateLimit('emotion-report:'+user.id, 10, 60000)) {
      return errorResponse("RATE_LIMITED", "请求太频繁，请稍后再试", 429);
    }
    const remaining = await checkQuota(user.id, "emotion_report");

    const body: EmotionRequest = await req.json();

    if (!body.petId || !body.question || !body.divSystem) {
      return errorResponse(ERR.INVALID_PARAMS.code, "请提供宠物ID、问题和占卜方式", 400);
    }

    const supabase = getServiceClient();
    const { data: pet } = await supabase
      .from("t_pet")
      .select("f_id, f_name, f_pet_type_id, f_gender_id, f_birth_date, f_weight")
      .eq("f_id", body.petId)
      .eq("f_user_id", user.id)
      .single();

    if (!pet) return errorResponse(ERR.NOT_FOUND.code, "宠物不存在", 404);

    const { data: petType } = await supabase
      .from("t_pet_type")
      .select("f_name")
      .eq("f_id", pet.f_pet_type_id)
      .single();

    const petTypeName = petType?.f_name?.["zh-CN"] ?? "未知";
    const divName = DIV_SYSTEM_NAMES[body.divSystem] || body.divSystem;
    const numbersStr = body.numbers?.join(",") ?? "";

    // Determine Coze project
    const projectId = body.reportType === "personality"
      ? Deno.env.get("COZE_PERSONALITY_PROJECT_ID")!
      : Deno.env.get("COZE_MOOD_PROJECT_ID")!;

    if (!projectId) {
      return errorResponse("CONFIG_ERROR", "Coze 项目未配置", 500);
    }

    // Call Coze agent
    let reportJson: EmotionReport;
    try {
      const raw = await cozeChat(projectId, String(user.id), {
        petName: pet.f_name,
        petType: petTypeName,
        petGender: pet.f_gender_id,
        petBirthDate: pet.f_birth_date,
        petWeight: pet.f_weight,
        question: body.question,
        divSystem: divName,
        divNumbers: numbersStr,
        imageUrl: body.imageUrl ?? "",
        reportType: body.reportType,
      });
      reportJson = parseAIJson<EmotionReport>(raw);
    } catch (aiErr) {
      console.error("Coze error:", aiErr);
      return errorResponse(ERR.AI_FAILED.code, ERR.AI_FAILED.message, 503);
    }

    // Map emotion state
    const moodStars = (reportJson.moodLevel?.match(/★/g) ?? []).length;
    let emotionState: string;
    if (moodStars >= 4) emotionState = "开心愉悦";
    else if (moodStars >= 3) emotionState = "平静放松";
    else if (moodStars >= 2) emotionState = "低落不安";
    else emotionState = "焦虑紧张";

    const tags = [reportJson.foodSatisfaction, reportJson.moodLevel, reportJson.bodyStatus].filter(Boolean);

    // Enrich products from DB
    let enrichedProducts: Array<{ id: number; name: string; price: string; reason: string }> = [];
    if (reportJson.products?.length > 0) {
      const { data: dbProducts } = await supabase
        .from("t_product_spu")
        .select("f_id, f_name, f_price")
        .in("f_name", reportJson.products.map((p) => p.name))
        .limit(10);

      enrichedProducts = reportJson.products.map((p) => {
        const match = (dbProducts ?? []).find((dp) => dp.f_name === p.name);
        return {
          id: match?.f_id ?? 0,
          name: p.name,
          price: match?.f_price?.toString() ?? "",
          reason: p.reason,
        };
      });
    }

    // Save to DB
    const { data: savedReport } = await supabase
      .from("t_report_emotion")
      .insert({
        f_user_id: user.id,
        f_pet_id: body.petId,
        f_lang: "zh-CN",
        f_report_type_id: body.reportType === "personality" ? 4 : 1,
        f_emotion_score: Math.min(moodStars * 20, 100),
        f_emotion_state: emotionState,
        f_emotion_tags: tags,
        f_emotion_trend: "",
        f_input_symptoms: {
          question: body.question,
          divSystem: body.divSystem,
          numbers: body.numbers ?? [],
          imageUrl: body.imageUrl ?? "",
        },
        f_meta_info: {
          coreAnswer: reportJson.coreAnswer,
          coreBasis: reportJson.coreBasis,
          foodSatisfaction: reportJson.foodSatisfaction,
          ownerView: reportJson.ownerView,
          petMessage: reportJson.petMessage,
          petWish: reportJson.petWish,
          carePlan: reportJson.carePlan,
        },
      })
      .select("f_id")
      .single();

    await recordUsage(user.id, "emotion_report", savedReport?.f_id);

    return okResponse({
      reportId: savedReport?.f_id,
      petName: pet.f_name,
      time: new Date().toLocaleString("zh-CN"),
      divSystem: body.divSystem,
      question: body.question,
      ...reportJson,
      products: enrichedProducts.length > 0 ? enrichedProducts : reportJson.products,
      remaining,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.status);
    }
    console.error("emotion-report error:", err);
    return errorResponse("INTERNAL", "报告生成失败", 500);
  }
});

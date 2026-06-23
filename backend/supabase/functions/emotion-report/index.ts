// /functions/emotion-report/index.ts
// POST: Generate pet emotion interpretation via DeepSeek LLM

import { okResponse, failResponse } from "../_shared/cors.ts";
import { verifyJWT, getServiceClient } from "../_shared/auth.ts";
import { checkQuota, recordUsage } from "../_shared/db.ts";
import { aiChat, checkRateLimit, parseAIJson, type AIMessage } from "../_shared/ai.ts";
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

const EMOTION_SYSTEM_PROMPT = `你是「更懂它」宠物心灵共鸣解读助手。根据主人提供的信息，生成一份宠物心声解读报告。

【核心原则】
1. 从宠物视角出发，用温暖治愈的语气
2. 将占卜结果转化为通俗的情绪、行为、身体分析
3. 使用"身心节律、能量状态、体感不适"等中性词汇，避免"吉凶祸福"等玄学用语
4. 全宠物类型通用（犬、猫、异宠）
5. 提供具体可操作的居家调理建议

【输出要求】
严格输出一个 JSON 对象，不要包含任何 markdown 标记或额外文字。
JSON 字段和长度要求如下：

{
  "coreAnswer": "核心回答，直接回答主人问题，60-100字",
  "coreBasis": "解读依据，结合占卜体系简要说明推理逻辑，40-80字",
  "foodSatisfaction": "★★★☆☆ 到 ★★★★★ 之间",
  "moodLevel": "★★☆☆☆ 到 ★★★★★ 之间",
  "bodyStatus": "身体状态关键词，如：无不适 / 轻微疲劳 / 需关注，10-20字",
  "statusSummary": "今日整体状态一句话总结，20-40字",
  "ownerView": "以宠物第一人称视角描述它眼中的主人状态，60-100字，温暖共情风格",
  "petMessage": "宠物想对主人说的心里话，60-100字，治愈风格",
  "petWish": "宠物的一个小愿望或请求，20-40字",
  "carePlan": [
    {"title": "方案标题1", "desc": "具体建议，40-60字"},
    {"title": "方案标题2", "desc": "具体建议，40-60字"},
    {"title": "方案标题3", "desc": "具体建议，40-60字"}
  ],
  "products": [
    {"name": "商品名", "reason": "推荐理由"}
  ]
}`;

const PERSONALITY_SYSTEM_PROMPT = `你是宠物行为与性格分析师，根据主人提供的信息，为宠物做性格和行为习惯解读。

分析维度：
1. 性格类型：外向/内向、大胆/谨慎、独立/粘人
2. 社交倾向：对人、对其他动物
3. 行为习惯：喜好、厌恶、特殊习惯
4. 训练建议：基于性格的训练方法
5. 环境适配：适合什么样的生活环境

【输出要求】
严格输出一个 JSON 对象，不要包含任何 markdown 标记或额外文字。
JSON 字段和长度要求如下：

{
  "coreAnswer": "核心性格分析，80-120字",
  "coreBasis": "分析依据，40-60字",
  "foodSatisfaction": "★★★☆☆",
  "moodLevel": "★★★☆☆",
  "bodyStatus": "性格特征总结，15-25字",
  "statusSummary": "一句话总结，20-30字",
  "ownerView": "以宠物第一人称描述它对自己的看法，60-100字",
  "petMessage": "宠物想对主人说的话，60-100字",
  "petWish": "宠物的一个小愿望，20-40字",
  "carePlan": [
    {"title": "互动方式", "desc": "具体建议"},
    {"title": "训练重点", "desc": "具体建议"},
    {"title": "环境优化", "desc": "具体建议"}
  ],
  "products": [
    {"name": "商品名", "reason": "推荐理由"}
  ]
}`;

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

    const systemPrompt = body.reportType === "personality"
      ? PERSONALITY_SYSTEM_PROMPT
      : EMOTION_SYSTEM_PROMPT;

    const contextParts = [
      `宠物：${pet.f_name}（${petTypeName}）`,
      `性别：${pet.f_gender_id === 1 ? "公" : "母"}`,
      `生日：${pet.f_birth_date ?? "未知"}`,
      `体重：${pet.f_weight ?? "未知"}kg`,
      `主人提问：${body.question}`,
      `占卜体系：${divName}`,
    ];
    if (numbersStr) contextParts.push(`起卦数字：${numbersStr}`);
    if (body.imageUrl) contextParts.push(`参考图片：${body.imageUrl}`);
    contextParts.push(`报告类型：${body.reportType === "personality" ? "性格分析" : "情绪解读"}`);

    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: contextParts.join("\n") },
    ];

    let reportJson: EmotionReport;
    try {
      const raw = await aiChat(messages, {
        temperature: 0.7,
        maxTokens: 3072,
        responseFormat: "json",
      });
      reportJson = parseAIJson<EmotionReport>(raw);
    } catch (aiErr) {
      console.error("LLM error:", aiErr);
      return errorResponse(ERR.AI_FAILED.code, ERR.AI_FAILED.message, 503);
    }

    const moodStars = (reportJson.moodLevel?.match(/★/g) ?? []).length;
    let emotionState: string;
    if (moodStars >= 4) emotionState = "开心愉悦";
    else if (moodStars >= 3) emotionState = "平静放松";
    else if (moodStars >= 2) emotionState = "低落不安";
    else emotionState = "焦虑紧张";

    const tags = [reportJson.foodSatisfaction, reportJson.moodLevel, reportJson.bodyStatus].filter(Boolean);

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

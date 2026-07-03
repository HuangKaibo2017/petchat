/**
 * Pet Emotion Analysis — 宠物情绪梅花易数分析模块
 *
 * ## 概述
 *
 * 本模块是对宠物梅花易数算法的干净封装层。背后调用混淆后的算法引擎
 * `pet_emotion_algorithm.js`，对外仅暴露一个一站式分析接口 {@link analyzePetEmotion}。
 *
 * 算法以《梅花易数·体用总诀》为核心，采用**三源模型**并行起卦：
 * - **天时卦**：由起卦时刻的农历时间起卦，反映天时大势。
 * - **心念卦**：由宠物共情三数值（牵挂值/感知值/直觉值）起卦，反映主人心念。
 * - **事理卦**：由输入的问题文本起卦，反映事理逻辑。
 *
 * 三卦结果按优先级（天时 ×3 > 事理 ×2 > 心念 ×1）与 27 种组合策略综合判定，
 * 输出统一的吉凶结论与宠物场景化建议。
 *
 * ---
 *
 * ## 输入参数
 *
 * ### PetEmotionInput
 *
 * ```ts
 * interface PetEmotionInput {
 *   // —— 必填 ——
 *   careValue: number          // 牵挂值 N1，范围建议 [1, 9999]
 *   perceptValue: number       // 感知值 N2，范围建议 [1, 9999]
 *   intuitionValue: number     // 直觉值 N3，范围建议 [1, 9999]
 *   questionText: string       // 主人提问文本，如 "我家猫最近不爱吃饭怎么办"
 *   timezoneOffset: number     // 时区偏移（分钟），如 UTC+8 = 480
 *
 *   // —— 可选 ——
 *   scenario?: PetScenario    // 宠物场景，默认 'decision'
 *                              //   'health'       — 健康
 *                              //   'lost'         — 寻回
 *                              //   'behavior'     — 行为
 *                              //   'relationship' — 关系
 *                              //   'decision'     — 决策/综合（心声解读推荐此场景）
 *   timestamp?: Date          // 起卦时刻，默认当前时间（Date 不携带时区，时区由 timezoneOffset 指定）
 * }
 * ```
 *
 * ---
 *
 * ## 输出结果
 *
 * ### PetEmotionOutput
 *
 * ```ts
 * interface PetEmotionOutput {
 *   finalVerdict: 'ji' | 'ping' | 'xiong'       // 最终吉凶
 *   finalVerdictLabel: string                     // 中文标签
 *   confidenceLevel: 'high' | 'medium' | 'low'   // 置信度等级
 *
 *   summary: string                               // 一句话总评
 *   petPerspective: string                        // 宠物视角解读
 *   ownerPerspective: string                      // 主人视角解读
 *   actionSuggestions: string[]                   // 行动建议
 *   riskPoints: string[]                          // 风险提示
 *   yingqi: string                                // 应期描述
 *
 *   castingTime: Date                             // 起卦时刻
 *   algorithmVersion: string                      // 算法版本号
 * }
 * ```
 *
 * ---
 *
 * ## 调用示例
 *
 * ```ts
 * import { analyzePetEmotion, PetScenario } from './pet_emotion_analysis'
 *
 * const result = await analyzePetEmotion({
 *   careValue: 73,
 *   perceptValue: 28,
 *   intuitionValue: 57,
 *   questionText: '我家猫咪最近食欲不好怎么办',
 *   timezoneOffset: 480,                         // UTC+8
 *   scenario: PetScenario.DECISION,
 * })
 *
 * console.log(result.finalVerdictLabel)           // "有利"
 * console.log(result.summary)
 * console.log(result.actionSuggestions)
 * ```
 *
 * ---
 *
 * ## 错误处理
 *
 * - `INVALID_TIMEZONE_OFFSET` — `timezoneOffset` 缺失或不在 [-720, 720] 范围内
 * - `UNKNOWN_CASTING_METHOD` — 起卦方式未注册（内部错误，不应出现）
 * - `INVALID_MOVING_YAO` — 动爻位置越界（内部错误，不应出现）
 * - 其他 — 调用方应 wrap try-catch 并记录日志
 *
 * ---
 * @module pet_emotion_analysis
 * @version 0.1.0
 */

import algorithm = require('./pet_emotion_algorithm')

// ============================================================================
// Public types (对外唯一暴露的类型)
// ============================================================================

/**
 * 宠物场景
 *
 * - `health` — 健康：关注宠物身体状况，偏重体衰/月令不利等信号
 * - `lost` — 寻回：关注失物方向、应期，偏重体用关系与变卦趋势
 * - `behavior` — 行为：关注宠物行为异常原因，偏重错卦/综卦换位分析
 * - `relationship` — 关系：关注主人与宠物互动，偏重体用比和生克
 * - `decision` — 决策/综合：通用场景，心声解读推荐使用此场景
 */
export enum PetScenario {
  HEALTH = 'health',
  LOST = 'lost',
  BEHAVIOR = 'behavior',
  RELATIONSHIP = 'relationship',
  DECISION = 'decision',
}

/** 宠物情绪分析输入 */
export interface PetEmotionInput {
  /** 牵挂值 N1，代表主人对宠物的牵挂程度 */
  careValue: number
  /** 感知值 N2，代表主人对宠物状态的感知敏锐度 */
  perceptValue: number
  /** 直觉值 N3，代表主人对事件的直觉判断 */
  intuitionValue: number
  /** 主人提问文本 */
  questionText: string
  /**
   * 时区偏移（分钟）。**必填**，因为 JavaScript Date 不携带时区信息。
   * 例：UTC+8（北京时间）= 480，UTC-5（纽约）= -300。
   * 有效范围 [-720, 720]。
   */
  timezoneOffset: number
  /** 宠物场景，默认 {@link PetScenario.DECISION} */
  scenario?: PetScenario
  /** 起卦时刻，默认当前时间。Date 不携带时区，时区由 timezoneOffset 单独指定。 */
  timestamp?: Date
}

/** 宠物情绪分析输出 */
export interface PetEmotionOutput {
  /** 最终吉凶 */
  finalVerdict: 'ji' | 'ping' | 'xiong'
  /** 中文标签 */
  finalVerdictLabel: string
  /** 置信度等级 */
  confidenceLevel: 'high' | 'medium' | 'low'

  /** 一句话总评 */
  summary: string
  /** 宠物视角解读 */
  petPerspective: string
  /** 主人视角解读 */
  ownerPerspective: string
  /** 行动建议列表 */
  actionSuggestions: string[]
  /** 风险提示列表 */
  riskPoints: string[]
  /** 应期描述 */
  yingqi: string

  /**
   * 体用月令旺衰信息。
   * - `body`：体卦旺衰等级（旺/相/休/囚/死），反映卦象主体在当时月份的强弱。
   * - `use`：用卦旺衰等级，反映外在因素在当时月份的强弱。
   */
  monthlyStrength: {
    body: string
    use: string
  }

  /** 起卦时刻 */
  castingTime: Date
  /** 算法版本号 */
  algorithmVersion: string
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * 将算法内部输出转为对外精简结构。
 *
 * 职责：从算法引擎的原始输出中提取对外可展示的字段，
 * 屏蔽内部类型名（Trigram、Hexagram、MeihuaOutput 等敏感词）。
 */
function toExternalOutput(
  sources: {
    time: algorithm.MeihuaOutput
    mind: algorithm.MeihuaOutput
    matter: algorithm.MeihuaOutput
  },
  multi: algorithm.MultiSourceInterpretation,
  timeInterp: algorithm.SingleInterpretation,
): PetEmotionOutput {
  return {
    finalVerdict: multi.finalVerdict,
    finalVerdictLabel: multi.finalVerdictLabel,
    confidenceLevel: multi.confidenceLevel,
    summary: multi.integratedSuggestions?.[0] ?? '',
    petPerspective: timeInterp.petPerspective,
    ownerPerspective: timeInterp.ownerPerspective,
    actionSuggestions: multi.integratedSuggestions ?? [],
    riskPoints: [
      ...(timeInterp.riskPoints ?? []),
    ],
    yingqi: timeInterp.yingqi ?? '',
    monthlyStrength: {
      body: timeInterp.monthlyStrength.body,
      use: timeInterp.monthlyStrength.use,
    },
    castingTime: sources.time.castingTime,
    algorithmVersion: '0.1.0',
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 宠物情绪梅花易数分析（一站式入口）
 *
 * 自动执行三源并行起卦 → 单源断卦 ×3 → 三源综合断卦，返回结构化结果。
 *
 * @param input - 用户输入，`timezoneOffset` 为必填
 * @returns 分析结果
 * @throws {Error} 当 `timezoneOffset` 缺失或超出范围时抛出 `INVALID_TIMEZONE_OFFSET`
 *
 * @example
 * const result = await analyzePetEmotion({
 *   careValue: 73,
 *   perceptValue: 28,
 *   intuitionValue: 57,
 *   questionText: '我家猫咪最近食欲不好怎么办',
 *   timezoneOffset: 480,  // 必填
 *   scenario: PetScenario.DECISION,
 * })
 */
export async function analyzePetEmotion(input: PetEmotionInput): Promise<PetEmotionOutput> {
  if (
    input.timezoneOffset === undefined ||
    input.timezoneOffset === null ||
    input.timezoneOffset < -720 ||
    input.timezoneOffset > 720
  ) {
    throw new Error(
      `INVALID_TIMEZONE_OFFSET: timezoneOffset 为必填参数，` +
        `有效范围 [-720, 720]，当前值: ${input.timezoneOffset}`,
    )
  }

  const scenario = input.scenario ?? PetScenario.DECISION

  const context: algorithm.CastingContext = {
    currentDateTime: input.timestamp ?? new Date(),
    timezoneOffset: input.timezoneOffset,
    divinationText: input.questionText,
    textSplitMode: 'auto',
    mindUpperNumber: input.careValue,
    mindLowerNumber: input.perceptValue,
    mindMovingNumber: input.intuitionValue,
  }

  const engine = new algorithm.core.MeihuaEngine({
    registry: new algorithm.casting.CasterRegistry(),
    guaBuilder: new algorithm.core.GuaBuilder({}),
    tiyongAnalyzer: new algorithm.core.TiyongAnalyzer({}),
  })
  const sources = await engine.castTriSource(context)

  const interpreter = new algorithm.interpretation.GuaInterpreter()
  const timeInterp = interpreter.interpret(sources.time, scenario)
  const mindInterp = interpreter.interpret(sources.mind, scenario)
  const matterInterp = interpreter.interpret(sources.matter, scenario)

  const synthesizer = new algorithm.interpretation.MultiSourceSynthesizer()
  const multi = synthesizer.synthesize(timeInterp, mindInterp, matterInterp)

  return toExternalOutput(sources, multi, timeInterp)
}

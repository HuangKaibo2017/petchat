/**
 * Pet Emotion Analysis — 宠物心声解读分析模块
 *
 * ## 概述
 *
 * 本模块是对宠物情绪分析算法的封装层，对外仅暴露一个一站式分析接口
 * {@link analyzePetEmotion}。
 *
 * 算法采用三源模型并行分析：
 * - 时间源：由当前时刻的时间和时区信息计算，反映时间维度趋势。
 * - 共情源：由宠物共情三数值（牵挂值/感知值/直觉值）计算，反映主人与宠物的情感连接。
 * - 问题源：由输入的问题文本计算，反映问题本身的逻辑特征。
 *
 * 输出统一的倾向结论与宠物场景化建议。
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
 *
 *   // —— 可选 ——
 *   scenario?: PetScenario    // 宠物场景，默认 'decision'
 *                              //   'health'       — 健康
 *                              //   'lost'         — 寻回
 *                              //   'behavior'     — 行为
 *                              //   'relationship' — 关系
 *                              //   'decision'     — 决策/综合（心声解读推荐此场景）
 *   timestamp?: Date          // 分析时刻，默认当前时间（Date 不携带时区信息）
 *   timezoneOffset?: number   // 时区偏移（分钟），如 UTC+8 = 480。
 *                              // 默认自动获取当前运行环境的时区偏移。
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
 *   finalVerdict: 1 | 0 | -1                    // 最终倾向：1 有利，0 平稳，-1 不利
 *   confidenceLevel: 'high' | 'medium' | 'low'   // 置信度等级
 *
 *   summary: string                               // 一句话总评
 *   petPerspective: string                        // 宠物视角解读
 *   ownerPerspective: string                      // 主人视角解读
 *   actionSuggestions: string[]                   // 行动建议
 *   riskPoints: string[]                          // 风险提示
 *   timing: string                                // 时机描述
 *   subjectStrength: number                       // 主体强度
 *   objectStrength: number                        // 客体强度
 *
 *   castingTime: Date                             // 分析时刻
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
 * console.log(result.finalVerdict)                // 1
 * console.log(result.summary)
 * console.log(result.actionSuggestions)
 * ```
 *
 * ---
 *
 * ## 错误处理
 *
 * - INVALID_TIMEZONE_OFFSET — timezoneOffset 不在 [-720, 720] 范围内
 * - UNKNOWN_CASTING_METHOD — 计算方式未注册（内部错误，不应出现）
 * - INVALID_MOVING_YAO — 动爻位置越界（内部错误，不应出现）
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
 * - `health` — 健康：关注宠物身体状况
 * - `lost` — 寻回：关注失物方向与找回概率
 * - `behavior` — 行为：关注宠物行为异常原因
 * - `relationship` — 关系：关注主人与宠物互动
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
  /** 宠物场景，默认 {@link PetScenario.DECISION} */
  scenario?: PetScenario
  /** 分析时刻，默认当前时间。Date 不携带时区信息。 */
  timestamp?: Date
  /**
   * 时区偏移（分钟）。
   * 例：UTC+8（北京时间）= 480，UTC-5（纽约）= -300。
   * 有效范围 [-720, 720]。
   * 默认自动获取当前运行环境的时区偏移。
   */
  timezoneOffset?: number
}

/** 宠物情绪分析输出 */
export interface PetEmotionOutput {
  /** 最终倾向：1 有利，0 平稳，-1 不利 */
  finalVerdict: 1 | 0 | -1
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
  // 时机描述
  timing: string

  // 主体强度
  subjectStrength: number
  // 客体强度
  objectStrength: number

  /** 分析时刻 */
  castingTime: Date
  /** 算法版本号 */
  algorithmVersion: string
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * 获取当前运行环境的时区偏移（分钟）。
 * 正值表示东时区（如 UTC+8 返回 480），负值表示西时区。
 */
function getLocalTimezoneOffset(): number {
  return -new Date().getTimezoneOffset()
}

/**
 * 归一化内部 verdict 为数值输出。
 *
 * 内部值可能是字符串或数字，统一转换为 1 / 0 / -1。
 */
function normalizeVerdict(value: unknown): 1 | 0 | -1 {
  if (typeof value === 'number') {
    return value as 1 | 0 | -1
  }
  return 0
}

/**
 * 将算法内部输出转为对外精简结构。
 *
 * 职责：从算法引擎的原始输出中提取对外可展示的字段，
 * 屏蔽内部类型名等内部术语。
 */
function toExternalOutput(
  sources: {
    time: algorithm.PEmotionOutput
    mind: algorithm.PEmotionOutput
    matter: algorithm.PEmotionOutput
  },
  multi: algorithm.MultiSourceInterpretation,
  timeInterp: algorithm.SingleInterpretation,
): PetEmotionOutput {
  const monthly = timeInterp.seasonalStrength as { body: number; use: number } | undefined
  const subjectStrength = monthly?.body ?? 0
  const objectStrength = monthly?.use ?? 0

  return {
    finalVerdict: normalizeVerdict(multi.finalVerdict),
    confidenceLevel: multi.confidenceLevel,
    summary: multi.integratedSuggestions?.[0] ?? '',
    petPerspective: timeInterp.petPerspective,
    ownerPerspective: timeInterp.ownerPerspective,
    actionSuggestions: multi.integratedSuggestions ?? [],
    riskPoints: [
      ...(timeInterp.riskPoints ?? []),
    ],
    timing: timeInterp.timing ?? '',
    subjectStrength,
    objectStrength,
    castingTime: sources.time.castingTime,
    algorithmVersion: '0.1.0',
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 宠物心声解读分析（一站式入口）
 *
 * 自动执行三源并行计算 → 单源分析 ×3 → 三源综合分析，返回结构化结果。
 *
 * @param input - 用户输入
 * @returns 分析结果
 * @throws {Error} 当 `timezoneOffset` 超出范围时抛出 `INVALID_TIMEZONE_OFFSET`
 *
 * @example
 * const result = await analyzePetEmotion({
 *   careValue: 73,
 *   perceptValue: 28,
 *   intuitionValue: 57,
 *   questionText: '我家猫咪最近食欲不好怎么办',
 *   timezoneOffset: 480,  // 可选，默认自动获取本地时区
 *   scenario: PetScenario.DECISION,
 * })
 */
export async function analyzePetEmotion(input: PetEmotionInput): Promise<PetEmotionOutput> {
  const timezoneOffset = input.timezoneOffset ?? getLocalTimezoneOffset()

  if (timezoneOffset < -720 || timezoneOffset > 720) {
    throw new Error(
      `INVALID_TIMEZONE_OFFSET: timezoneOffset 有效范围 [-720, 720]，当前值: ${timezoneOffset}`,
    )
  }

  const scenario = input.scenario ?? PetScenario.DECISION

  const context: algorithm.AnalysisContext = {
    currentDateTime: input.timestamp ?? new Date(),
    timezoneOffset,
    divinationText: input.questionText,
    textSplitMode: 'auto',
    mindUpperNumber: input.careValue,
    mindLowerNumber: input.perceptValue,
    mindMovingNumber: input.intuitionValue,
  }

  const engine = new algorithm.core.PEmotionEngine({
    registry: new algorithm.casting.AnalyzerRegistry(),
    guaBuilder: new algorithm.core.PatternBuilder({}),
    tiyongAnalyzer: new algorithm.core.RelationAnalyzer({}),
  })
  const sources = await engine.analyzeTriSource(context)

  const interpreter = new algorithm.interpretation.PatternInterpreter()
  const timeInterp = interpreter.interpret(sources.time, scenario)
  const mindInterp = interpreter.interpret(sources.mind, scenario)
  const matterInterp = interpreter.interpret(sources.matter, scenario)

  const synthesizer = new algorithm.interpretation.MultiSourceSynthesizer()
  const multi = synthesizer.synthesize(timeInterp, mindInterp, matterInterp)

  return toExternalOutput(sources, multi, timeInterp)
}

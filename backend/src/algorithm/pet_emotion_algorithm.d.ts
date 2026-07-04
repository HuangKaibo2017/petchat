/**
 * pet_emotion_algorithm.js 的类型声明文件。
 */

export interface PEmotionOutput {
  castingTime: Date
  [key: string]: unknown
}

export interface SingleInterpretation {
  petPerspective: string
  ownerPerspective: string
  riskPoints?: string[]
  timing?: string
  seasonalStrength?: { body: number; use: number }
  [key: string]: unknown
}

export interface MultiSourceInterpretation {
  finalVerdict: unknown
  confidenceLevel: 'high' | 'medium' | 'low'
  integratedSuggestions?: string[]
  [key: string]: unknown
}

export interface AnalysisContext {
  currentDateTime: Date
  timezoneOffset: number
  divinationText: string
  textSplitMode: string
  mindUpperNumber: number
  mindLowerNumber: number
  mindMovingNumber: number
}

export namespace core {
  export class PEmotionEngine {
    constructor(options: Record<string, unknown>)
    analyzeTriSource(context: AnalysisContext): Promise<{
      time: PEmotionOutput
      mind: PEmotionOutput
      matter: PEmotionOutput
    }>
  }

  export class PatternBuilder {
    constructor(options: Record<string, unknown>)
  }

  export class RelationAnalyzer {
    constructor(options: Record<string, unknown>)
  }
}

export namespace casting {
  export class AnalyzerRegistry {
    constructor()
  }
}

export namespace interpretation {
  export class PatternInterpreter {
    constructor()
    interpret(source: PEmotionOutput, scenario: string): SingleInterpretation
  }

  export class MultiSourceSynthesizer {
    constructor()
    synthesize(
      timeInterp: SingleInterpretation,
      mindInterp: SingleInterpretation,
      matterInterp: SingleInterpretation,
    ): MultiSourceInterpretation
  }
}

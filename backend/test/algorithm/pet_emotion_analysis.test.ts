import { describe, it, expect } from 'vitest'
import {
  analyzePetEmotion,
  PetScenario,
  PetEmotionInput,
} from '../../src/algorithm/pet_emotion_analysis'

describe('pet_emotion_analysis', () => {
  const baseInput: PetEmotionInput = {
    careValue: 73,
    perceptValue: 28,
    intuitionValue: 57,
    questionText: '我家猫咪最近食欲不好怎么办',
    scenario: PetScenario.DECISION,
    timezoneOffset: 480,
  }

  it('正常输入应因算法未实现而抛出异常', async () => {
    await expect(analyzePetEmotion(baseInput)).rejects.toThrow()
  })

  it('抛出异常的消息应提示 Not implemented', async () => {
    await expect(analyzePetEmotion(baseInput)).rejects.toThrow(/Not implemented/)
  })

  it('timezoneOffset 超出范围时应抛出 INVALID_TIMEZONE_OFFSET', async () => {
    await expect(
      analyzePetEmotion({
        ...baseInput,
        timezoneOffset: 1000,
      }),
    ).rejects.toThrow(/INVALID_TIMEZONE_OFFSET/)
  })

  it('timezoneOffset 低于范围时应抛出 INVALID_TIMEZONE_OFFSET', async () => {
    await expect(
      analyzePetEmotion({
        ...baseInput,
        timezoneOffset: -1000,
      }),
    ).rejects.toThrow(/INVALID_TIMEZONE_OFFSET/)
  })

  it('不同 scenario 均因算法未实现而抛出异常', async () => {
    const scenarios = [
      PetScenario.HEALTH,
      PetScenario.LOST,
      PetScenario.BEHAVIOR,
      PetScenario.RELATIONSHIP,
      PetScenario.DECISION,
    ]

    for (const scenario of scenarios) {
      await expect(
        analyzePetEmotion({
          ...baseInput,
          scenario,
        }),
      ).rejects.toThrow(/Not implemented/)
    }
  })
})

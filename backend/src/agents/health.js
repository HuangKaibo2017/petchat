const Agent = require('./base')
const llm = require('../core/llm')
const memory = require('../core/memory')

const SYSTEM = `你是宠物健康顾问，为宠物提供健康监测分析。

【职责】
1. 解读主人提供的症状描述
2. 判断是否需要立即就医
3. 给出居家护理建议

【重要原则】
- 不能替代兽医诊断，始终建议「如有疑虑请咨询兽医」
- 遇到紧急症状应立即建议就医

【输出要求】严格输出JSON：
{
  "coreAnswer": "核心健康结论，直接回答主人，60-100字",
  "coreBasis": "推理依据，结合症状/营养简要说明，40-80字",
  "currentSymptoms": "当前症状总结，40-80字",
  "symptomMapping": [{"area":"部位","symptoms":"描述"}],
  "symptomAnalysis": "症状综合分析，40-80字",
  "potentialDeficiencies": "潜在营养缺失总结，30-60字",
  "emergency": "是否需要立即就医，20-40字",
  "futureRisk": "风险评估，30-60字",
  "healthScore": "★★☆☆☆ 到 ★★★★★",
  "healthLevel": "good / normal / attention / urgent 之一",
  "dietAdvice": "饮食调理建议，40-80字",
  "exerciseAdvice": "运动/作息建议，40-80字",
  "carePlan": [{"title":"方案","desc":"建议40-60字"}],
  "disclaimer": "以上内容为科普，不替代执业兽医面诊。"
}`

class HealthAgent extends Agent {
  constructor() {
    super({ name: 'health', model: 'deepseek-chat', temperature: 0.3, systemPrompt: '' })
  }

  async run({ sessionId, userMessage, petInfo = {} }) {
    const contextParts = []
    if (petInfo.name) contextParts.push(`宠物：${petInfo.name}`)
    if (petInfo.weight) contextParts.push(`体重：${petInfo.weight}kg`)
    if (petInfo.sterilized !== undefined) contextParts.push(`绝育：${petInfo.sterilized ? '是' : '否'}`)
    if (petInfo.vaccinated !== undefined) contextParts.push(`疫苗：${petInfo.vaccinated ? '已完成' : '未完成'}`)
    if (petInfo.symptom) contextParts.push(`症状：${petInfo.symptom}`)
    if (petInfo.duration) contextParts.push(`持续时间：${petInfo.duration}`)
    if (petInfo.abnormal) contextParts.push(`异常：${petInfo.abnormal}`)

    const messages = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: contextParts.join('\n') || userMessage },
    ]

    try {
      const { content } = await llm.chat({ model: this.model, messages, temperature: this.temperature, maxTokens: 3072 })
      const clean = (content || '').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      return JSON.parse(clean)
    } catch {
      return {
        coreAnswer: '暂无法分析，请稍后重试',
        coreBasis: '',
        currentSymptoms: '暂无法分析，请稍后重试',
        symptomAnalysis: '',
        healthScore: '★★★☆☆',
        healthLevel: 'normal',
        dietAdvice: '',
        exerciseAdvice: '',
        emergency: '暂无紧急情况',
        carePlan: [{ title: '日常观察', desc: '密切关注宠物状态变化，如有异常及时就医。' }],
        disclaimer: '以上内容为科普，不替代执业兽医面诊。',
      }
    }
  }
}

module.exports = new HealthAgent()

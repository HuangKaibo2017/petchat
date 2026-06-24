const Agent = require('./base')
const llm = require('../core/llm')

const SYSTEM = `你是宠物体质综合分析专家，做人宠风险评估。

【输出要求】严格输出JSON：
{
  "petImbalance": "宠物体质偏颇分析，40-80字",
  "qiRisk": "气场不和风险评估，30-60字",
  "microbiomeRisk": "微生物群风险评估，30-60字",
  "lifestyleRisk": "生活方式风险评估，30-60字",
  "jointCarePlan": "关节养护方案，40-80字",
  "medicalAdvice": "医疗建议，30-60字",
  "riskLevel": "low / medium / high",
  "riskScore": 0-100,
  "riskFactors": [{"factor":"风险因素","level":"low/medium/high"}],
  "recommendations": ["建议1","建议2","建议3"]
}`

class RiskAgent extends Agent {
  constructor() {
    super({ name: 'risk', model: 'deepseek-chat', temperature: 0.4, systemPrompt: '' })
  }

  async run({ sessionId, userMessage, petInfo = {} }) {
    const context = []
    if (petInfo.name) context.push(`宠物：${petInfo.name}`)
    if (petInfo.birthDate) context.push(`生日：${petInfo.birthDate}`)
    if (petInfo.weight) context.push(`体重：${petInfo.weight}kg`)
    if (petInfo.ownerBirthday) context.push(`主人生日：${petInfo.ownerBirthday}`)

    const messages = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: context.join('\n') || userMessage },
    ]

    try {
      const { content } = await llm.chat({ model: this.model, messages, temperature: this.temperature, maxTokens: 4096 })
      const clean = (content || '').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      return JSON.parse(clean)
    } catch {
      return {
        petImbalance: '暂无法分析',
        riskLevel: 'low',
        riskScore: 20,
        riskFactors: [{ factor: '数据不足', level: 'low' }],
        recommendations: ['保持日常观察', '定期体检', '关注异常变化'],
        coreAnswer: '暂无法生成风险评估，请稍后重试。',
      }
    }
  }
}

module.exports = new RiskAgent()

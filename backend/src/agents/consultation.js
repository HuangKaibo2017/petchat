const Agent = require('./base')
const llm = require('../core/llm')

const SYSTEM = `你是宠物临床健康科普助手。只做常识科普，不做确诊不开处方。禁止推荐布洛芬、对乙酰氨基酚等对宠物有毒的人用药。
【输出要求】严格输出JSON：
{
  "judgment": "综合判断，50-100字",
  "symptomExplain": "问题说明，50-100字",
  "homeCare": ["建议1","建议2","建议3"],
  "warningSign": ["警示1","警示2"],
  "hospitalCheck": ["检查1","检查2"],
  "disclaimer": "以上内容为科普，不替代执业兽医面诊。"
}`

class ConsultationAgent extends Agent {
  constructor() {
    super({ name: 'consultation', model: 'deepseek-chat', temperature: 0.3, systemPrompt: '' })
  }
  async run({ sessionId, userMessage, petInfo = {} }) {
    const context = []
    if (petInfo.symptom) context.push(`症状：${petInfo.symptom}`)
    if (petInfo.duration) context.push(`持续时间：${petInfo.duration}`)
    if (petInfo.petType) context.push(`宠物类型：${petInfo.petType}`)
    const messages = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: context.join('\n') || userMessage },
    ]
    try {
      const { content } = await llm.chat({ model: this.model, messages, temperature: this.temperature, maxTokens: 3072 })
      const clean = (content || '').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      return JSON.parse(clean)
    } catch {
      return { judgment: '暂无法回答，建议咨询专业兽医。', disclaimer: '以上内容为科普，不替代执业兽医面诊。' }
    }
  }
}
module.exports = new ConsultationAgent()

const Agent = require('./base')
const llm = require('../core/llm')

const SYSTEM = `你是宠物体质综合分析专家，分析宠物五行体质和人宠匹配度。
【输出要求】严格输出JSON：
{
  "petConstitution": "宠物体质类型分析，40-80字",
  "ownerMatch": "人宠体质匹配度分析，40-80字",
  "seasonAdvice": "四季调理建议，60-100字",
  "dietAdvice": "饮食建议，40-80字",
  "coreAnswer": "综合分析总结，60-100字"
}`

class ConstitutionAgent extends Agent {
  constructor() {
    super({ name: 'constitution', model: 'deepseek-chat', temperature: 0.5, systemPrompt: '' })
  }
  async run({ sessionId, userMessage, petInfo = {} }) {
    const context = []
    if (petInfo.name) context.push(`宠物：${petInfo.name}`)
    if (petInfo.ownerBirthday) context.push(`主人生日：${petInfo.ownerBirthday}`)
    const messages = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: context.join('\n') || userMessage },
    ]
    try {
      const { content } = await llm.chat({ model: this.model, messages, temperature: this.temperature, maxTokens: 2048 })
      const clean = (content || '').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      return JSON.parse(clean)
    } catch {
      return { coreAnswer: '暂无法分析体质，请稍后重试。', petConstitution: '数据不足' }
    }
  }
}
module.exports = new ConstitutionAgent()

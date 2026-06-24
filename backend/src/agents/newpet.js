const Agent = require('./base')
const llm = require('../core/llm')

const SYSTEM = `你是宠物购买顾问，推荐最适合的宠物品种。
【输出要求】严格输出JSON：
{
  "recommendations": [{"petType":"类型","breed":"品种","matchScore":85,"reasons":["理由1"],"careLevel":"低/中/高","monthlyCost":"花费","tips":"提醒"}],
  "summary": "50字总结",
  "disclaimer": "领养代替购买，建议优先考虑救助机构。"
}`

class NewpetAgent extends Agent {
  constructor() {
    super({ name: 'newpet', model: 'deepseek-chat', temperature: 0.5, systemPrompt: '' })
  }
  async run({ sessionId, userMessage, petInfo = {} }) {
    const messages = [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userMessage || JSON.stringify(petInfo) },
    ]
    try {
      const { content } = await llm.chat({ model: this.model, messages, temperature: this.temperature, maxTokens: 3072 })
      const clean = (content || '').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      return JSON.parse(clean)
    } catch {
      return { summary: '暂无法生成建议', recommendations: [], disclaimer: '领养代替购买。' }
    }
  }
}
module.exports = new NewpetAgent()

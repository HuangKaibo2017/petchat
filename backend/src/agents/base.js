/**
 * Agent 基类
 * 每个 Agent = system prompt + 模型 + 可选工具
 */

const llm = require('../core/llm')
const memory = require('../core/memory')

class Agent {
  constructor({ name, systemPrompt, tools = [], model = 'qwen-plus', temperature = 0.7 }) {
    this.name = name
    this.systemPrompt = systemPrompt
    this.tools = tools
    this.model = model
    this.temperature = temperature
  }

  /**
   * 非流式执行
   */
  async run({ sessionId, userMessage, petInfo = {} }) {
    const session = memory.get(sessionId)
    memory.setAgent(sessionId, this.name)

    // 注入宠物信息到 system prompt
    const prompt = this._buildSystemPrompt(petInfo)

    const messages = [
      { role: 'system', content: prompt },
      ...memory.getMessages(sessionId),
      { role: 'user', content: userMessage },
    ]

    memory.trim(sessionId)

    const { content } = await llm.chat({
      model: this.model,
      messages,
      temperature: this.temperature,
    })

    const reply = content || ''
    memory.push(sessionId, { role: 'assistant', content: reply, agent: this.name })
    return reply
  }

  /**
   * 流式执行
   */
  async runStream({ sessionId, userMessage, petInfo = {}, onToken, onDone }) {
    const session = memory.get(sessionId)
    memory.setAgent(sessionId, this.name)

    const prompt = this._buildSystemPrompt(petInfo)

    const messages = [
      { role: 'system', content: prompt },
      ...memory.getMessages(sessionId),
      { role: 'user', content: userMessage },
    ]

    memory.trim(sessionId)

    let fullReply = ''
    await llm.stream({
      model: this.model,
      messages,
      temperature: this.temperature,
      onToken: (token) => {
        fullReply += token
        if (onToken) onToken(token)
      },
      onDone: (full) => {
        fullReply = full
      },
    })

    memory.push(sessionId, { role: 'assistant', content: fullReply, agent: this.name })
    if (onDone) onDone(fullReply)
    return fullReply
  }

  /**
   * 拼接最终 system prompt（注入宠物信息）
   */
  _buildSystemPrompt(petInfo) {
    let prompt = this.systemPrompt
    if (petInfo.name) {
      prompt = prompt.replace(/\{\{petName\}\}/g, petInfo.name || '未知')
      prompt = prompt.replace(/\{\{petBreed\}\}/g, petInfo.breed || '未知')
      prompt = prompt.replace(/\{\{petAge\}\}/g, petInfo.age || '未知')
      prompt = prompt.replace(/\{\{petType\}\}/g, petInfo.type || '未知')
      prompt = prompt.replace(/\{\{petGender\}\}/g, petInfo.gender || '未知')
      prompt = prompt.replace(/\{\{petWeight\}\}/g, petInfo.weight || '未知')
      prompt = prompt.replace(/\{\{petNumbers\}\}/g, petInfo.numbers || '未提供')
    }
    return prompt
  }
}

module.exports = Agent

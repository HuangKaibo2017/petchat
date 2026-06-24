/**
 * Intent Router — 意图分发
 * 用轻量 LLM 调用判断用户意图，路由到对应 Agent
 */

const llm = require('./llm')

// 路由缓存：同一 session 锁定 Agent，直到用户切换主题或新会话
const sessionAgent = new Map()

const CATEGORIES = {
  chat:          '日常闲聊、打招呼、闲聊',
  personality:   '询问宠物性格、行为习惯分析',
}

const ROUTER_PROMPT = `你是意图分类器。根据用户消息判断属于哪一类。

类别定义：
- chat: 日常闲聊、打招呼、撒娇互动、问候
- personality: 询问宠物性格、行为习惯、训练建议分析

规则：只回复小写类别名（chat 或 personality），不要解释。

用户消息：`

/**
 * 路由用户消息到对应 Agent 名称
 * @returns {Promise<string>} agent name
 */
async function route(sessionId, userMessage) {
  // 检查缓存：同一 session 上轮是 consultation，这轮大概率还是
  const cached = sessionAgent.get(sessionId)
  if (cached) {
    // 简单判断：如果消息很短且像新问题开头，才重新路由
    const switchPatterns = /^(帮我|分析|看看|检查|评估|查一下|怎么看|是什么|为什么)/
    if (!switchPatterns.test(userMessage)) {
      return cached
    }
  }

  try {
    const { content } = await llm.chat({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: ROUTER_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
      maxTokens: 10,
    })

    const agentName = (content || '').trim().toLowerCase()
    const valid = Object.keys(CATEGORIES).includes(agentName) ? agentName : 'chat'
    sessionAgent.set(sessionId, valid)
    return valid
  } catch {
    // LLM 不可用时默认 chat
    return 'chat'
  }
}

/**
 * 清除会话缓存
 */
function clearSession(sessionId) {
  sessionAgent.delete(sessionId)
}

module.exports = { route, clearSession, CATEGORIES }

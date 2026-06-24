/**
 * Memory Manager — 会话记忆管理
 * 短期记忆：最近 N 轮对话原文
 * 长期记忆：超出窗口后压缩为摘要
 */

// 内存存储 (MVP)，后期可迁 Redis/DB
const sessions = new Map()

const MAX_MESSAGES = 40       // 单会话最多保留消息条数
const SUMMARIZE_AT = 30       // 超过此数触发摘要压缩
const RECENT_KEEP = 10        // 压缩时保留最近 K 条原文

function now() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

/**
 * 获取或创建会话
 */
function get(sessionId, petId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      petId: petId || null,
      messages: [],
      summary: '',
      createdAt: now(),
      currentAgent: null,
    })
  }
  return sessions.get(sessionId)
}

/**
 * 追加消息
 */
function push(sessionId, message) {
  const session = get(sessionId)
  session.messages.push({
    ...message,
    at: message.at || now(),
  })
  // 检查是否需要压缩
  if (session.messages.length > SUMMARIZE_AT) {
    session._needsSummarize = true
  }
  return session
}

/**
 * 设置当前 Agent
 */
function setAgent(sessionId, agentName) {
  const session = get(sessionId)
  session.currentAgent = agentName
}

/**
 * 裁剪到模型上下文窗口内
 * 保留摘要 + 最近消息
 */
function trim(sessionId) {
  const session = get(sessionId)
  if (session.messages.length <= MAX_MESSAGES) return

  // 超过 MAX_MESSAGES，裁剪最早的消息
  const removeCount = session.messages.length - RECENT_KEEP
  const removed = session.messages.splice(0, removeCount)

  // 将被裁剪的内容追加到摘要
  if (removed.length > 0) {
    const snippet = removed.map(m => `[${m.role}]: ${m.content}`).join('\n')
    session.summary = (session.summary ? session.summary + '\n---\n' : '') + snippet
  }
}

/**
 * 获取消息列表（含摘要），用于拼 prompt
 */
function getMessages(sessionId) {
  const session = get(sessionId)
  const result = []
  if (session.summary) {
    result.push({ role: 'system', content: `[对话历史摘要]\n${session.summary}` })
  }
  result.push(...session.messages)
  return result
}

/**
 * 获取原始消息列表
 */
function getRaw(sessionId) {
  return get(sessionId).messages
}

/**
 * 销毁会话
 */
function destroy(sessionId) {
  sessions.delete(sessionId)
}

/**
 * 会话总数（用于监控）
 */
function count() {
  return sessions.size
}

module.exports = { get, push, setAgent, trim, getMessages, getRaw, destroy, count }

/**
 * 列出用户的所有会话
 */
function list(userId) {
  const result = []
  for (const [id, session] of sessions) {
    if (session.userId === userId) {
      result.push({
        id,
        sessionId: id,
        userId: session.userId,
        petId: session.petId || '',
        petName: session.petName || '',
        title: session.title || '',
        messages: session.messages || [],
        createdAt: session.createdAt || now(),
      })
    }
  }
  return result
}

/**
 * 为用户和宠物创建新会话
 */
function create(userId, petId, meta = {}) {
  const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
  sessions.set(sessionId, {
    id: sessionId,
    userId,
    petId,
    petName: meta.petName || '',
    title: meta.title || '',
    messages: [],
    summary: '',
    createdAt: now(),
    currentAgent: null,
  })
  return sessionId
}

module.exports = { get, push, setAgent, trim, getMessages, getRaw, destroy, count, list, create }

/**
 * DeepSeek LLM Adapter
 * 支持流式和非流式调用，兼容 OpenAI Chat Completions 接口
 */

const LLM_API_URL = process.env.LLM_API_URL || 'https://api.deepseek.com/v1/chat/completions'
const LLM_API_KEY = process.env.LLM_API_KEY || ''
const LLM_MODEL_DEFAULT = process.env.LLM_MODEL || 'deepseek-chat'

let available = !!LLM_API_KEY

/**
 * 健康检查 — 验证 API Key 是否可用
 */
async function ping() {
  if (!LLM_API_KEY) return false
  try {
    const res = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL_DEFAULT,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        stream: false,
      }),
    })
    available = res.ok
    return res.ok
  } catch {
    available = false
    return false
  }
}

/**
 * 非流式调用
 */
async function chat({ model = LLM_MODEL_DEFAULT, messages, temperature = 0.7, maxTokens = 8192, timeoutMs = 120000 }) {
  if (!LLM_API_KEY) {
    throw new Error('LLM_API_KEY 未配置')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`LLM API ${res.status}: ${text}`)
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content || ''
    return { content, usage: data?.usage }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * 流式调用
 * onToken(token): 每收到一个 token 触发
 * 返回完整文本
 */
async function stream({ model = LLM_MODEL_DEFAULT, messages, temperature = 0.7, maxTokens = 8192, onToken, onDone, timeoutMs = 180000 }) {
  if (!LLM_API_KEY) {
    throw new Error('LLM_API_KEY 未配置')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let res
  try {
    res = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timeout)
    if (e.name === 'AbortError') throw new Error('LLM 流式请求超时')
    throw e
  }

  if (!res.ok) {
    clearTimeout(timeout)
    const text = await res.text()
    throw new Error(`LLM API ${res.status}: ${text}`)
  }

  let fullContent = ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (!data || data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const token = parsed?.choices?.[0]?.delta?.content || ''
          if (token) {
            fullContent += token
            if (onToken) onToken(token)
          }
        } catch { /* 跳过解析失败的行 */ }
      }
    }
  } finally {
    clearTimeout(timeout)
  }

  if (onDone) onDone(fullContent)
  return fullContent
}

module.exports = { chat, stream, ping, available: () => available }

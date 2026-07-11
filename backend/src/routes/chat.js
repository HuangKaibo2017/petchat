const { Router } = require('express')
const { validate } = require('../middleware/validate')
const s = require('../schemas')

module.exports = function createChatRoutes({ db, auth, optionalAuth, memory, router: intentRouter, agents }) {
  const router = Router()

  async function rehydrateSession(sessionId, petMeta = {}) {
    const session = memory.get(sessionId)
    session.petName = petMeta.petName || session.petName
    session.petBreed = petMeta.petBreed || session.petBreed
    session.petAge = petMeta.petAge || session.petAge
    if (session.messages.length === 0) {
      const rows = await db.query(
        'SELECT f_chat_history FROM t_chat_history WHERE f_id = ?',
        [sessionId]
      )
      if (rows.length > 0 && rows[0].f_chat_history) {
        const history = (typeof rows[0].f_chat_history === 'string' ? JSON.parse(rows[0].f_chat_history) : rows[0].f_chat_history)
        for (const r of (Array.isArray(history) ? history : [])) {
          session.messages.push({ role: r.role === 'pet' ? 'assistant' : r.role, content: r.content, at: r.created_at })
        }
      }
    }
    return session
  }

  async function handleChatSend(req, res) {
    try {
      const { sessionId, message } = req.body
      if (!sessionId || !message) {
        return res.status(400).json({ code: 400, message: '缺少 sessionId 或消息内容' })
      }

      const sessRows = await db.query(
        'SELECT h.f_id, h.f_pet_id, p.f_name, p.f_birth_date FROM t_chat_history h LEFT JOIN t_pet p ON p.f_id = h.f_pet_id WHERE h.f_id = ? AND h.f_user_id = ?',
        [isNaN(sessionId) ? -1 : parseInt(sessionId), req.userId]
      )
      if (sessRows.length === 0) return res.status(404).json({ code: 404, message: '会话不存在' })
      const sess = sessRows[0]

      const petInfo = {
        name: sess.f_name || '宠物',
        breed: '宠物',
        age: sess.f_birth_date ? String(Math.max(1, new Date().getFullYear() - new Date(sess.f_birth_date).getFullYear())) : '3',
      }

      await rehydrateSession(sessionId, { petName: petInfo.name, petBreed: petInfo.breed, petAge: petInfo.age })

      const agentName = await intentRouter.route(String(sessionId), message)
      const reply = await agents.get(agentName).run({ sessionId, userMessage: message, petInfo })

      const ts = new Date().toISOString()
      const histRows = await db.query(
        'SELECT f_chat_history FROM t_chat_history WHERE f_id = ?',
        [sessionId]
      )
      let history = []
      if (histRows.length > 0 && histRows[0].f_chat_history) {
        const raw = histRows[0].f_chat_history
        history = (typeof raw === 'string' ? JSON.parse(raw) : raw) || []
      }
      history.push({ role: 'user', content: message, created_at: ts })
      history.push({ role: 'pet', content: reply, created_at: ts })
      await db.execute(
        'UPDATE t_chat_history SET f_chat_history = ?, f_ended_at = NOW() WHERE f_id = ?',
        [JSON.stringify(history), sessionId]
      )

      res.json({
        code: 200,
        data: {
          sessionId,
          userMessage: { id: Date.now(), role: 'user', content: message, at: new Date().toISOString() },
          petMessage: { id: Date.now() + 1, role: 'pet', content: reply, at: new Date().toISOString() },
        },
      })
    } catch (err) {
      console.error('[chat] error:', err.message)
      const fallbacks = ['主人主人，我在这儿呢！', '能不能摸摸我的头呀？', '汪汪！你今天心情好吗？']
      res.status(500).json({
        code: 500,
        message: '聊天服务暂时不可用',
        data: {
          sessionId: req.body.sessionId,
          userMessage: { id: Date.now(), role: 'user', content: req.body.message, at: new Date().toISOString() },
          petMessage: { id: Date.now() + 1, role: 'pet', content: fallbacks[Math.floor(Math.random() * fallbacks.length)], at: new Date().toISOString() },
        },
      })
    }
  }

  router.post('/send', auth, validate(s.chatSend), handleChatSend)
  router.post('/send-json', auth, validate(s.chatSend), handleChatSend)

  router.get('/sessions', optionalAuth, async (req, res) => {
    try {
      if (!req.userId) return res.json({ code: 200, data: { sessions: [] } })
      const rows = await db.query(
        `SELECT h.f_id, h.f_pet_id, h.f_meta_info, h.f_ended_at, p.f_name
         FROM t_chat_history h LEFT JOIN t_pet p ON p.f_id = h.f_pet_id
         WHERE h.f_user_id = ?
         ORDER BY h.f_ended_at DESC NULLS LAST LIMIT 50`,
        [req.userId]
      )
      res.json({
        code: 200,
        data: {
          sessions: rows.map(s => {
            const meta = (typeof s.f_meta_info === 'string' ? JSON.parse(s.f_meta_info) : (s.f_meta_info || {}))
            return {
              id: s.f_id,
              petId: s.f_pet_id,
              petName: s.f_name || '',
              title: meta.title || '',
              time: s.f_ended_at,
            }
          }),
        },
      })
    } catch (err) {
      console.error('[GET /chat/sessions]', err.message)
      res.json({ code: 200, data: { sessions: [] } })
    }
  })

  router.post('/sessions', auth, validate(s.chatSessionCreate), async (req, res) => {
    try {
      const { petId } = req.body
      if (!petId) return res.status(400).json({ code: 400, message: '缺少 petId' })

      const pets = await db.query('SELECT f_id, f_name, f_birth_date FROM t_pet WHERE f_id = ? AND f_user_id = ?', [petId, req.userId])
      if (pets.length === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })

      const title = `与${pets[0].f_name}的对话`
      const result = await db.execute(
        `INSERT INTO t_chat_history (f_user_id, f_pet_id, f_lang, f_chat_history, f_meta_info, f_started_at, f_ended_at) VALUES (?, ?, 'zh-CN', '[]'::jsonb, ?, NOW(), NOW()) RETURNING f_id`,
        [req.userId, petId, JSON.stringify({ title })]
      )
      const sessionId = result.insertId || (result.rows && result.rows[0] && result.rows[0].f_id)

      const session = memory.get(sessionId)
      session.userId = req.userId
      session.petId = petId
      session.petName = pets[0].f_name

      res.json({
        code: 200,
        data: { sessionId, petId, petName: pets[0].f_name },
      })
    } catch (err) {
      console.error('[POST /chat/sessions]', err.message)
      res.status(500).json({ code: 500, message: '创建会话失败' })
    }
  })

  router.get('/messages', auth, async (req, res) => {
    try {
      const { sessionId } = req.query
      if (!sessionId) return res.status(400).json({ code: 400, message: '缺少 sessionId' })

      const sessRows = await db.query(
        'SELECT f_id, f_chat_history FROM t_chat_history WHERE f_id = ? AND f_user_id = ?',
        [isNaN(sessionId) ? -1 : parseInt(sessionId), req.userId]
      )
      if (sessRows.length === 0) return res.status(404).json({ code: 404, message: '会话不存在' })

      const raw = sessRows[0].f_chat_history
      const history = (typeof raw === 'string' ? JSON.parse(raw) : raw) || []
      res.json({
        code: 200,
        data: {
          sessionId,
          messages: history.map((m, i) => ({ id: i + 1, role: m.role, content: m.content, at: m.created_at })),
        },
      })
    } catch (err) {
      console.error('[GET /chat/messages]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  return router
}

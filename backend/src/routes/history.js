const { Router } = require('express')

module.exports = function createHistoryRoutes({ db, auth }) {
  const router = Router()

  router.get('/', auth, async (req, res) => {
    try {
      const { type, petId } = req.query
      let reports = []

      if (type === 'emotion' || !type) {
        let sql = 'SELECT f_id, f_public_uid, f_pet_id, f_core_answer, f_food_satisfaction, f_mood_level, f_body_status, f_status_summary, f_div_system, f_input_question, f_created_at FROM t_report_emotion WHERE f_user_id = ? AND f_deleted = 0'
        const params = [req.userId]
        if (petId) { sql += ' AND f_pet_id = ?'; params.push(petId) }
        sql += ' ORDER BY f_created_at DESC LIMIT 50'
        const rows = await db.query(sql, params)
        reports.push(...rows.map(r => ({ ...r, id: r.f_id, type: 'emotion', typeName: '情绪解读', createdAt: r.f_created_at })))
      }

      if (type === 'health' || !type) {
        let sql = 'SELECT f_id, f_public_uid, f_pet_id, f_core_answer, f_health_score, f_health_level, f_symptom_analysis, f_created_at FROM t_report_health WHERE f_user_id = ? AND f_deleted = 0'
        const params = [req.userId]
        if (petId) { sql += ' AND f_pet_id = ?'; params.push(petId) }
        sql += ' ORDER BY f_created_at DESC LIMIT 50'
        const rows = await db.query(sql, params)
        reports.push(...rows.map(r => ({ ...r, id: r.f_id, type: 'health', typeName: '健康监测', createdAt: r.f_created_at })))
      }

      if (type === 'risk' || !type) {
        let sql = 'SELECT f_id, f_public_uid, f_pet_id, f_core_answer, f_risk_level, f_risk_score, f_created_at FROM t_report_risk WHERE f_user_id = ? AND f_deleted = 0'
        const params = [req.userId]
        if (petId) { sql += ' AND f_pet_id = ?'; params.push(petId) }
        sql += ' ORDER BY f_created_at DESC LIMIT 50'
        const rows = await db.query(sql, params)
        reports.push(...rows.map(r => ({ ...r, id: r.f_id, type: 'risk', typeName: '风险评估', createdAt: r.f_created_at })))
      }

      if (type === 'constitution' || !type) {
        let sql = 'SELECT f_id, f_public_uid, f_pet_id, f_core_answer, f_pet_constitution, f_created_at FROM t_report_constitution WHERE f_user_id = ? AND f_deleted = 0'
        const params = [req.userId]
        if (petId) { sql += ' AND f_pet_id = ?'; params.push(petId) }
        sql += ' ORDER BY f_created_at DESC LIMIT 50'
        const rows = await db.query(sql, params)
        reports.push(...rows.map(r => ({ ...r, id: r.f_id, type: 'constitution', typeName: '体质综合分析', createdAt: r.f_created_at })))
      }

      if (type === 'medical' || !type) {
        let sql = 'SELECT f_id, f_public_uid, f_pet_id, f_judgment AS f_core_answer, f_created_at FROM t_report_consultation WHERE f_user_id = ? AND f_deleted = 0'
        const params = [req.userId]
        if (petId) { sql += ' AND f_pet_id = ?'; params.push(petId) }
        sql += ' ORDER BY f_created_at DESC LIMIT 50'
        const rows = await db.query(sql, params)
        reports.push(...rows.map(r => ({ ...r, id: r.f_id, type: 'medical', typeName: '医疗科普', createdAt: r.f_created_at })))
      }

      if (!type) reports.sort((a, b) => (b.f_created_at || 0) - (a.f_created_at || 0))

      res.json({ code: 200, data: reports })
    } catch (err) {
      console.error('[GET /api/reports]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  router.get('/:id', auth, async (req, res) => {
    try {
      const tables = ['t_report_emotion', 't_report_health', 't_report_risk', 't_report_constitution', 't_report_consultation']
      for (const table of tables) {
        const rows = await db.query(
          `SELECT * FROM ${table} WHERE (f_id = ? OR f_public_uid = ?) AND f_user_id = ?`,
          [isNaN(req.params.id) ? -1 : parseInt(req.params.id), req.params.id, req.userId]
        )
        if (rows.length > 0) {
          const r = rows[0]
          return res.json({
            code: 200,
            data: {
              ...r,
              id: r.f_id,
              publicUid: r.f_public_uid,
              rawResponse: typeof r.f_llm_resp === 'string' ? JSON.parse(r.f_llm_resp) : r.f_llm_resp,
            },
          })
        }
      }
      res.status(404).json({ code: 404, message: '报告不存在' })
    } catch (err) {
      console.error('[GET /api/reports/:id]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  return router
}

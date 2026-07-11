const { Router } = require('express')

module.exports = function createUserProfileRoutes({ db, auth, timestamp }) {
  const router = Router()

  router.get('/user/profile', auth, async (req, res) => {
    try {
      const rows = await db.query(
        `SELECT f_id, f_nickname, f_avatar_url, f_phone, f_email, f_meta_info
         FROM t_user WHERE f_id = ?`,
        [req.userId]
      )
      if (rows.length === 0) return res.status(404).json({ code: 404, message: '用户不存在' })

      const u = rows[0]
      const meta = typeof u.f_meta_info === 'string' ? JSON.parse(u.f_meta_info) : (u.f_meta_info || {})

      res.json({
        code: 200,
        data: {
          id: u.f_id,
          nickname: u.f_nickname,
          avatarUrl: u.f_avatar_url || '',
          phone: u.f_phone || '',
          email: u.f_email || '',
          age: meta.age || '',
          occupation: meta.occupation || '',
          city: meta.city || '',
          diet: meta.diet || '',
          experience: meta.experience || '',
        },
      })
    } catch (err) {
      console.error('[GET /api/user/profile]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  router.put('/user/profile', auth, async (req, res) => {
    try {
      const { nickname, avatarUrl, phone, email, age, occupation, city, diet, experience } = req.body
      const ts = timestamp()

      const sets = []
      const params = []

      if (nickname !== undefined) { sets.push('f_nickname = ?'); params.push(nickname) }
      if (avatarUrl !== undefined) { sets.push('f_avatar_url = ?'); params.push(avatarUrl) }
      if (phone !== undefined) { sets.push('f_phone = ?'); params.push(phone) }
      if (email !== undefined) { sets.push('f_email = ?'); params.push(email) }

      const metaPatch = {}
      if (age !== undefined) metaPatch.age = age
      if (occupation !== undefined) metaPatch.occupation = occupation
      if (city !== undefined) metaPatch.city = city
      if (diet !== undefined) metaPatch.diet = diet
      if (experience !== undefined) metaPatch.experience = experience

      if (Object.keys(metaPatch).length > 0) {
        sets.push(`f_meta_info = COALESCE(f_meta_info, '{}'::jsonb) || ?::jsonb`)
        params.push(JSON.stringify(metaPatch))
      }

      if (sets.length === 0) {
        return res.json({ code: 200, data: { message: '无变更' } })
      }

      sets.push('f_updated_at = ?'); params.push(ts)
      params.push(req.userId)

      await db.execute(
        `UPDATE t_user SET ${sets.join(', ')} WHERE f_id = ?`,
        params
      )

      res.json({ code: 200, data: { updatedAt: ts } })
    } catch (err) {
      console.error('[PUT /api/user/profile]', err.message)
      res.status(500).json({ code: 500, message: '更新失败' })
    }
  })

  return router
}

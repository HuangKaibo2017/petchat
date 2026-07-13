const { Router } = require('express')
const crypto = require('crypto')

const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD_HASH = crypto.createHash('sha256').update('gengdongta@2026').digest('hex')

module.exports = function createAdminAuthRoutes({ signJWT }) {
  const router = Router()

  router.post('/admin/login', async (req, res) => {
    try {
      const { username, password } = req.body || {}

      if (!username || !password) {
        return res.status(400).json({ code: 400, message: '请输入用户名和密码' })
      }

      const inputHash = crypto.createHash('sha256').update(password).digest('hex')

      if (username !== ADMIN_USERNAME || inputHash !== ADMIN_PASSWORD_HASH) {
        return res.status(401).json({ code: 401, message: '用户名或密码错误' })
      }

      const token = signJWT({
        userId: 0,
        userPublicUid: 'admin',
        role: 'admin',
        username: ADMIN_USERNAME,
      })

      res.json({
        code: 200,
        data: {
          token,
          user: { id: 0, username: ADMIN_USERNAME, role: 'admin' },
        },
      })
    } catch (err) {
      console.error('[POST /api/auth/admin/login]', err.message)
      res.status(500).json({ code: 500, message: '登录失败' })
    }
  })

  return router
}

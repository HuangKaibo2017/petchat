const jwt = require('jsonwebtoken')
const crypto = require('crypto')

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex')

function adminAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录' })
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (payload.role !== 'admin') {
      return res.status(403).json({ code: 403, message: '无管理员权限' })
    }
    req.adminUser = payload
    next()
  } catch {
    return res.status(401).json({ code: 401, message: '登录已过期' })
  }
}

module.exports = { adminAuth }

const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { createLogger } = require('../utils/logger')

const log = createLogger('auth')
const IS_DEV = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (!IS_DEV) {
    log.error('JWT_SECRET 未设置，生产环境拒绝启动')
    process.exit(1)
  }
  log.warn('JWT_SECRET 未设置，使用随机临时密钥（仅开发环境，重启后所有 token 失效）')
  return crypto.randomBytes(32).toString('hex')
})()

const JWT_EXPIRES_IN = parseInt(process.env.JWT_EXPIRES_IN || '86400', 10)

function signJWT(payload) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET 未配置，无法签发令牌')
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

function verifyJWT(token) {
  if (!JWT_SECRET) return null
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

async function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录' })
  }
  const payload = verifyJWT(token)
  if (!payload) {
    return res.status(401).json({ code: 401, message: '登录已过期' })
  }
  req.userId = payload.userId
  req.userPublicUid = payload.userPublicUid
  next()
}

async function optionalAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (token) {
    const payload = verifyJWT(token)
    if (payload) {
      req.userId = payload.userId
      req.userPublicUid = payload.userPublicUid
    }
  }
  next()
}

module.exports = { auth, optionalAuth, signJWT, verifyJWT }

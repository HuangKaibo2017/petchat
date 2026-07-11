const { Router } = require('express')
const { validate } = require('../middleware/validate')
const s = require('../schemas')

module.exports = function createWechatAuthRoutes({ db, signJWT, uuid, timestamp }) {
  const router = Router()
  const IS_DEV = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV

  router.post('/wechat-auth', validate(s.wechatAuth), async (req, res) => {
    try {
      const { code, nickName, avatarUrl } = req.body
      if (!code) {
        return res.status(400).json({ code: 400, message: '缺少微信登录 code' })
      }

      const WECHAT_APPID = process.env.WECHAT_APPID || ''
      const WECHAT_SECRET = process.env.WECHAT_SECRET || ''

      let openid = ''
      let unionid = ''

      if (WECHAT_APPID && WECHAT_SECRET) {
        try {
          const https = require('https')
          const wxRes = await new Promise((resolve, reject) => {
            https.get(
              `https://api.weixin.qq.com/sns/jscode2session?appid=${WECHAT_APPID}&secret=${WECHAT_SECRET}&js_code=${code}&grant_type=authorization_code`,
              (resp) => {
                let data = ''
                resp.on('data', chunk => data += chunk)
                resp.on('end', () => {
                  try { resolve(JSON.parse(data)) }
                  catch (e) { reject(e) }
                })
              }
            ).on('error', reject)
          })
          if (wxRes.openid) {
            openid = wxRes.openid
            unionid = wxRes.unionid || ''
          } else {
            console.warn('[wechat-auth] wx API error:', wxRes.errmsg || wxRes)
          }
        } catch (e) {
          console.warn('[wechat-auth] wx API call failed:', e.message)
        }
      }

      if (!openid) {
        console.warn('[wechat-auth] 微信 code 无效或 wx API 失败，使用 mock openid（code: ' + (code ? code.slice(0,8) : 'null') + '...）')
        openid = 'wx_' + uuid().replace(/-/g, '')
      }

      let rows = await db.query('SELECT f_id, f_public_uid, f_nickname, f_avatar_url FROM t_user WHERE f_wx_openid = ?', [openid])
      let user

      if (rows.length === 0) {
        const publicUid = uuid()
        const displayName = nickName || '微信用户'
        const ts = timestamp()
        await db.execute(
          'INSERT INTO t_user (f_public_uid, f_nickname, f_avatar_url, f_wx_openid, f_wx_unionid, f_status_id, f_created_at, f_updated_at) VALUES (?, ?, ?, ?, ?, 10, ?, ?)',
          [publicUid, displayName, avatarUrl || '', openid, unionid || '', ts, ts]
        )
        rows = await db.query('SELECT f_id, f_public_uid, f_nickname, f_avatar_url FROM t_user WHERE f_wx_openid = ?', [openid])
      }

      user = rows[0]

      const token = signJWT({
        userId: user.f_id,
        userPublicUid: user.f_public_uid,
        nickname: user.f_nickname,
      })

      return res.json({
        code: 200,
        data: {
          token,
          expiresIn: 86400,
          user: {
            id: user.f_id,
            nickname: user.f_nickname,
            avatarUrl: user.f_avatar_url || '',
          },
        },
      })
    } catch (err) {
      console.error('[wechat-auth] error:', err.message)
      return res.status(500).json({ code: 500, message: '登录失败' })
    }
  })

  return router
}

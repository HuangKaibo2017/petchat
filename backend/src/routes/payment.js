const { Router } = require('express')
const { validate } = require('../middleware/validate')
const s = require('../schemas')

module.exports = function createPaymentRoutes({ db, auth, wechatPay, yuanToFen, timestamp }) {
  const router = Router()

  router.post('/wechat/jsapi', auth, validate(s.payJsapi), async (req, res) => {
    try {
      const { orderId } = req.body
      const orders = await db.query(
        `SELECT f_id, f_order_no, f_final_amount, f_status_payment, f_meta_info
         FROM t_order
         WHERE f_id = ? AND f_user_id = ?`,
        [orderId, req.userId]
      )
      if (orders.length === 0) return res.status(404).json({ code: 404, message: '订单不存在' })

      const order = orders[0]
      if (Number(order.f_status_payment) === 10) {
        return res.status(400).json({ code: 400, message: '订单已支付' })
      }

      const users = await db.query('SELECT f_wx_openid FROM t_user WHERE f_id = ?', [req.userId])
      const openid = users[0] && users[0].f_wx_openid
      if (!openid || String(openid).startsWith('dev_')) {
        return res.status(400).json({ code: 400, message: '当前用户缺少正式微信 openid，请在真机微信环境重新登录' })
      }

      const meta = typeof order.f_meta_info === 'string' ? JSON.parse(order.f_meta_info) : (order.f_meta_info || {})
      const payment = await wechatPay.createJsapiOrder({
        openid,
        outTradeNo: order.f_order_no,
        description: meta.productName || '更懂它商品订单',
        amountFen: yuanToFen(order.f_final_amount),
        attach: String(order.f_id),
      })

      try {
        await db.execute(
          `INSERT INTO t_payment_transaction (
            f_order_id, f_order_no, f_provider, f_out_trade_no, f_prepay_id,
            f_amount, f_currency, f_status, f_raw_payload, f_created_at, f_updated_at
          ) VALUES (?, ?, 'wechat', ?, ?, ?, 'CNY', 'prepay', ?, ?, ?)`,
          [
            order.f_id, order.f_order_no, order.f_order_no, payment.prepayId,
            Number(order.f_final_amount), JSON.stringify({ prepayId: payment.prepayId }), timestamp(), timestamp(),
          ]
        )
      } catch (e) {
        console.warn('[POST /api/pay/wechat/jsapi] transaction log skipped:', e.message)
      }

      res.json({
        code: 200,
        data: {
          orderId: order.f_id,
          orderNo: order.f_order_no,
          payment,
        },
      })
    } catch (err) {
      console.error('[POST /api/pay/wechat/jsapi]', err.message, err.data || '')
      const status = err.code === 'WECHAT_PAY_CONFIG_MISSING' ? 500 : (err.status || 500)
      res.status(status).json({ code: status, message: err.message || '微信支付下单失败' })
    }
  })

  router.post('/wechat/notify', async (req, res) => {
    try {
      const rawBody = req.rawBody || JSON.stringify(req.body || {})
      const verified = wechatPay.verifyWechatPaySignature(req.headers, rawBody)
      if (!verified) {
        return res.status(401).json({ code: 'FAIL', message: '签名验证失败' })
      }

      const event = req.body || {}
      const transaction = wechatPay.decryptResource(event.resource)
      const isPaid = transaction.trade_state === 'SUCCESS'
      const statusPayment = isPaid ? 10 : 30
      const ts = timestamp()

      const updateResult = await db.execute(
        `UPDATE t_order
         SET f_status_payment = ?, f_payment_method = 'wechat', f_payment_time = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE f_payment_time END, f_updated_at = ?
         WHERE f_order_no = ? AND f_status_payment <> 10`,
        [statusPayment, isPaid, ts, transaction.out_trade_no]
      )

      try {
        await db.execute(
          `UPDATE t_payment_transaction
           SET f_transaction_id = ?, f_status = ?, f_raw_notify = ?, f_paid_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE f_paid_at END, f_updated_at = ?
           WHERE f_out_trade_no = ?`,
          [
            transaction.transaction_id || '',
            transaction.trade_state || '',
            JSON.stringify(transaction),
            isPaid,
            ts,
            transaction.out_trade_no,
          ]
        )
      } catch (e) {
        console.warn('[POST /api/pay/wechat/notify] transaction update skipped:', e.message)
      }

      if (!updateResult.affectedRows) {
        console.log('[wechat notify] idempotent or unknown order:', transaction.out_trade_no)
      }

      res.json({ code: 'SUCCESS', message: '成功' })
    } catch (err) {
      console.error('[POST /api/pay/wechat/notify]', err.message)
      res.status(500).json({ code: 'FAIL', message: err.message || '回调处理失败' })
    }
  })

  return router
}

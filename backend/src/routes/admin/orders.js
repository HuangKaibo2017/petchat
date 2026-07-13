const { Router } = require('express')
const { adminAuth } = require('./auth-guard')

module.exports = function createAdminOrdersRoutes({ db, timestamp }) {
  const router = Router()
  router.use(adminAuth)

  router.get('/orders', async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page || '1', 10), 1)
      const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10), 1), 100)
      const status = req.query.status || ''
      const search = req.query.search || ''
      const offset = (page - 1) * pageSize
      let countSql = `SELECT COUNT(*)::int AS total FROM t_order o`
      let dataSql = `SELECT o.f_id, o.f_order_no, o.f_user_id, o.f_total_amount, o.f_final_amount, o.f_status_payment, o.f_status_shipping, o.f_created_at FROM t_order o`
      const params = []; const countParams = []; const conditions = []
      if (status === 'unpaid') conditions.push('o.f_status_payment = 1')
      else if (status === 'pending') conditions.push('o.f_status_payment = 10 AND o.f_status_shipping = 1')
      else if (status === 'shipped') conditions.push('o.f_status_shipping = 10')
      else if (status === 'completed') conditions.push('o.f_status_shipping = 20')
      if (search) { const p = `%${search}%`; conditions.push('(o.f_order_no ILIKE ? OR o.f_receiver_name ILIKE ?)'); params.push(p, p); countParams.push(p, p) }
      if (conditions.length > 0) { const where = ' WHERE ' + conditions.join(' AND '); dataSql += where; countSql += where }
      dataSql += ` ORDER BY o.f_created_at DESC LIMIT ? OFFSET ?`
      params.push(pageSize, offset)
      const [totalRows, orderRows] = await Promise.all([db.query(countSql, countParams), db.query(dataSql, params)])
      const total = totalRows[0]?.total || 0
      const userIds = [...new Set(orderRows.map(o => o.f_user_id).filter(Boolean))]
      let userMap = new Map()
      if (userIds.length > 0) {
        const userRows = await db.query(`SELECT f_id, f_nickname FROM t_user WHERE f_id = ANY(?)`, [userIds])
        userRows.forEach(u => { userMap.set(u.f_id, u.f_nickname || `用户${u.f_id}`) })
      }
      const SPM = { 1: 'pending', 10: 'paid', 20: 'refunded' }
      const SSM = { 1: 'pending', 10: 'shipped', 20: 'completed' }
      const list = orderRows.map(o => ({ id: o.f_id, orderNo: o.f_order_no, userName: userMap.get(o.f_user_id) || `用户${o.f_user_id}`, totalAmount: Number(o.f_total_amount) || 0, finalAmount: Number(o.f_final_amount) || 0, statusPayment: SPM[o.f_status_payment] || 'pending', statusShipping: SSM[o.f_status_shipping] || 'pending', createdAt: String(o.f_created_at || '') }))
      res.json({ code: 200, data: { list, total, page, pageSize } })
    } catch (err) {
      console.error('[GET /api/admin/orders]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  router.get('/orders/:id', async (req, res) => {
    try {
      const rows = await db.query(
        `SELECT o.f_id, o.f_order_no, o.f_user_id, o.f_total_amount, o.f_discount_amount, o.f_final_amount, o.f_payment_method, o.f_status_payment, o.f_status_shipping, o.f_receiver_name, o.f_receiver_phone, o.f_receiver_address, o.f_created_at, o.f_updated_at FROM t_order o WHERE o.f_id = ?`, [req.params.id]
      )
      if (rows.length === 0) return res.status(404).json({ code: 404, message: '订单不存在' })
      const o = rows[0]
      let userName = `用户${o.f_user_id}`
      if (o.f_user_id) { const ur = await db.query(`SELECT f_nickname FROM t_user WHERE f_id = ?`, [o.f_user_id]); if (ur.length > 0) userName = ur[0].f_nickname || userName }
      const itemRows = await db.query(`SELECT f_id, f_product_name, f_quantity, f_unit_price, f_total_price FROM t_order_item WHERE f_order_id = ?`, [o.f_id])
      const shipRows = await db.query(`SELECT f_carrier, f_tracking_number FROM t_shipment WHERE f_order_id = ? AND f_deleted = 0 LIMIT 1`, [o.f_id])
      const SPM = { 1: 'pending', 10: 'paid', 20: 'refunded' }
      const SSM = { 1: 'pending', 10: 'shipped', 20: 'completed' }
      res.json({ code: 200, data: { id: o.f_id, orderNo: o.f_order_no, userName, totalAmount: Number(o.f_total_amount) || 0, discountAmount: Number(o.f_discount_amount) || 0, finalAmount: Number(o.f_final_amount) || 0, paymentMethod: o.f_payment_method || '微信支付', paymentStatus: SPM[o.f_status_payment] || 'pending', shippingStatus: SSM[o.f_status_shipping] || 'pending', receiverName: o.f_receiver_name || '', receiverPhone: o.f_receiver_phone || '', receiverAddress: o.f_receiver_address || '', items: itemRows.map(i => ({ id: i.f_id, productName: i.f_product_name, quantity: i.f_quantity, unitPrice: Number(i.f_unit_price) || 0, totalPrice: Number(i.f_total_price) || 0 })), shipment: shipRows.length > 0 ? { carrier: shipRows[0].f_carrier, trackingNumber: shipRows[0].f_tracking_number } : null, createdAt: String(o.f_created_at || ''), updatedAt: String(o.f_updated_at || '') } })
    } catch (err) {
      console.error('[GET /api/admin/orders/:id]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  router.put('/orders/:id/ship', async (req, res) => {
    try {
      const { carrier, trackingNumber } = req.body || {}
      if (!carrier || !trackingNumber) return res.status(400).json({ code: 400, message: '物流商和快递单号为必填项' })
      const ts = timestamp()
      const existing = await db.query(`SELECT f_id FROM t_shipment WHERE f_order_id = ? AND f_deleted = 0`, [req.params.id])
      if (existing.length > 0) {
        await db.execute(`UPDATE t_shipment SET f_carrier = ?, f_tracking_number = ?, f_updated_at = ? WHERE f_order_id = ? AND f_deleted = 0`, [carrier, trackingNumber, ts, req.params.id])
      } else {
        await db.execute(`INSERT INTO t_shipment (f_order_id, f_carrier, f_tracking_number, f_created_at, f_updated_at) VALUES (?, ?, ?, ?, ?)`, [req.params.id, carrier, trackingNumber, ts, ts])
      }
      await db.execute(`UPDATE t_order SET f_status_shipping = 10, f_updated_at = ? WHERE f_id = ?`, [ts, req.params.id])
      res.json({ code: 200, message: '发货成功' })
    } catch (err) {
      console.error('[PUT /api/admin/orders/:id/ship]', err.message)
      res.status(500).json({ code: 500, message: '发货失败' })
    }
  })

  return router
}

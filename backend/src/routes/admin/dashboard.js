const { Router } = require('express')
const { adminAuth } = require('./auth-guard')

module.exports = function createAdminDashboardRoutes({ db }) {
  const router = Router()
  router.use(adminAuth)

  router.get('/dashboard', async (req, res) => {
    try {
      const todayPrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const todayStart = parseInt(todayPrefix + '000000')
      const todayEnd = parseInt(todayPrefix + '235959')
      const [orderCount, revenue, productCount, pendingCount] = await Promise.all([
        db.query(`SELECT COUNT(*)::int AS cnt FROM t_order WHERE f_created_at >= ? AND f_created_at <= ?`, [todayStart, todayEnd]),
        db.query(`SELECT COALESCE(SUM(f_final_amount), 0)::numeric AS total FROM t_order WHERE f_created_at >= ? AND f_created_at <= ? AND f_status_payment = 10`, [todayStart, todayEnd]),
        db.query(`SELECT COUNT(*)::int AS cnt FROM t_product_spu WHERE f_deleted = 0`),
        db.query(`SELECT COUNT(*)::int AS cnt FROM t_order WHERE f_status_payment = 10 AND f_status_shipping = 1`),
      ])
      res.json({ code: 200, data: { todayOrders: orderCount[0]?.cnt || 0, todayRevenue: Number(revenue[0]?.total || 0), totalProducts: productCount[0]?.cnt || 0, pendingOrders: pendingCount[0]?.cnt || 0 } })
    } catch (err) {
      console.error('[GET /api/admin/dashboard]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  router.get('/dashboard/trends', async (req, res) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days || '7', 10), 1), 30)
      const rows = await db.query(
        `SELECT TO_CHAR(TO_TIMESTAMP(f_created_at::text, 'YYYYMMDDHH24MISS'), 'MM-DD') AS date, COUNT(*)::int AS orders, COALESCE(SUM(CASE WHEN f_status_payment = 10 THEN f_final_amount ELSE 0 END), 0)::numeric AS revenue FROM t_order WHERE f_created_at >= ? GROUP BY date ORDER BY date`,
        [parseInt(new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10).replace(/-/g, '') + '000000')]
      )
      res.json({ code: 200, data: rows.map(r => ({ date: r.date, orders: r.orders, revenue: Number(r.revenue) })) })
    } catch (err) {
      console.error('[GET /api/admin/dashboard/trends]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  return router
}

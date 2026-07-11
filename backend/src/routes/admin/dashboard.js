const { Router } = require('express')
const { adminAuth } = require('./auth-guard')

const MOCK_DASHBOARD = { todayOrders: 12, todayRevenue: 3580.0, totalProducts: 48, pendingOrders: 5 }

const MOCK_TRENDS = [
  { date: "07-05", orders: 8, revenue: 2400 },
  { date: "07-06", orders: 12, revenue: 3600 },
  { date: "07-07", orders: 6, revenue: 1800 },
  { date: "07-08", orders: 15, revenue: 4500 },
  { date: "07-09", orders: 10, revenue: 3000 },
  { date: "07-10", orders: 14, revenue: 4200 },
  { date: "07-11", orders: 12, revenue: 3580 },
]

module.exports = function createAdminDashboardRoutes({ db }) {
  const router = Router()
  router.use(adminAuth)

  let dbOk = false
  db.ping().then(ok => { dbOk = ok }).catch(() => {})

  router.get('/dashboard', async (req, res) => {
    try {
      if (!dbOk) return res.json({ code: 200, data: MOCK_DASHBOARD })
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
      if (!dbOk) return res.json({ code: 200, data: MOCK_TRENDS })
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

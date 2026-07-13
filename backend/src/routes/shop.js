const { Router } = require('express')
const { validate } = require('../middleware/validate')
const s = require('../schemas')

module.exports = function createShopRoutes({ db, auth, optionalAuth, timestamp }) {
  const router = Router()

  router.get('/products', optionalAuth, async (req, res) => {
    try {
      const { category } = req.query
      let sql = `SELECT spu.f_id, spu.f_name, spu.f_description, spu.f_category_id, spu.f_brand, spu.f_meta_info, spu.f_created_at,
         cat.f_code AS f_category_code, cat.f_name AS f_category_name,
         (SELECT MIN(sku.f_price) FROM t_product_sku sku WHERE sku.f_spu_id = spu.f_id) AS f_price
         FROM t_product_spu spu
         LEFT JOIN t_product_category cat ON cat.f_id = spu.f_category_id
         WHERE spu.f_deleted = 0`
      const params = []
      if (category) {
        if (isNaN(parseInt(category))) {
          sql += ' AND cat.f_code = ?'
        } else {
          sql += ' AND spu.f_category_id = ?'
        }
        params.push(category)
      }
      sql += ' ORDER BY spu.f_created_at DESC'

      const products = await db.query(sql, params)
      res.json({
        code: 200,
        data: products.map(p => {
          const meta = (typeof p.f_meta_info === 'string' ? JSON.parse(p.f_meta_info) : (p.f_meta_info || {}))
          const name = (typeof p.f_name === 'string' ? JSON.parse(p.f_name) : (p.f_name || {}))
          const catName = (typeof p.f_category_name === 'string' ? JSON.parse(p.f_category_name) : (p.f_category_name || {}))
          return {
            id: p.f_id,
            name: name['zh-CN'] || name['en-US'] || '',
            desc: p.f_description || '',
            category: p.f_category_id,
            categoryCode: p.f_category_code || '',
            categoryName: catName['zh-CN'] || catName['en-US'] || '',
            price: Number(p.f_price) || 0,
            image: meta.image_url || (Array.isArray(meta.images) ? meta.images[0] : ''),
            images: Array.isArray(meta.images) ? meta.images : [],
            detail: meta.detail || null,
          }
        }),
      })
    } catch (err) {
      console.error('[GET /api/products]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  router.get('/products/:id', optionalAuth, async (req, res) => {
    try {
      const products = await db.query(
        `SELECT spu.f_id, spu.f_name, spu.f_description, spu.f_category_id, spu.f_brand, spu.f_meta_info, spu.f_created_at,
         cat.f_code AS f_category_code, cat.f_name AS f_category_name,
         (SELECT MIN(sku.f_price) FROM t_product_sku sku WHERE sku.f_spu_id = spu.f_id) AS f_price
         FROM t_product_spu spu
         LEFT JOIN t_product_category cat ON cat.f_id = spu.f_category_id
         WHERE spu.f_id = ? AND spu.f_deleted = 0`,
        [req.params.id]
      )
      if (products.length === 0) return res.status(404).json({ code: 404, message: '商品不存在' })

      const p = products[0]
      const meta = (typeof p.f_meta_info === 'string' ? JSON.parse(p.f_meta_info) : (p.f_meta_info || {}))
      const name = (typeof p.f_name === 'string' ? JSON.parse(p.f_name) : (p.f_name || {}))
      const catName = (typeof p.f_category_name === 'string' ? JSON.parse(p.f_category_name) : (p.f_category_name || {}))
      res.json({
        code: 200,
        data: {
          id: p.f_id,
          name: name['zh-CN'] || name['en-US'] || '',
          desc: p.f_description || '',
          category: p.f_category_id,
          categoryCode: p.f_category_code || '',
          categoryName: catName['zh-CN'] || catName['en-US'] || '',
          price: Number(p.f_price) || 0,
          image: meta.image_url || (Array.isArray(meta.images) ? meta.images[0] : ''),
          images: Array.isArray(meta.images) ? meta.images : [],
          detail: meta.detail || null,
        },
      })
    } catch (err) {
      console.error('[GET /api/products/:id]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  router.get('/orders', auth, async (req, res) => {
    res.json({ code: 200, data: [] })
  })

  router.post('/orders', auth, validate(s.orderCreate), async (req, res) => {
    try {
      const { productId, skuId, productName, price, quantity, receiver = {} } = req.body
      const qty = Math.max(parseInt(quantity || 1, 10), 1)
      let unitPrice = Number(price || 0)
      let finalProductName = productName || ''

      if (skuId || /^\d+$/.test(String(productId || ''))) {
        try {
          const products = await db.query(
            `SELECT sku.f_id AS f_sku_id, sku.f_price, spu.f_name
             FROM t_product_sku sku
             LEFT JOIN t_product_spu spu ON spu.f_id = sku.f_spu_id
             WHERE sku.f_id = ? OR spu.f_id = ?
             ORDER BY sku.f_id ASC
             LIMIT 1`,
            [skuId || productId, productId || skuId]
          )
          if (products.length > 0) {
            unitPrice = Number(products[0].f_price) || unitPrice
            const name = typeof products[0].f_name === 'string' ? JSON.parse(products[0].f_name) : (products[0].f_name || {})
            finalProductName = name['zh-CN'] || name['en-US'] || finalProductName
          }
        } catch (e) {
          console.warn('[POST /api/orders] product price fallback:', e.message)
        }
      }

      if (!finalProductName || unitPrice <= 0) {
        return res.status(400).json({ code: 400, message: '商品信息不完整' })
      }

      const totalAmount = Number((unitPrice * qty).toFixed(2))
      const ts = timestamp()
      const orderNo = `ORD${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
      const result = await db.execute(
        `INSERT INTO t_order (
          f_user_id, f_order_no, f_total_amount, f_final_amount, f_payment_method,
          f_status_payment, f_receiver_name, f_receiver_phone, f_receiver_address,
          f_meta_info, f_created_at, f_updated_at
        ) VALUES (?, ?, ?, ?, 'wechat', 1, ?, ?, ?, ?, ?, ?)
        RETURNING f_id`,
        [
          req.userId, orderNo, totalAmount, totalAmount,
          receiver.name || '待填写',
          receiver.phone || '00000',
          receiver.address || '待填写',
          JSON.stringify({ productName: finalProductName, productId, skuId: skuId || null, quantity: qty }),
          ts, ts,
        ]
      )
      const orderId = result.insertId || (result.rows && result.rows[0] && result.rows[0].f_id)

      try {
        if (skuId) {
          await db.execute(
            `INSERT INTO t_order_item (
              f_order_id, f_sku_id, f_product_name, f_quantity, f_unit_price,
              f_total_price, f_final_price, f_meta_info, f_created_at, f_updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, skuId, finalProductName, qty, unitPrice, totalAmount, totalAmount, JSON.stringify({ productId }), ts, ts]
          )
        } else {
          await db.execute(
            `INSERT INTO t_order_item (f_order_id, f_product_name, f_quantity, f_unit_price, f_total_price, f_created_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [orderId, finalProductName, qty, unitPrice, totalAmount, ts]
          )
        }
      } catch (e) {
        console.warn('[POST /api/orders] order item skipped:', e.message)
      }

      res.json({
        code: 200,
        data: { id: orderId, orderNo, status: 'pending', amount: totalAmount, createdAt: ts },
      })
    } catch (err) {
      console.error('[POST /api/orders]', err.message)
      res.status(500).json({ code: 500, message: '下单失败' })
    }
  })

  router.get('/orders/:id/payment-status', auth, async (req, res) => {
    try {
      const rows = await db.query(
        `SELECT o.f_id, o.f_order_no, o.f_status_payment, ps.f_code AS f_payment_status
         FROM t_order o
         LEFT JOIN t_payment_status ps ON ps.f_id = o.f_status_payment
         WHERE o.f_id = ? AND o.f_user_id = ?`,
        [req.params.id, req.userId]
      )
      if (rows.length === 0) return res.status(404).json({ code: 404, message: '订单不存在' })

      const order = rows[0]
      res.json({
        code: 200,
        data: {
          id: order.f_id,
          orderNo: order.f_order_no,
          status: order.f_payment_status || (order.f_status_payment === 10 ? 'paid' : 'pending'),
        },
      })
    } catch (err) {
      console.error('[GET /api/orders/:id/payment-status]', err.message)
      res.status(500).json({ code: 500, message: '查询支付状态失败' })
    }
  })

  router.post('/orders/:id/cancel', auth, async (req, res) => {
    res.json({ code: 200, data: { success: true } })
  })

  router.post('/orders/:id/complete', auth, async (req, res) => {
    res.json({ code: 200, data: { success: true } })
  })

  return router
}

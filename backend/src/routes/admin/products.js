const { Router } = require('express')
const { adminAuth } = require('./auth-guard')

module.exports = function createAdminProductsRoutes({ db, timestamp }) {
  const router = Router()
  router.use(adminAuth)

  router.get('/products', async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page || '1', 10), 1)
      const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10), 1), 100)
      const search = req.query.search || ''
      const category = req.query.category || ''
      const offset = (page - 1) * pageSize

      let countSql = `SELECT COUNT(*)::int AS total FROM t_product_spu WHERE f_deleted = 0`
      let dataSql = `SELECT spu.f_id, spu.f_name, spu.f_category_id, spu.f_brand, spu.f_meta_info, spu.f_created_at,
        (SELECT MIN(sku.f_price) FROM t_product_sku sku WHERE sku.f_spu_id = spu.f_id) AS f_price
        FROM t_product_spu spu WHERE spu.f_deleted = 0`
      const params = []
      const countParams = []

      if (search) {
        const clause = ` AND (spu.f_name::text ILIKE ? OR spu.f_brand ILIKE ?)`
        dataSql += clause; countSql += clause
        const p = `%${search}%`
        params.push(p, p); countParams.push(p, p)
      }
      if (category) {
        const clause = ` AND spu.f_category_id = ?`
        dataSql += clause; countSql += clause
        params.push(category); countParams.push(category)
      }
      dataSql += ` ORDER BY spu.f_created_at DESC LIMIT ? OFFSET ?`
      params.push(pageSize, offset)

      const [totalRows, productRows] = await Promise.all([
        db.query(countSql, countParams),
        db.query(dataSql, params),
      ])
      const total = totalRows[0]?.total || 0
      const categoryIds = [...new Set(productRows.map(p => p.f_category_id).filter(Boolean))]
      let categoryMap = new Map()
      if (categoryIds.length > 0) {
        const catRows = await db.query(`SELECT f_id, f_name FROM t_product_category WHERE f_id = ANY(?)`, [categoryIds])
        catRows.forEach(c => { const n = typeof c.f_name === 'string' ? JSON.parse(c.f_name) : (c.f_name || {}); categoryMap.set(c.f_id, n['zh-CN'] || n['en-US'] || '') })
      }
      const list = productRows.map(p => {
        const meta = typeof p.f_meta_info === 'string' ? JSON.parse(p.f_meta_info) : (p.f_meta_info || {})
        const name = typeof p.f_name === 'string' ? JSON.parse(p.f_name) : (p.f_name || {})
        return { id: p.f_id, nameZh: name['zh-CN'] || '', nameEn: name['en-US'] || '', categoryName: categoryMap.get(p.f_category_id) || '', categoryId: p.f_category_id, price: Number(p.f_price) || 0, status: 'active', imageUrl: meta.image_url || '', createdAt: String(p.f_created_at || '') }
      })
      res.json({ code: 200, data: { list, total, page, pageSize } })
    } catch (err) {
      console.error('[GET /api/admin/products]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  router.get('/products/:id', async (req, res) => {
    try {
      const rows = await db.query(
        `SELECT spu.f_id, spu.f_name, spu.f_description, spu.f_category_id, spu.f_brand, spu.f_meta_info, spu.f_created_at FROM t_product_spu spu WHERE spu.f_id = ? AND spu.f_deleted = 0`,
        [req.params.id]
      )
      if (rows.length === 0) return res.status(404).json({ code: 404, message: '商品不存在' })
      const p = rows[0]
      const meta = typeof p.f_meta_info === 'string' ? JSON.parse(p.f_meta_info) : (p.f_meta_info || {})
      const name = typeof p.f_name === 'string' ? JSON.parse(p.f_name) : (p.f_name || {})
      const desc = typeof p.f_description === 'string' ? JSON.parse(p.f_description) : (p.f_description || {})
      const skuRows = await db.query(`SELECT f_id, f_sku_code, f_price, f_cost_price, f_weight FROM t_product_sku WHERE f_spu_id = ? ORDER BY f_id`, [p.f_id])
      const skus = skuRows.map(s => ({ id: s.f_id, skuCode: s.f_sku_code, price: Number(s.f_price) || 0, costPrice: s.f_cost_price ? Number(s.f_cost_price) : undefined, weight: s.f_weight ? Number(s.f_weight) : undefined }))
      res.json({ code: 200, data: { id: p.f_id, nameZh: name['zh-CN'] || '', nameEn: name['en-US'] || '', descZh: desc['zh-CN'] || '', descEn: desc['en-US'] || '', categoryId: p.f_category_id, brand: p.f_brand || '', imageUrl: meta.image_url || '', skus, createdAt: String(p.f_created_at || '') } })
    } catch (err) {
      console.error('[GET /api/admin/products/:id]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  router.post('/products', async (req, res) => {
    try {
      const { categoryId, brand, nameZh, nameEn, descZh, descEn, imageUrl, skus } = req.body || {}
      if (!nameZh || !categoryId || !skus || skus.length === 0) return res.status(400).json({ code: 400, message: '商品名称、分类和SKU为必填项' })
      const ts = timestamp()
      const meta = JSON.stringify({ image_url: imageUrl || '' })
      const name = JSON.stringify({ 'zh-CN': nameZh, 'en-US': nameEn || nameZh })
      const desc = JSON.stringify({ 'zh-CN': descZh || '', 'en-US': descEn || '' })
      const result = await db.execute(`INSERT INTO t_product_spu (f_category_id, f_brand, f_name, f_description, f_meta_info, f_created_at, f_updated_at) VALUES (?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?)`, [categoryId, brand || '', name, desc, meta, ts, ts])
      const spuId = result.insertId
      if (!spuId) return res.status(500).json({ code: 500, message: '创建商品失败' })
      for (const sku of skus) {
        if (sku.skuCode && sku.price) {
          await db.execute(`INSERT INTO t_product_sku (f_spu_id, f_sku_code, f_price, f_cost_price, f_weight, f_created_at, f_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [spuId, sku.skuCode, Number(sku.price), sku.costPrice ? Number(sku.costPrice) : null, sku.weight ? Number(sku.weight) : null, ts, ts])
        }
      }
      res.json({ code: 200, data: { id: spuId }, message: '创建成功' })
    } catch (err) {
      console.error('[POST /api/admin/products]', err.message)
      res.status(500).json({ code: 500, message: '创建失败' })
    }
  })

  router.put('/products/:id', async (req, res) => {
    try {
      const { categoryId, brand, nameZh, nameEn, descZh, descEn, imageUrl, skus } = req.body || {}
      if (!nameZh || !categoryId) return res.status(400).json({ code: 400, message: '商品名称和分类为必填项' })
      const ts = timestamp()
      const meta = JSON.stringify({ image_url: imageUrl || '' })
      const name = JSON.stringify({ 'zh-CN': nameZh, 'en-US': nameEn || nameZh })
      const desc = JSON.stringify({ 'zh-CN': descZh || '', 'en-US': descEn || '' })
      await db.execute(`UPDATE t_product_spu SET f_category_id = ?, f_brand = ?, f_name = ?::jsonb, f_description = ?::jsonb, f_meta_info = ?::jsonb, f_updated_at = ? WHERE f_id = ? AND f_deleted = 0`, [categoryId, brand || '', name, desc, meta, ts, req.params.id])
      if (skus && Array.isArray(skus)) {
        const existingSkus = await db.query(`SELECT f_id FROM t_product_sku WHERE f_spu_id = ?`, [req.params.id])
        const existingIds = existingSkus.map(s => s.f_id)
        for (const sku of skus) {
          if (sku.id && existingIds.includes(sku.id)) {
            await db.execute(`UPDATE t_product_sku SET f_sku_code = ?, f_price = ?, f_cost_price = ?, f_weight = ?, f_updated_at = ? WHERE f_id = ?`, [sku.skuCode, Number(sku.price), sku.costPrice ? Number(sku.costPrice) : null, sku.weight ? Number(sku.weight) : null, ts, sku.id])
          } else if (sku.skuCode && sku.price) {
            await db.execute(`INSERT INTO t_product_sku (f_spu_id, f_sku_code, f_price, f_cost_price, f_weight, f_created_at, f_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [req.params.id, sku.skuCode, Number(sku.price), sku.costPrice ? Number(sku.costPrice) : null, sku.weight ? Number(sku.weight) : null, ts, ts])
          }
        }
      }
      res.json({ code: 200, message: '更新成功' })
    } catch (err) {
      console.error('[PUT /api/admin/products/:id]', err.message)
      res.status(500).json({ code: 500, message: '更新失败' })
    }
  })

  router.delete('/products/:id', async (req, res) => {
    try {
      await db.execute(`UPDATE t_product_spu SET f_deleted = 1, f_updated_at = ? WHERE f_id = ?`, [timestamp(), req.params.id])
      res.json({ code: 200, message: '删除成功' })
    } catch (err) {
      console.error('[DELETE /api/admin/products/:id]', err.message)
      res.status(500).json({ code: 500, message: '删除失败' })
    }
  })

  return router
}

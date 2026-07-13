const { Router } = require('express')
const { adminAuth } = require('./auth-guard')

module.exports = function createAdminCategoriesRoutes({ db, timestamp }) {
  const router = Router()
  router.use(adminAuth)

  router.get('/categories', async (req, res) => {
    try {
      const rows = await db.query(
        `SELECT f_id, f_parent_id, f_level, f_code, f_name, f_icon_url, f_order FROM t_product_category WHERE f_deleted = 0 AND f_id != -1 ORDER BY f_order, f_id`
      )
      const list = rows.map(c => {
        const name = typeof c.f_name === 'string' ? JSON.parse(c.f_name) : (c.f_name || {})
        return { id: c.f_id, parentId: c.f_parent_id, level: c.f_level, code: c.f_code, nameZh: name['zh-CN'] || '', nameEn: name['en-US'] || '', iconUrl: c.f_icon_url || '', order: c.f_order }
      })
      res.json({ code: 200, data: list })
    } catch (err) {
      console.error('[GET /api/admin/categories]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  router.post('/categories', async (req, res) => {
    try {
      const { parentId, code, nameZh, nameEn, iconUrl, order } = req.body || {}
      if (!nameZh || !code) return res.status(400).json({ code: 400, message: '分类名称和编码为必填项' })
      const pid = parentId || -1
      let level = 0
      if (pid !== -1) { const pr = await db.query(`SELECT f_level FROM t_product_category WHERE f_id = ?`, [pid]); level = pr.length > 0 ? pr[0].f_level + 1 : 1 }
      const ts = timestamp()
      const name = JSON.stringify({ 'zh-CN': nameZh, 'en-US': nameEn || nameZh })
      const result = await db.execute(`INSERT INTO t_product_category (f_public_uid, f_parent_id, f_level, f_code, f_name, f_icon_url, f_order, f_created_at, f_updated_at) VALUES ((SELECT public.rpc_gen_uuid()), ?, ?, ?, ?::jsonb, ?, ?, ?, ?) RETURNING f_id`, [pid, level, code, name, iconUrl || '', order || 0, ts, ts])
      res.json({ code: 200, data: { id: result.insertId }, message: '创建成功' })
    } catch (err) {
      console.error('[POST /api/admin/categories]', err.message)
      res.status(500).json({ code: 500, message: '创建失败' })
    }
  })

  router.put('/categories/:id', async (req, res) => {
    try {
      const { code, nameZh, nameEn, iconUrl, order, parentId } = req.body || {}
      if (!nameZh) return res.status(400).json({ code: 400, message: '分类名称为必填项' })
      const ts = timestamp()
      const name = JSON.stringify({ 'zh-CN': nameZh, 'en-US': nameEn || nameZh })
      const uf = [`f_name = ?::jsonb`, `f_updated_at = ?`]; const pa = [name, ts]
      if (code !== undefined) { uf.push('f_code = ?'); pa.push(code) }
      if (iconUrl !== undefined) { uf.push('f_icon_url = ?'); pa.push(iconUrl) }
      if (order !== undefined) { uf.push('f_order = ?'); pa.push(Number(order)) }
      if (parentId !== undefined) { uf.push('f_parent_id = ?'); pa.push(parentId); const pr = await db.query(`SELECT f_level FROM t_product_category WHERE f_id = ?`, [parentId]); uf.push('f_level = ?'); pa.push(pr.length > 0 ? pr[0].f_level + 1 : 1) }
      pa.push(req.params.id)
      await db.execute(`UPDATE t_product_category SET ${uf.join(', ')} WHERE f_id = ? AND f_deleted = 0`, pa)
      res.json({ code: 200, message: '更新成功' })
    } catch (err) {
      console.error('[PUT /api/admin/categories/:id]', err.message)
      res.status(500).json({ code: 500, message: '更新失败' })
    }
  })

  router.delete('/categories/:id', async (req, res) => {
    try {
      const childRows = await db.query(`SELECT COUNT(*)::int AS cnt FROM t_product_category WHERE f_parent_id = ? AND f_deleted = 0`, [req.params.id])
      if (childRows[0]?.cnt > 0) return res.status(400).json({ code: 400, message: '该分类下存在子分类，请先删除子分类' })
      await db.execute(`UPDATE t_product_category SET f_deleted = 1, f_updated_at = ? WHERE f_id = ?`, [timestamp(), req.params.id])
      res.json({ code: 200, message: '删除成功' })
    } catch (err) {
      console.error('[DELETE /api/admin/categories/:id]', err.message)
      res.status(500).json({ code: 500, message: '删除失败' })
    }
  })

  return router
}

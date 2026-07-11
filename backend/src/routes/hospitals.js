const { Router } = require('express')

module.exports = function createHospitalRoutes({ db, optionalAuth }) {
  const router = Router()

  router.get('/', optionalAuth, async (req, res) => {
    try {
      const hospitals = await db.query(
        'SELECT f_id, f_name, f_address, f_phone, f_rating, f_service_tags, f_business_hours, f_meta_info FROM t_hospital WHERE f_deleted = 0 ORDER BY f_rating DESC'
      )
      res.json({
        code: 200,
        data: hospitals.map(h => {
          const meta = (typeof h.f_meta_info === 'string' ? JSON.parse(h.f_meta_info) : (h.f_meta_info || {}));
          return {
            id: h.f_id,
            name: h.f_name,
            address: h.f_address || '',
            phone: h.f_phone || '',
            rating: Number(h.f_rating) || 0,
            tags: (Array.isArray(h.f_service_tags) ? h.f_service_tags : (typeof h.f_service_tags === 'string' ? JSON.parse(h.f_service_tags) : [])),
            businessHours: h.f_business_hours || '',
            image: meta.image_url || '',
            lat: meta.lat || null,
            lng: meta.lng || null,
          }
        }),
      })
    } catch (err) {
      console.error('[GET /api/hospitals]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  router.get('/:id', optionalAuth, async (req, res) => {
    try {
      const hospitals = await db.query('SELECT f_id, f_name, f_address, f_phone, f_rating, f_service_tags, f_business_hours, f_meta_info, f_created_at FROM t_hospital WHERE f_id = ? AND f_deleted = 0', [req.params.id])
      if (hospitals.length === 0) return res.status(404).json({ code: 404, message: '医院不存在' })

      const h = hospitals[0]
      const hmeta = (typeof h.f_meta_info === 'string' ? JSON.parse(h.f_meta_info) : (h.f_meta_info || {}));
      res.json({
        code: 200,
        data: {
          id: h.f_id, name: h.f_name, address: h.f_address || '', phone: h.f_phone || '',
          rating: Number(h.f_rating) || 0,
          tags: (Array.isArray(h.f_service_tags) ? h.f_service_tags : (typeof h.f_service_tags === 'string' ? JSON.parse(h.f_service_tags) : [])),
          businessHours: h.f_business_hours || '',
          image: hmeta.image_url || '', lat: hmeta.lat || null, lng: hmeta.lng || null,
        },
      })
    } catch (err) {
      console.error('[GET /api/hospitals/:id]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  return router
}

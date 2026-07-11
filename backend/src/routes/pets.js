const { Router } = require('express')
const { validate } = require('../middleware/validate')
const s = require('../schemas')

module.exports = function createPetRoutes({ db, auth, optionalAuth, uuid, timestamp }) {
  const router = Router()

  router.get('/', optionalAuth, async (req, res) => {
    try {
      if (!req.userId) return res.json({ code: 200, data: [] })
      const pets = await db.query(
        `SELECT p.f_id, p.f_public_uid, p.f_name, p.f_avatar_url, p.f_pet_type_id, p.f_breed_id, p.f_gender_id,
                p.f_birth_date, p.f_birth_year, p.f_birth_month, p.f_weight, p.f_sterilized, p.f_vaccinated,
                p.f_status_pet, p.f_personality_tags, p.f_created_at,
                pt.f_name AS f_pet_type_name,
                g.f_name AS f_gender_name
         FROM t_pet p
         LEFT JOIN t_pet_type pt ON pt.f_id = p.f_pet_type_id
         LEFT JOIN t_gender g ON g.f_id = p.f_gender_id
         WHERE p.f_user_id = $1 AND p.f_deleted = 0
         ORDER BY p.f_created_at DESC`,
        [req.userId]
      )

      const result = pets.map(p => {
        const ptName = typeof p.f_pet_type_name === 'string' ? JSON.parse(p.f_pet_type_name) : (p.f_pet_type_name || {})
        const gName = typeof p.f_gender_name === 'string' ? JSON.parse(p.f_gender_name) : (p.f_gender_name || {})
        return {
          id: p.f_id,
          publicUid: p.f_public_uid,
          name: p.f_name,
          avatar: p.f_avatar_url || '',
          petTypeId: p.f_pet_type_id,
          petType: ptName['zh-CN'] || ptName['en-US'] || '',
          breedId: p.f_breed_id,
          genderId: p.f_gender_id,
          gender: gName['zh-CN'] || gName['en-US'] || '',
          birthDate: p.f_birth_date,
          birthYear: p.f_birth_year,
          birthMonth: p.f_birth_month,
          weight: p.f_weight,
          sterilized: !!p.f_sterilized,
          vaccinated: !!p.f_vaccinated,
          statusPet: p.f_status_pet,
          tags: typeof p.f_personality_tags === 'string' ? JSON.parse(p.f_personality_tags) : p.f_personality_tags,
          createdAt: p.f_created_at,
        }
      })

      res.json({ code: 200, data: result })
    } catch (err) {
      console.error('[GET /api/pets]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  router.get('/:id', auth, async (req, res) => {
    try {
      const pets = await db.query(
        `SELECT p.*, pt.f_name AS f_pet_type_name, g.f_name AS f_gender_name
         FROM t_pet p
         LEFT JOIN t_pet_type pt ON pt.f_id = p.f_pet_type_id
         LEFT JOIN t_gender g ON g.f_id = p.f_gender_id
         WHERE p.f_id = $1 AND p.f_user_id = $2 AND p.f_deleted = 0`,
        [req.params.id, req.userId]
      )
      if (pets.length === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })

      const p = pets[0]
      const ptName = typeof p.f_pet_type_name === 'string' ? JSON.parse(p.f_pet_type_name) : (p.f_pet_type_name || {})
      const gName = typeof p.f_gender_name === 'string' ? JSON.parse(p.f_gender_name) : (p.f_gender_name || {})

      res.json({
        code: 200,
        data: {
          id: p.f_id,
          name: p.f_name,
          avatar: p.f_avatar_url || '',
          petTypeId: p.f_pet_type_id,
          petType: ptName['zh-CN'] || ptName['en-US'] || '',
          breedId: p.f_breed_id,
          genderId: p.f_gender_id,
          gender: gName['zh-CN'] || gName['en-US'] || '',
          birthDate: p.f_birth_date,
          birthYear: p.f_birth_year,
          birthMonth: p.f_birth_month,
          weight: p.f_weight,
          sterilized: !!p.f_sterilized,
          vaccinated: !!p.f_vaccinated,
          statusPet: p.f_status_pet,
          tags: typeof p.f_personality_tags === 'string' ? JSON.parse(p.f_personality_tags) : p.f_personality_tags,
          createdAt: p.f_created_at,
        },
      })
    } catch (err) {
      console.error('[GET /api/pets/:id]', err.message)
      res.status(500).json({ code: 500, message: '查询失败' })
    }
  })

  router.post('/', auth, validate(s.petCreate), async (req, res) => {
    try {
      const { name, petTypeId, breedId, genderId, birthDate, birthYear, birthMonth, weight, sterilized, vaccinated, avatar, tags } = req.body
      if (!name) return res.status(400).json({ code: 400, message: '宠物名称不能为空' })

      const publicUid = uuid()
      const ts = timestamp()
      const result = await db.execute(
        `INSERT INTO t_pet (f_public_uid, f_user_id, f_name, f_avatar_url, f_pet_type_id, f_breed_id, f_gender_id, f_birth_date, f_birth_year, f_birth_month, f_weight, f_sterilized, f_vaccinated, f_personality_tags, f_status_id, f_created_at, f_updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?, ?)`,
        [
          publicUid, req.userId, name, avatar || '',
          petTypeId || 1, breedId || null, genderId || -1,
          birthDate || null, birthYear || null, birthMonth || null,
          weight || null, sterilized ? 1 : 0, vaccinated ? 1 : 0,
          JSON.stringify(tags || []),
          ts, ts,
        ]
      )

      res.json({
        code: 200,
        data: {
          id: result.insertId,
          publicUid,
          name,
          avatar: avatar || '',
          petTypeId: petTypeId || 1,
          breedId: breedId || null,
          genderId: genderId || -1,
          birthDate: birthDate || null,
          weight: weight || null,
          sterilized: !!sterilized,
          vaccinated: !!vaccinated,
          tags: tags || [],
          createdAt: ts,
        },
      })
    } catch (err) {
      console.error('[POST /api/pets]', err.message)
      res.status(500).json({ code: 500, message: '创建失败' })
    }
  })

  router.put('/:id', auth, validate(s.petUpdate), async (req, res) => {
    try {
      const { name, petTypeId, breedId, genderId, birthDate, birthYear, birthMonth, weight, sterilized, vaccinated, avatar, tags } = req.body
      const ts = timestamp()

      const sets = []
      const params = []
      if (name !== undefined) { sets.push('f_name = ?'); params.push(name) }
      if (petTypeId !== undefined) { sets.push('f_pet_type_id = ?'); params.push(petTypeId) }
      if (breedId !== undefined) { sets.push('f_breed_id = ?'); params.push(breedId) }
      if (genderId !== undefined) { sets.push('f_gender_id = ?'); params.push(genderId) }
      if (birthDate !== undefined) { sets.push('f_birth_date = ?'); params.push(birthDate) }
      if (birthYear !== undefined) { sets.push('f_birth_year = ?'); params.push(birthYear) }
      if (birthMonth !== undefined) { sets.push('f_birth_month = ?'); params.push(birthMonth) }
      if (weight !== undefined) { sets.push('f_weight = ?'); params.push(weight) }
      if (sterilized !== undefined) { sets.push('f_sterilized = ?'); params.push(sterilized ? 1 : 0) }
      if (vaccinated !== undefined) { sets.push('f_vaccinated = ?'); params.push(vaccinated ? 1 : 0) }
      if (avatar !== undefined) { sets.push('f_avatar_url = ?'); params.push(avatar) }
      if (tags !== undefined) { sets.push('f_personality_tags = ?'); params.push(JSON.stringify(tags)) }
      sets.push('f_updated_at = ?'); params.push(ts)

      params.push(req.params.id, req.userId)

      const result = await db.execute(
        `UPDATE t_pet SET ${sets.join(', ')} WHERE f_id = ? AND f_user_id = ? AND f_deleted = 0`,
        params
      )

      if (result.affectedRows === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })

      res.json({ code: 200, data: { id: parseInt(req.params.id), updatedAt: ts } })
    } catch (err) {
      console.error('[PUT /api/pets/:id]', err.message)
      res.status(500).json({ code: 500, message: '更新失败' })
    }
  })

  router.delete('/:id', auth, async (req, res) => {
    try {
      const ts = timestamp()
      const result = await db.execute(
        'UPDATE t_pet SET f_deleted = 1, f_updated_at = ? WHERE f_id = ? AND f_user_id = ?',
        [ts, req.params.id, req.userId]
      )
      if (result.affectedRows === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })
      res.json({ code: 200, data: null })
    } catch (err) {
      console.error('[DELETE /api/pets/:id]', err.message)
      res.status(500).json({ code: 500, message: '删除失败' })
    }
  })

  return router
}

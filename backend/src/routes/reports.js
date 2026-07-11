const { Router } = require('express')
const { validate } = require('../middleware/validate')
const s = require('../schemas')

module.exports = function createReportRoutes({ db, agents, auth, uuid, timestamp, now }) {
  const router = Router()

  router.post('/emotion-report', auth, validate(s.emotionReport), async (req, res) => {
    try {
      const { petId, question, divSystem, numbers, imageUrl, reportType } = req.body
      const userId = req.userId

      const pets = await db.query('SELECT f_id, f_name, f_avatar_url, f_pet_type_id, f_gender_id, f_birth_date, f_weight FROM t_pet WHERE f_id = ? AND f_user_id = ?', [petId, userId])
      if (pets.length === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })

      const pet = pets[0]

      const types = await db.query('SELECT f_name FROM t_pet_type WHERE f_id = ?', [pet.f_pet_type_id])
      const petTypeName = types.length > 0 ? ((typeof types[0].f_name === 'string' ? JSON.parse(types[0].f_name) : (types[0].f_name || {}))['zh-CN'] || '未知') : '未知'

      const mode = (numbers && numbers.length === 1) ? 'single' : 'multi'

      const report = await agents.get('mood').run({
        sessionId: 'emo_' + Date.now(),
        userMessage: question,
        petInfo: {
          name: pet.f_name,
          breed: petTypeName,
          age: pet.f_birth_date ? new Date().getFullYear() - new Date(pet.f_birth_date).getFullYear() : 3,
          question: question,
          divSystem: divSystem || 'liuyao',
          numbers: numbers || [],
        },
        mode,
      })

      const reportId = uuid()
      const ts = timestamp()
      await db.execute(
        `INSERT INTO t_report_emotion (f_public_uid, f_user_id, f_pet_id, f_lang, f_input_content, f_input_question, f_input_numbers, f_div_system, f_core_answer, f_core_basis, f_food_satisfaction, f_mood_level, f_body_status, f_status_summary, f_owner_view, f_pet_message, f_pet_wish, f_product_recommend, f_llm_resp, f_status, f_created_at)
         VALUES (?, ?, ?, 'zh-CN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?)`,
        [
          reportId, userId, petId,
          question || '', question || '',
          JSON.stringify(numbers || []),
          divSystem || '',
          report.coreAnswer || '', report.coreBasis || '',
          report.foodSatisfaction || '★★★☆☆', report.moodLevel || '★★★☆☆',
          report.bodyStatus || '', report.statusSummary || '',
          report.ownerView || '', report.petMessage || '',
          report.petWish || '',
          report.products ? JSON.stringify(report.products) : null,
          JSON.stringify(report),
          ts,
        ]
      )

      return res.json({
        code: 200,
        data: {
          id: reportId,
          petId: pet.f_id,
          petName: pet.f_name,
          petAvatar: pet.f_avatar_url || '',
          type: 'emotion',
          typeName: '情绪解读',
          divSystem: divSystem || 'liuyao',
          ...report,
          createdAt: now(),
        },
      })
    } catch (err) {
      console.error('[emotion-report] error:', err.message)
      return res.status(500).json({ code: 500, message: '报告生成失败' })
    }
  })

  router.post('/health-report', auth, validate(s.healthReport), async (req, res) => {
    try {
      const { petId, symptom, duration, abnormal, numbers, imageUrl } = req.body
      const userId = req.userId

      const pets = await db.query('SELECT f_id, f_name, f_pet_type_id, f_birth_date, f_weight, f_sterilized, f_vaccinated FROM t_pet WHERE f_id = ? AND f_user_id = ?', [petId, userId])
      if (pets.length === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })

      const pet = pets[0]

      const report = await agents.get('health').run({
        sessionId: 'hlth_' + Date.now(),
        userMessage: symptom || '',
        petInfo: {
          name: pet.f_name,
          birthDate: pet.f_birth_date,
          weight: pet.f_weight,
          sterilized: pet.f_sterilized,
          vaccinated: pet.f_vaccinated,
          symptom: symptom || '',
          duration: duration || '',
          abnormal: abnormal || '',
          numbers: numbers || [],
          imageUrl: imageUrl || '',
        },
      })

      const reportId = uuid()
      const ts = timestamp()
      await db.execute(
        `INSERT INTO t_report_health (f_public_uid, f_user_id, f_pet_id, f_lang, f_input_content, f_input_question, f_input_numbers, f_div_system, f_core_answer, f_core_basis, f_health_score, f_health_level, f_symptom_analysis, f_diet_advice, f_exercise_advice, f_care_tips, f_vet_advice, f_llm_resp, f_status, f_created_at)
         VALUES (?, ?, ?, 'zh-CN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?)`,
        [
          reportId, userId, petId,
          symptom || '', symptom || '',
          JSON.stringify(numbers || []),
          '',
          report.coreAnswer || report.currentSymptoms || '',
          report.coreBasis || '',
          (typeof report.healthScore === 'string' ? (report.healthScore.match(/★/g) || []).length * 20 : (report.healthScore || 80)),
          report.healthLevel || 'normal',
          report.symptomAnalysis || report.currentSymptoms || '',
          report.dietAdvice || '',
          report.exerciseAdvice || '',
          (report.carePlan || []).map(p => `${p.title}: ${p.desc}`).join('\n'),
          report.emergency || '',
          JSON.stringify(report),
          ts,
        ]
      )

      return res.json({
        code: 200,
        data: {
          id: reportId,
          petId: pet.f_id,
          petName: pet.f_name,
          type: 'health',
          typeName: '健康监测',
          ...report,
          createdAt: now(),
        },
      })
    } catch (err) {
      console.error('[health-report] error:', err.message)
      return res.status(500).json({ code: 500, message: '报告生成失败' })
    }
  })

  router.post('/risk-report', auth, validate(s.riskReport), async (req, res) => {
    try {
      const { petId, ownerBirthday, reportId, tongueImage } = req.body
      const userId = req.userId

      const pets = await db.query('SELECT f_id, f_name, f_pet_type_id, f_birth_date, f_weight FROM t_pet WHERE f_id = ? AND f_user_id = ?', [petId, userId])
      if (pets.length === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })

      const pet = pets[0]

      const report = await agents.get('risk').run({
        sessionId: 'risk_' + Date.now(),
        userMessage: `主人信息: 生日${ownerBirthday}`,
        petInfo: {
          name: pet.f_name,
          birthDate: pet.f_birth_date,
          weight: pet.f_weight,
          ownerBirthday: ownerBirthday || '',
          tongueImage: tongueImage || '',
        },
      })

      const riskId = uuid()
      const ts = timestamp()
      await db.execute(
        `INSERT INTO t_report_risk (f_public_uid, f_user_id, f_pet_id, f_lang, f_input_content, f_input_question, f_input_numbers, f_div_system, f_core_answer, f_core_basis, f_risk_level, f_risk_score, f_risk_factors, f_prevention, f_emergency_guide, f_llm_resp, f_status, f_created_at)
         VALUES (?, ?, ?, 'zh-CN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?)`,
        [
          riskId, userId, petId,
          ownerBirthday || '', ownerBirthday || '',
          '[]',
          '',
          report.coreAnswer || report.petImbalance || '',
          report.coreBasis || '',
          report.riskLevel || 'medium',
          report.riskScore || 50,
          report.riskFactors ? JSON.stringify(report.riskFactors) : null,
          report.prevention || report.recommendations?.join('\n') || '',
          report.emergencyGuide || report.medicalAdvice || '',
          JSON.stringify(report),
          ts,
        ]
      )

      return res.json({
        code: 200,
        data: {
          id: riskId,
          petId: pet.f_id,
          petName: pet.f_name,
          type: 'risk',
          typeName: '风险评估',
          ...report,
          createdAt: now(),
        },
      })
    } catch (err) {
      console.error('[risk-report] error:', err.message)
      return res.status(500).json({ code: 500, message: '报告生成失败' })
    }
  })

  router.post(['/constitution/report', '/api/constitution/report'], auth, validate(s.constitutionReport), async (req, res) => {
    try {
      const { petId, ownerBirthday } = req.body
      const userId = req.userId

      const pets = await db.query('SELECT f_id, f_name FROM t_pet WHERE f_id = ? AND f_user_id = ?', [petId, userId])
      if (pets.length === 0) return res.status(404).json({ code: 404, message: '宠物不存在' })

      const pet = pets[0]
      const report = await agents.get('constitution').run({
        sessionId: 'const_' + Date.now(),
        userMessage: '',
        petInfo: { name: pet.f_name, ownerBirthday: ownerBirthday || '' },
      })

      const reportId = uuid()
      const ts = timestamp()
      await db.execute(
        `INSERT INTO t_report_constitution (f_public_uid, f_user_id, f_pet_id, f_lang, f_input_content, f_owner_birthday, f_core_answer, f_pet_constitution, f_owner_match, f_season_advice, f_diet_advice, f_llm_resp, f_status, f_created_at)
         VALUES (?, ?, ?, 'zh-CN', ?, ?, ?, ?, ?, ?, ?, ?, 10, ?)`,
        [
          reportId, userId, petId,
          ownerBirthday || '', ownerBirthday || '',
          report.coreAnswer || report.petConstitution || '',
          report.petConstitution || '',
          report.ownerMatch || '',
          report.seasonAdvice || '',
          report.dietAdvice || '',
          JSON.stringify(report),
          ts,
        ]
      )

      return res.json({ code: 200, data: { id: reportId, type: 'constitution', typeName: '体质综合分析', ...report, petName: pet.f_name, createdAt: now() } })
    } catch (err) {
      console.error('[constitution] error:', err.message)
      return res.status(500).json({ code: 500, message: '分析生成失败' })
    }
  })

  router.post(['/newpet/guide', '/api/newpet/guide'], auth, async (req, res) => {
    try {
      const report = await agents.get('newpet').run({
        sessionId: 'newpet_' + Date.now(),
        userMessage: JSON.stringify(req.body),
        petInfo: req.body,
      })
      return res.json({ code: 200, data: report })
    } catch (err) {
      console.error('[newpet] error:', err.message)
      return res.status(500).json({
        code: 500, message: '建议生成失败',
        data: { summary: '暂时无法生成建议，请稍后重试。', recommendations: [], disclaimer: '领养代替购买。' },
      })
    }
  })

  router.post(['/medical/guide', '/api/medical/guide'], auth, validate(s.medicalGuide), async (req, res) => {
    try {
      const report = await agents.get('consultation').run({
        sessionId: 'medical_' + Date.now(),
        userMessage: JSON.stringify(req.body),
        petInfo: req.body,
      })

      try {
        const reportId = uuid()
        const ts = timestamp()
        const { petId } = req.body
        await db.execute(
          `INSERT INTO t_report_consultation (f_public_uid, f_user_id, f_pet_id, f_lang, f_report_type_id, f_judgment, f_symptom_explain, f_home_care, f_warning_sign, f_hospital_check, f_llm_resp, f_llm_input, f_status, f_created_at)
           VALUES (?, ?, ?, 'zh-CN', 8, ?, ?, ?, ?, ?, ?, ?, 10, ?)`,
          [
            reportId, req.userId, petId || null,
            report.judgment || '',
            report.symptomExplain || '',
            report.homeCare ? JSON.stringify(report.homeCare) : null,
            report.warningSign ? JSON.stringify(report.warningSign) : null,
            report.hospitalCheck ? JSON.stringify(report.hospitalCheck) : null,
            JSON.stringify(report),
            JSON.stringify(req.body),
            ts,
          ]
        )
        return res.json({ code: 200, data: { id: reportId, type: 'medical', typeName: '医疗科普', ...report } })
      } catch (dbErr) {
        console.error('[medical/guide] persist error:', dbErr.message)
        return res.status(500).json({ code: 500, message: '保存失败', data: { id: `${Date.now()}`, type: 'medical', typeName: '医疗科普', ...report } })
      }
    } catch (err) {
      console.error('[medical] error:', err.message)
      return res.status(500).json({
        code: 500, message: '咨询生成失败',
        data: { judgment: '暂时无法回答，建议咨询专业兽医。', disclaimer: '以上内容为科普，不替代执业兽医面诊。' },
      })
    }
  })

  router.post(['/medical/followup', '/api/medical/followup'], auth, validate(s.medicalFollowup), async (req, res) => {
    try {
      const report = await agents.get('consultation').run({
        sessionId: req.body.sessionId || 'followup_' + Date.now(),
        userMessage: req.body.message || '',
        petInfo: req.body,
      })
      return res.json({ code: 200, data: report })
    } catch (err) {
      console.error('[medical-followup] error:', err.message)
      return res.status(500).json({ code: 500, message: '追问失败' })
    }
  })

  return router
}

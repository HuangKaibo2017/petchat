const API = require('../../utils/api')

Page({
  data: {
    type: '',
    // Common
    symptom: '',
    symptomImage: '',
    generating: false,
    generatingText: 'AI正在分析…',
    // Pet
    petNames: [],
    petIndex: 0,
    selectedPet: null,
    weight: '',
    num1: '', num2: '', num3: '',
    // Follow-up
    followUpQuestions: [],
    followUpAnswers: {},
    showFollowUp: false,
    hasFollowUpAnswers: false,
    // Medical guide response cache
    guideCache: null,
    followUpCount: 0,
  },

  onLoad(options) {
    if (options.type) this.setData({ type: options.type })
    this.loadPets()
  },

  onShow() { this.loadPets() },

  loadPets() {
    const app = getApp()
    const pets = app.globalData.pets || wx.getStorageSync('pets') || []
    const names = pets.map(p => p.name)
    this.setData({
      petNames: names,
      petIndex: 0,
      selectedPet: pets.length > 0 ? pets[0] : null,
    })
  },

  switchMode(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ type, generating: false, showFollowUp: false, guideCache: null })
    if (type === 'constitution' || type === 'medical') this.loadPets()
  },

  onPetChange(e) {
    const idx = parseInt(e.detail.value)
    const app = getApp()
    const pets = app.globalData.pets || wx.getStorageSync('pets') || []
    const pet = pets[idx]
    this.setData({ petIndex: idx, selectedPet: pet, weight: pet.weight || '' })
  },

  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) },
  onFieldInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) },

  chooseImage() {
    wx.chooseImage({
      count: 1, sizeType: ['compressed'],
      success: (res) => { this.setData({ symptomImage: res.tempFilePaths[0] }) }
    })
  },

  // ═══ 体质综合分析 ═══
  async generateConstitution() {
    const { selectedPet, weight, num1, num2, num3 } = this.data
    if (!selectedPet) return
    this.setData({ generating: true, generatingText: 'AI正在分析体质…' })
    const numbers = [num1, num2, num3].filter(Boolean).join(' ') || undefined
    const petData = { ...selectedPet }
    if (weight) petData.weight = weight
    try {
      const result = await API.Report.health({ petId: selectedPet.id, numbers })
      this.setData({ generating: false })
      wx.navigateTo({
        url: `/pages/medical/detail/detail?data=${encodeURIComponent(JSON.stringify({
          type: 'constitution', report: result.report || result, pet: petData,
        }))}`
      })
    } catch (err) {
      this.setData({ generating: false })
      wx.showToast({ title: err.message || '分析失败，请重试', icon: 'none' })
    }
  },

  // ═══ 医疗科普指南 ═══
  async generateMedicalGuide() {
    const { symptom, symptomImage, selectedPet } = this.data
    if (!symptom.trim()) return
    this.setData({ generating: true, generatingText: 'AI正在分析症状…', showFollowUp: false })

    try {
      let imageUrl = ''
      if (symptomImage) {
        try {
          const uploadRes = await API.Upload.upload(symptomImage, 'symptom')
          imageUrl = uploadRes.publicUrl || uploadRes.filePath || symptomImage
        } catch (e) { console.warn('Image upload failed:', e) }
      }

      const result = await API.post('/api/medical/guide', {
        petId: selectedPet ? selectedPet.id : undefined,
        symptom,
        answers: {},
        imageUrl: imageUrl || undefined,
      })

      const guideData = result.guide || result
      const followUpQuestions = result.followUpQuestions || []

      this.setData({
        generating: false,
        guideCache: guideData,
        followUpQuestions,
        showFollowUp: followUpQuestions.length > 0,
        followUpAnswers: {},
        hasFollowUpAnswers: false,
      })

      // Navigate to detail if no follow-up or skip
      if (followUpQuestions.length === 0) {
        this.navigateToDetail(guideData, selectedPet)
      }
    } catch (err) {
      this.setData({ generating: false })
      wx.showToast({ title: err.message || '生成失败，请重试', icon: 'none' })
    }
  },

  selectFollowUp(e) {
    const { qid, val } = e.currentTarget.dataset
    const answers = { ...this.data.followUpAnswers }
    answers[qid] = val
    const hasAnswers = this.data.followUpQuestions.every(q => answers[q.id])
    this.setData({ followUpAnswers: answers, hasFollowUpAnswers: hasAnswers })
  },

  async submitFollowUp() {
    const { symptom, symptomImage, selectedPet, guideCache, followUpAnswers } = this.data
    this.setData({ generating: true, generatingText: '结合补充信息重新分析…' })

    try {
      let imageUrl = ''
      if (symptomImage) {
        try {
          const uploadRes = await API.Upload.upload(symptomImage, 'symptom')
          imageUrl = uploadRes.publicUrl || uploadRes.filePath || symptomImage
        } catch (e) {}
      }

      const result = await API.post('/api/medical/guide', {
        petId: selectedPet ? selectedPet.id : undefined,
        symptom,
        answers: followUpAnswers,
        imageUrl: imageUrl || undefined,
      })

      const guideData = result.guide || result
      this.setData({ generating: false, showFollowUp: false, guideCache: guideData })
      this.navigateToDetail(guideData, selectedPet)
    } catch (err) {
      this.setData({ generating: false })
      wx.showToast({ title: err.message || '分析失败，请重试', icon: 'none' })
    }
  },

  navigateToDetail(guideData, pet) {
    wx.navigateTo({
      url: `/pages/medical/detail/detail?data=${encodeURIComponent(JSON.stringify({
        type: 'medical',
        guide: guideData,
        pet: pet || null,
      }))}`
    })
  },

  // ═══ 新宠购买指南 ═══
  async generateNewpetGuide() {
    const { symptom } = this.data
    if (!symptom.trim()) return
    this.setData({ generating: true, generatingText: 'AI正在匹配最适合你的宠物…' })
    try {
      const result = await API.post('/api/newpet/guide', { description: symptom })
      this.setData({ generating: false })
      wx.navigateTo({
        url: `/pages/medical/detail/detail?data=${encodeURIComponent(JSON.stringify({
          type: 'newpet',
          guide: result.guide || result,
        }))}`
      })
    } catch (err) {
      this.setData({ generating: false })
      wx.showToast({ title: err.message || '生成失败，请重试', icon: 'none' })
    }
  },
})

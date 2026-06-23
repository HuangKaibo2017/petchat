const app = getApp()
const API = require('../../utils/api')

Page({
  data: {
    pageTitle: '宠物心声解读',
    type: 'emotion',
    step: 0,
    pets: [],
    selectedPet: null,
    question: '',
    showQuestionHints: false,
    questionHints: [
      '为什么不爱动',
      '为什么总叫',
      '为什么躲起来',
      '对今天食物是否满意',
      '为啥这几天感觉它不太开心',
      '谁尿的'
    ],
    uploadImage: '',
    divSystem: 'liuyao',
    numberInputs: ['', '', '', '', '', ''],
    canSubmit: false,
    emotionMode: 'multi', singleNum: '', generating: false,
    selectedCards: [],
    tarotCards: ['🌟', '🌙', '☀️', '🌈', '🔥', '💧', '🌿', '⚡', '🦋', '🐉', '🔮', '💎']
  },

  onLoad(options) {
    this.loadPets()
  },

  onShow() { this.loadPets() },

  loadPets() {
    const pets = app.globalData.pets || wx.getStorageSync('pets') || []
    this.setData({ pets })
  },

  onSelectPet(e) {
    this.setData({ selectedPet: e.detail.pet })
  },

  nextStep() {
    if (!this.data.selectedPet) {
      wx.showToast({ title: '请先选择宠物', icon: 'none' })
      return
    }
    this.setData({ step: 1 })
  },

  onQuestionInput(e) {
    this.setData({ question: e.detail.value })
    this.checkCanSubmit()
  },

  toggleQuestionHints() {
    this.setData({ showQuestionHints: !this.data.showQuestionHints })
  },

  selectHint(e) {
    this.setData({
      question: e.currentTarget.dataset.hint,
      showQuestionHints: false
    })
    this.checkCanSubmit()
  },

  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      success: (res) => {
        this.setData({ uploadImage: res.tempFilePaths[0] })
      }
    })
  },

  selectDivSystem(e) {
    const system = e.currentTarget.dataset.system
    const count = system === 'liuyao' ? 6 : 3
    this.setData({
      divSystem: system,
      numberInputs: new Array(count).fill(''),
      selectedCards: []
    })
    this.checkCanSubmit()
  },

  onNumberInput(e) {
    const index = e.currentTarget.dataset.index
    const value = e.detail.value.slice(-1)
    const numberInputs = [...this.data.numberInputs]
    numberInputs[index] = value
    this.setData({ numberInputs })
    this.checkCanSubmit()
  },

  switchEmotionMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ emotionMode: mode })
    this.checkCanSubmit()
  },

  onSingleNumInput(e) {
    this.setData({ singleNum: e.detail.value.slice(-1) })
    this.checkCanSubmit()
  },

  checkCanSubmit() {
    const { question, divSystem, numberInputs, emotionMode, singleNum } = this.data
    let canSubmit = !!question.trim()
    if (emotionMode === 'single') {
      canSubmit = canSubmit && !!singleNum
    } else if (divSystem !== 'tarot') {
      canSubmit = canSubmit && numberInputs.every(n => n !== '')
    }
    this.setData({ canSubmit })
  },

  submitEmotion() {
    const { divSystem } = this.data
    if (divSystem === 'tarot') {
      this.setData({ step: 2 })
    } else {
      this.generateReport()
    }
  },

  selectTarotCard(e) {
    const index = e.currentTarget.dataset.index
    let selectedCards = [...this.data.selectedCards]
    if (selectedCards.includes(index)) {
      selectedCards = selectedCards.filter(i => i !== index)
    } else if (selectedCards.length < 3) {
      selectedCards.push(index)
    }
    this.setData({ selectedCards })
  },

  /**
   * Call real backend Edge Function to generate report
   */
  async generateReport() {
    const { selectedPet, question, divSystem, numberInputs, uploadImage, type } = this.data

    if (!app.globalData.isLoggedIn) {
      app.wxLogin().then(token => { if (token) this.generateReport() })
      return
    }

    this.setData({ generating: true })

    try {
      // Upload image first if present
      let imageUrl = ''
      if (uploadImage) {
        try {
          const uploadResult = await API.Upload.upload(uploadImage, 'report', selectedPet.id)
          imageUrl = uploadResult.publicUrl
        } catch (e) {
          console.warn('Image upload failed, proceeding without image:', e)
        }
      }

      const reportData = {
        petId: selectedPet.id,
        question,
        divSystem,
        numbers: divSystem === 'tarot' ? [] : numberInputs.filter(n => n),
        imageUrl,
        reportType: type,
      }

      const result = await API.Report.emotion(reportData)

      this.setData({ generating: false })

      app.globalData._reportData = result
        wx.navigateTo({ url: '/pages/emotion/report/report' })
    } catch (err) {
      this.setData({ generating: false })
      if (err.message === 'QUOTA_EXCEEDED') {
        wx.showModal({
          title: '次数已用完',
          content: '今日情绪解读次数已用完，明天再来吧~',
          showCancel: false,
        })
      } else if (err.message === 'UNAUTHORIZED') {
        app.wxLogin().then(token => { if (token) this.generateReport() })
      } else {
        wx.showToast({ title: err.message || '生成失败', icon: 'none' })
      }
    }
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/mine/register/register' })
  }
})

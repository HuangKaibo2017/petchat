const app = getApp()
const API = require('../../../utils/api')

Page({
  data: {
    sessionId: null,
    petId: null,
    petName: '',
    petAvatar: '',
    userAvatar: '',
    messages: [],
    inputText: '',
    sending: false
  },

  onLoad(options) {
    const sessionId = options.sessionId ? parseInt(options.sessionId) : null
    const petId = options.petId

    this.setData({ sessionId, petId })

    // 获取宠物信息
    const pets = app.globalData.pets || wx.getStorageSync('pets') || []
    const pet = pets.find(p => p.id === petId) || pets[0]
    if (pet) {
      this.setData({ petName: pet.name, petAvatar: pet.avatar || '' })
    }

    const userInfo = app.globalData.userInfo
    if (userInfo) this.setData({ userAvatar: userInfo.avatarUrl })

    // 加载历史消息或显示欢迎消息
    if (sessionId) {
      this.loadMessages(sessionId)
    } else {
      this.showWelcome()
    }
  },

  showWelcome() {
    this.setData({
      sessionId: Date.now(), // 本地会话 ID
      messages: [{
        id: Date.now(), role: 'pet',
        content: `汪汪！我是${this.data.petName || '你的宠物'}，今天想跟你聊聊天~ 你想跟我说什么呀？`,
        at: new Date().toISOString()
      }]
    })
  },

  async loadMessages(sessionId) {
    try {
      const res = await API.Chat.getMessages(sessionId)
      if (res && res.messages && res.messages.length) {
        this.setData({ messages: res.messages })
      } else {
        this.showWelcome()
      }
    } catch (e) {
      console.warn('加载消息失败，使用本地:', e)
      this.showWelcome()
    }
    setTimeout(() => this.scrollToBottom(), 200)
  },

  onInput(e) { this.setData({ inputText: e.detail.value }) },

  async sendMessage() {
    const text = this.data.inputText.trim()
    if (!text || this.data.sending) return

    const { sessionId, messages, petName } = this.data

    // 乐观添加用户消息
    const userMsg = { id: Date.now(), role: 'user', content: text, at: new Date().toISOString() }
    this.setData({
      messages: [...messages, userMsg],
      inputText: '',
      sending: true
    })
    setTimeout(() => this.scrollToBottom(), 100)

    try {
      const res = await API.Chat.send(sessionId, text)
      this.setData({
        messages: [
          ...this.data.messages.slice(0, -1),
          res.userMessage,
          res.petMessage
        ],
        sending: false
      })
      setTimeout(() => this.scrollToBottom(), 100)
    } catch (err) {
      // 兜底：本地生成回复
      const replies = [
        '主人你今天心情不错！我也很开心~',
        '我有点想吃零食了，能不能给我一点点？',
        '今天外面好热闹，我看到小鸟了！',
        '你摸摸我的头好不好，我喜欢你摸我。',
        '我感觉你今天有点累，要不要休息一下？'
      ]
      const reply = replies[Math.floor(Math.random() * replies.length)]
      const petMsg = { id: Date.now() + 1, role: 'pet', content: reply, at: new Date().toISOString() }
      this.setData({
        messages: [...this.data.messages, petMsg],
        sending: false
      })
      setTimeout(() => this.scrollToBottom(), 100)
    }
  },

  scrollToBottom() {
    wx.createSelectorQuery().select('#chatMessages').boundingClientRect().exec()
  }
})

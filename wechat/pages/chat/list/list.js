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
    const petId = options.petId ? parseInt(options.petId) : null

    this.setData({ sessionId, petId })

    // Get pet info
    const pets = app.globalData.pets || wx.getStorageSync('pets') || []
    const pet = pets.find(p => p.id === petId)
    if (pet) {
      this.setData({ petName: pet.name, petAvatar: pet.avatar || '' })
    }

    const userInfo = app.globalData.userInfo
    if (userInfo) this.setData({ userAvatar: userInfo.avatarUrl })

    if (sessionId) {
      this.loadMessages(sessionId)
    }
  },

  async loadMessages(sessionId) {
    try {
      const res = await API.Chat.getMessages(sessionId)
      if (res && res.messages) {
        this.setData({ messages: res.messages })
        setTimeout(() => this.scrollToBottom(), 200)
      }
    } catch (e) {
      console.warn('Failed to load messages:', e)
    }
  },

  onInput(e) { this.setData({ inputText: e.detail.value }) },

  async sendMessage() {
    const text = this.data.inputText.trim()
    if (!text || this.data.sending) return

    if (!app.globalData.isAuthorized) {
      app.requestAuth(() => this.sendMessage())
      return
    }

    const { sessionId, messages } = this.data
    if (!sessionId) {
      wx.showToast({ title: '会话异常', icon: 'none' })
      return
    }

    // Optimistically add user message
    const userMsg = { id: Date.now(), role: 'user', content: text, at: new Date().toISOString() }
    this.setData({
      messages: [...messages, userMsg],
      inputText: '',
      sending: true,
    })
    setTimeout(() => this.scrollToBottom(), 100)

    try {
      const res = await API.Chat.send(sessionId, text)

      // Replace optimistic message with server response
      this.setData({
        messages: [
          ...this.data.messages.slice(0, -1), // remove optimistic
          res.userMessage,
          res.petMessage,
        ],
        sending: false,
      })
      setTimeout(() => this.scrollToBottom(), 100)
    } catch (err) {
      this.setData({ sending: false })
      wx.showToast({ title: '发送失败', icon: 'none' })
    }
  },

  scrollToBottom() {
    wx.createSelectorQuery().select('#chatMessages').boundingClientRect().exec()
  },
})

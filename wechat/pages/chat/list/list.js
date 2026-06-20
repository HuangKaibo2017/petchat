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
    sending: false,
    streaming: false,
    scrollToId: ''
  },

  onLoad(options) {
    const sessionId = options.sessionId ? parseInt(options.sessionId) : null
    const petId = options.petId

    this.setData({ sessionId, petId })

    const pets = app.globalData.pets || wx.getStorageSync('pets') || []
    const pet = pets.find(p => p.id === petId || String(p.id) === String(petId)) || pets[0]
    if (pet) {
      this.setData({ petName: pet.name, petAvatar: pet.avatar || '' })
    }

    const userInfo = app.globalData.userInfo
    if (userInfo) this.setData({ userAvatar: userInfo.avatarUrl })

    if (sessionId) {
      this.loadMessages(sessionId)
    } else {
      this.showWelcome()
    }
  },

  showWelcome() {
    this.setData({
      sessionId: Date.now(),
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
    this.scrollToBottom()
  },

  onInput(e) { this.setData({ inputText: e.detail.value }) },

  async sendMessage() {
    const text = this.data.inputText.trim()
    if (!text || this.data.sending) return

    const { sessionId, messages } = this.data

    const userMsg = { id: Date.now(), role: 'user', content: text, at: new Date().toISOString() }
    const placeholderMsg = { id: Date.now() + 1, role: 'pet', content: '', at: new Date().toISOString(), streaming: true }
    this.setData({
      messages: [...messages, userMsg, placeholderMsg],
      inputText: '',
      sending: true,
      streaming: true
    })
    this.scrollToBottom()

    try {
      if (API.Chat.sendStream) {
        const result = await API.Chat.sendStream(sessionId, text, (token) => {
          const msgs = this.data.messages
          const last = msgs[msgs.length - 1]
          if (last && last.streaming) {
            last.content += token
            this.setData({ messages: msgs })
            this.scrollToBottom()
          }
        })

        const msgs = this.data.messages
        msgs.pop()
        if (result.petMessage) {
          msgs.push({ ...result.petMessage, streaming: false })
        }
        this.setData({ messages: msgs, sending: false, streaming: false })
        this.scrollToBottom()
      } else {
        const res = await API.Chat.send(sessionId, text)
        const msgs = this.data.messages
        msgs.pop()
        msgs.push(res.petMessage)
        this.setData({ messages: msgs, sending: false, streaming: false })
        this.scrollToBottom()
      }
    } catch (err) {
      console.warn('发送消息失败:', err)
      const replies = [
        '主人你今天心情不错！我也很开心~',
        '我有点想吃零食了，能不能给我一点点？',
        '今天外面好热闹，我看到小鸟了！',
        '你摸摸我的头好不好，我喜欢你摸我。',
        '我感觉你今天有点累，要不要休息一下？'
      ]
      const reply = replies[Math.floor(Math.random() * replies.length)]
      const petMsg = { id: Date.now() + 1, role: 'pet', content: reply, at: new Date().toISOString() }
      const msgs = this.data.messages
      msgs.pop()
      msgs.push(petMsg)
      this.setData({ messages: msgs, sending: false, streaming: false })
      this.scrollToBottom()
    }
  },

  scrollToBottom() {
    const msgs = this.data.messages
    if (msgs.length > 0) {
      const last = msgs[msgs.length - 1]
      this.setData({ scrollToId: `msg-${last.id}` })
    }
  }
})

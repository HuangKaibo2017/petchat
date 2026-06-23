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
    scrollToId: '',
    keyboardHeight: 0, petReaction: '', reactionAnim: null,
    isLocal: false
  },

  onLoad(options) {
    const sessionId = options.sessionId ? parseInt(options.sessionId) : null
    const petId = options.petId
    // 显式标记会话是否为本地离线会话（createSession 失败时兜底），不再靠 id 位数猜测
    const isLocal = options.local === '1' || options.local === 'true'

    this.setData({ sessionId, petId, isLocal })

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

  petPetting() {
    this.setData({ petReaction: '❤️' })
    setTimeout(() => this.setData({ petReaction: '' }), 1500)
    const userMsg = { id: Date.now(), role: 'user', content: '（轻轻抚摸了一下）', at: new Date().toISOString(), isAction: true }
    const petMsg = { id: Date.now() + 1, role: 'pet', content: '呜呜~好舒服！再摸摸~', at: new Date().toISOString() }
    this.setData({ messages: [...this.data.messages, userMsg, petMsg] })
    this.scrollToBottom()
  },

  petFeeding() {
    this.setData({ petReaction: '🍖' })
    setTimeout(() => this.setData({ petReaction: '' }), 1500)
    const feedItems = ['太好吃啦！再来一个！', '嗷呜~这是我最喜欢的零食！', '谢谢主人！我会更乖的~', '吧唧吧唧...满足！']
    const reply = feedItems[Math.floor(Math.random() * feedItems.length)]
    const userMsg = { id: Date.now(), role: 'user', content: '（投喂了零食）', at: new Date().toISOString(), isAction: true }
    const petMsg = { id: Date.now() + 1, role: 'pet', content: reply, at: new Date().toISOString() }
    this.setData({ messages: [...this.data.messages, userMsg, petMsg] })
    this.scrollToBottom()
  },

  goIoTBind() {
    wx.showModal({
      title: '智能家居绑定',
      content: '即将支持绑定MCP物联网智能家居设备（智能喂食器、饮水机、猫砂盆等），实现远程操控与数据监测。\n\n敬请期待！',
      showCancel: true,
      confirmText: '了解硬件',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/shop/shop' })
        }
      }
    })
  },

  onInput(e) { this.setData({ inputText: e.detail.value }) },

  onKeyboardHeightChange(e) {
    const h = e.detail.height
    this.setData({ keyboardHeight: h })
    if (h > 0) {
      setTimeout(() => this.scrollToBottom(), 150)
    }
  },

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

    // 显式标记优先；兼容旧入口（13位时间戳兜底 id）
    const isLocalSession = this.data.isLocal || (String(sessionId).length === 13 && sessionId > 1700000000000)

    try {
      if (isLocalSession) {
        // 纯本地会话：无后端，给一条本地回复，避免空气泡卡住
        throw new Error('LOCAL_SESSION')
      }

      const res = await API.Chat.send(sessionId, text)
      const petMessage = res && res.petMessage
        ? res.petMessage
        : { id: Date.now() + 1, role: 'pet', content: (res && res.reply) || '', at: new Date().toISOString() }

      if (!petMessage.content) throw new Error('EMPTY_REPLY')

      // 用真实回复替换末尾的占位气泡
      const msgs = this.data.messages
      if (msgs.length && msgs[msgs.length - 1].streaming) msgs.pop()
      msgs.push({ ...petMessage, streaming: false })
      this.setData({ messages: msgs, sending: false, streaming: false })
      this.scrollToBottom()
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
      // 只移除占位气泡（streaming），避免误删用户消息
      if (msgs.length && msgs[msgs.length - 1].streaming) msgs.pop()
      msgs.push(petMsg)
      this.setData({ messages: msgs, sending: false, streaming: false })
      this.scrollToBottom()
    } finally {
      // 安全网：无论成功失败，永不把 sending/streaming 卡在 true（否则后续发送会被静默拦截）
      if (this.data.sending || this.data.streaming) {
        this.setData({ sending: false, streaming: false })
      }
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

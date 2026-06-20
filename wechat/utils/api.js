const { MockAPI } = require('./mock')

// 开发模式：无后端时使用 mock 数据
const DEBUG = false

const app = getApp()

const request = (url, options = {}) => {
  const { method = 'GET', data = {}, needAuth = true } = options
  return new Promise((resolve, reject) => {
    const header = { 'Content-Type': 'application/json' }
    if (needAuth) {
      const token = wx.getStorageSync('token')
      if (token) { header['Authorization'] = `Bearer ${token}`; }
    }
    wx.request({
      url: `${app.globalData.baseUrl}${url}`,
      method,
      data,
      header,
      success: (res) => {
        if (res.statusCode === 200) {
          const body = res.data
          // Express server returns { code: 200, data: {...} }
          if (body && body.code === 200) {
            resolve(body.data)
          } else {
            // 兼容直接返回 data 的响应
            resolve(body)
          }
        } else if (res.statusCode === 401) {
          wx.removeStorageSync('token')
          app.globalData.isAuthorized = false
          reject(new Error('UNAUTHORIZED'))
        } else if (res.statusCode === 402) {
          reject(new Error('QUOTA_EXCEEDED'))
        } else {
          console.warn('[API]', url, 'HTTP', res.statusCode)
          reject(new Error((res.data && res.data.message) || '请求失败'))
        }
      },
      fail: (err) => {
        console.warn('[API]', url, 'network error:', err.errMsg)
        reject(err)
      }
    })
  })
};

// ─── 真实 API（连接 Express 后端） ───
const RealAPI = {
  get: (url, data) => request(url, { method: 'GET', data }),
  post: (url, data) => request(url, { method: 'POST', data }),
  put: (url, data) => request(url, { method: 'PUT', data }),
  delete: (url, data) => request(url, { method: 'DELETE', data }),

  // ═══ 报告接口 ═══
  Report: {
    emotion: async (data) => RealAPI.post('/api/emotion/report', data),
    health: async (data) => RealAPI.post('/api/health/report', data),
    risk: async (data) => RealAPI.post('/api/risk/report', data),
    medical: async (data) => RealAPI.post('/api/medical/guide', data),
    history: async (type) => RealAPI.get('/api/reports', { type }),
    detail: async (id) => RealAPI.get(`/api/reports/${id}`)
  },

  // ═══ 上传 ═══
  Upload: {
    upload: async (filePath, category, petId) => {
      return new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${app.globalData.baseUrl}/api/upload`,
          filePath,
          name: 'file',
          formData: { category, petId: petId || '' },
          header: {
            'Authorization': `Bearer ${wx.getStorageSync('token')}`
          },
          success: (res) => {
            try { resolve(JSON.parse(res.data)) }
            catch (e) { resolve({ publicUrl: filePath }) }
          },
          fail: (err) => {
            console.warn('[Upload] failed:', err)
            resolve({ publicUrl: filePath })
          }
        })
      })
    }
  },

  // ═══ 聊天 ═══
  Chat: {
    listSessions: async () => RealAPI.get('/api/chat/sessions'),
    createSession: async (petId) => RealAPI.post('/api/chat/sessions', { petId }),
    getMessages: async (sessionId) => RealAPI.get('/api/chat/sessions/' + sessionId + '/messages'),
    send: async (sessionId, text) => RealAPI.post('/api/chat/send-json', {
      sessionId, message: text
    }),
    // 流式聊天下个版本实现，当前等同于 send
    sendStream: async (sessionId, text, onToken) => {
      return RealAPI.post('/api/chat/send-json', { sessionId, message: text })
    }
  },

  // ═══ 收藏 ═══
  Favorite: {
    toggle: async (reportId, type) => RealAPI.post('/api/favorites/toggle', { reportId, type }),
    list: async () => RealAPI.get('/api/favorites')
  },

  // ═══ 宠物档案 ═══
  Pet: {
    create: async (data) => RealAPI.post('/api/pets', data),
    list: async () => RealAPI.get('/api/pets'),
    save: async (data) => RealAPI.post('/api/pets', data),
    update: async (id, data) => RealAPI.put(`/api/pets/${id}`, data),
    delete: async (id) => RealAPI.delete(`/api/pets/${id}`)
  },

  // ═══ 商城 ═══
  Product: {
    list: async (params) => RealAPI.get('/api/products', params),
    detail: async (id) => RealAPI.get(`/api/products/${id}`)
  },

  // ═══ 订单 ═══
  Order: {
    create: async (data) => RealAPI.post('/api/orders', data)
  },

  // ═══ 医院 ═══
  Hospital: {
    list: async (params) => RealAPI.get('/api/hospitals', params),
    detail: async (id) => RealAPI.get(`/api/hospitals/${id}`)
  },

  // ═══ 兼容旧版扁平 API ═══
  getEmotionReport: (data) => RealAPI.post('/api/emotion/report', data),
  getHealthReport: (data) => RealAPI.post('/api/health/report', data),
  getRiskReport: (data) => RealAPI.post('/api/risk/report', data),
  getMedicalGuide: (data) => RealAPI.post('/api/medical/guide', data),
  toggleFavorite: (reportId, type) => RealAPI.post('/api/favorites/toggle', { reportId, type }),
  getFavorites: () => RealAPI.get('/api/favorites'),
  getPets: () => RealAPI.get('/api/pets'),
  savePet: (data) => RealAPI.post('/api/pets', data),
  updatePet: (id, data) => RealAPI.put(`/api/pets/${id}`, data),
  deletePet: (id) => RealAPI.delete(`/api/pets/${id}`),
  getHistory: (type) => RealAPI.get('/api/reports', { type }),
  getReportDetail: (id) => RealAPI.get(`/api/reports/${id}`),
  getProducts: (params) => RealAPI.get('/api/products', params),
  getProductDetail: (id) => RealAPI.get(`/api/products/${id}`),
  createOrder: (data) => RealAPI.post('/api/orders', data),
  getHospitals: (params) => RealAPI.get('/api/hospitals', params),
  getHospitalDetail: (id) => RealAPI.get(`/api/hospitals/${id}`),
}

// Mock 命名空间版本（DEBUG=true 时使用）
const MockNamespaced = {
  ...MockAPI,
  Report: {
    emotion: async (data) => { const r = await MockAPI.getEmotionReport(data); return r.data },
    health: async (data) => { const r = await MockAPI.getHealthReport(data); return r.data },
    risk: async (data) => { const r = await MockAPI.getRiskReport(data); return r.data },
    medical: async (data) => { const r = await MockAPI.getMedicalGuide(data); return r.data },
    history: async (type) => { const r = await MockAPI.getHistory(type); return r.data },
    detail: async (id) => { const r = await MockAPI.getReportDetail(id); return r.data }
  },
  Upload: {
    upload: async (filePath) => ({ publicUrl: filePath })
  },
  Chat: {
    listSessions: async () => {
      const history = wx.getStorageSync('chatHistory') || []
      return { sessions: history }
    },
    createSession: async (petId) => {
      const id = Date.now()
      return { sessionId: id, petId }
    },
    getMessages: async (sessionId) => {
      return { messages: [{ id: Date.now(), role: 'pet', content: '汪汪！我是你的宠物，今天想跟你聊聊天~', at: new Date().toISOString() }] }
    },
    send: async (sessionId, text) => {
      const replies = ['主人你今天心情不错！我也很开心~', '我有点想吃零食了，能不能给我一点点？', '今天外面好热闹，我看到小鸟了！', '你摸摸我的头好不好，我喜欢你摸我。', '我感觉你今天有点累，要不要休息一下？']
      const reply = replies[Math.floor(Math.random() * replies.length)]
      return { userMessage: { id: Date.now(), role: 'user', content: text, at: new Date().toISOString() }, petMessage: { id: Date.now() + 1, role: 'pet', content: reply, at: new Date().toISOString() } }
    },
    sendStream: (sessionId, text, onToken) => MockNamespaced.Chat.send(sessionId, text)
  },
  Favorite: {
    toggle: async (reportId, type) => { const r = await MockAPI.toggleFavorite(reportId, type); return r.data },
    list: async () => { const r = await MockAPI.getFavorites(); return r.data }
  },
  Pet: {
    create: async (data) => { const r = await MockAPI.savePet(data); return r.data },
    list: async () => { const r = await MockAPI.getPets(); return r.data },
    save: async (data) => { const r = await MockAPI.savePet(data); return r.data },
    update: async (id, data) => { const r = await MockAPI.updatePet(id, data); return r.data },
    delete: async (id) => { return await MockAPI.deletePet(id) }
  },
  Product: {
    list: async (params) => { const r = await MockAPI.getProducts(params); return r.data },
    detail: async (id) => { const r = await MockAPI.getProductDetail(id); return r.data }
  },
  Order: {
    create: async (data) => { const r = await MockAPI.createOrder(data); return r.data }
  },
  Hospital: {
    list: async (params) => { const r = await MockAPI.getHospitals(params); return r.data },
    detail: async (id) => { const r = await MockAPI.getHospitalDetail(id); return r.data }
  }
}

const API = DEBUG ? MockNamespaced : RealAPI

module.exports = API

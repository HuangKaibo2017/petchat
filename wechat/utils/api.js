const { MockAPI } = require('./mock')

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
      timeout: 120000,
      success: (res) => {
        if (res.statusCode === 200) {
          const body = res.data
          if (body && body.code === 200) {
            resolve(body.data)
          } else {
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

// ─── 真实 API（直连 Supabase Edge Functions） ───
const RealAPI = {
  get: (url, data) => request(url, { method: 'GET', data }),
  post: (url, data) => request(url, { method: 'POST', data }),
  put: (url, data) => request(url, { method: 'PUT', data }),
  delete: (url, data) => request(url, { method: 'DELETE', data }),

  // ═══ 报告接口 → emotion-report / health-report / risk-report functions ═══
  Report: {
    emotion: async (data) => RealAPI.post('/emotion-report', data),
    health: async (data) => RealAPI.post('/health-report', data),
    risk: async (data) => RealAPI.post('/risk-report', data),
    medical: async (data) => RealAPI.post('/api/medical/guide', data),
    history: async (type) => RealAPI.get(`/api/reports${type ? '?type=' + type : ''}`),
    detail: async (id) => RealAPI.get(`/api/reports/${id}`)
  },

  // ═══ 上传 → upload function ═══
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

  // ═══ 聊天 → chat function ═══
  Chat: {
    listSessions: async () => RealAPI.get('/chat/sessions'),
    createSession: async (petId) => RealAPI.post('/chat/sessions', { petId }),
    getMessages: async (sessionId) => RealAPI.get(`/chat/messages?sessionId=${sessionId}`),
    send: async (sessionId, text) => RealAPI.post('/chat/send-json', { sessionId, message: text }),
    sendStream: async (sessionId, text, onToken) => {
      return RealAPI.post('/chat/send-json', { sessionId, message: text })
    }
  },

  // ═══ 收藏 → api function ═══
  Favorite: {
    toggle: async (reportId, type) => RealAPI.post('/api/favorites', { reportId, type }),
    list: async () => RealAPI.get('/api/favorites')
  },

  // ═══ 宠物档案 → api function ═══
  Pet: {
    create: async (data) => RealAPI.post('/api/pets', data),
    list: async () => RealAPI.get('/api/pets'),
    save: async (data) => RealAPI.post('/api/pets', data),
    update: async (id, data) => RealAPI.put(`/api/pets/${id}`, data),
    delete: async (id) => RealAPI.delete(`/api/pets/${id}`)
  },

  // ═══ 商城 → api function ═══
  Product: {
    list: async (params) => RealAPI.get('/api/products', params),
    detail: async (id) => RealAPI.get(`/api/products/${id}`)
  },

  // ═══ 订单 → api function ═══
  Order: {
    create: async (data) => RealAPI.post('/api/orders', data)
  },

  // ═══ 医院 → api function ═══
  Hospital: {
    list: async (params) => RealAPI.get('/api/hospitals', params),
    detail: async (id) => RealAPI.get(`/api/hospitals/${id}`)
  },

  // ═══ 兼容旧版扁平 API ═══
  getEmotionReport: (data) => RealAPI.post('/emotion-report', data),
  getHealthReport: (data) => RealAPI.post('/health-report', data),
  getRiskReport: (data) => RealAPI.post('/risk-report', data),
  getMedicalGuide: (data) => RealAPI.post('/api/medical/guide', data),
  toggleFavorite: (reportId, type) => RealAPI.post('/api/favorites', { reportId, type }),
  getFavorites: () => RealAPI.get('/api/favorites'),
  getPets: () => RealAPI.get('/api/pets'),
  savePet: (data) => RealAPI.post('/api/pets', data),
  updatePet: (id, data) => RealAPI.put(`/api/pets/${id}`, data),
  deletePet: (id) => RealAPI.delete(`/api/pets/${id}`),
  getHistory: (type) => RealAPI.get(`/api/reports${type ? '?type=' + type : ''}`),
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
    createSession: async (petId) => { const id = Date.now(); return { sessionId: id, petId } },
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

const { MockAPI } = require('./mock')

// 开发模式：无后端时使用 mock 数据
const DEBUG = true

const app = getApp()

const request = (url, options = {}) => {
  const { method = 'GET', data = {}, needAuth = true } = options
  return new Promise((resolve, reject) => {
    const header = { 'Content-Type': 'application/json' }
    if (needAuth) {
      const token = wx.getStorageSync('token')
      if (token) header['Authorization'] = `Bearer ${token}`
    }
    wx.request({
      url: `${app.globalData.baseUrl}${url}`,
      method,
      data,
      header,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          wx.removeStorageSync('token')
          app.globalData.isAuthorized = false
          reject(new Error('UNAUTHORIZED'))
        } else {
          console.warn('[API]', url, 'failed:', res.statusCode)
          reject(new Error(res.data?.message || '请求失败'))
        }
      },
      fail: (err) => {
        console.warn('[API]', url, 'network error:', err.errMsg)
        reject(err)
      }
    })
  })
}

// 真实 API（连接后端时使用）
const RealAPI = {
  get: (url, data) => request(url, { method: 'GET', data }),
  post: (url, data) => request(url, { method: 'POST', data }),
  put: (url, data) => request(url, { method: 'PUT', data }),
  delete: (url, data) => request(url, { method: 'DELETE', data }),

  // === 报告接口（命名空间） ===
  Report: {
    emotion: async (data) => {
      return await RealAPI.post('/api/emotion/report', data)
    },
    health: async (data) => {
      return await RealAPI.post('/api/health/report', data)
    },
    risk: async (data) => {
      return await RealAPI.post('/api/risk/report', data)
    },
    medical: async (data) => {
      return await RealAPI.post('/api/medical/guide', data)
    },
    history: async (type) => {
      return await RealAPI.get('/api/reports', { type })
    },
    detail: async (id) => {
      return await RealAPI.get(`/api/reports/${id}`)
    }
  },

  // === 上传 ===
  Upload: {
    upload: async (filePath, category, petId) => {
      return new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${app.globalData.baseUrl}/api/upload`,
          filePath,
          name: 'file',
          formData: { category, petId },
          success: (res) => {
            try { resolve(JSON.parse(res.data)) }
            catch (e) { resolve({ publicUrl: filePath }) }
          },
          fail: reject
        })
      })
    }
  },

  // === 收藏 ===
  Favorite: {
    toggle: async (reportId, type) => {
      return await RealAPI.post('/api/favorites/toggle', { reportId, type })
    },
    list: async () => {
      return await RealAPI.get('/api/favorites')
    }
  },

  // === 宠物档案 ===
  Pet: {
    list: async () => await RealAPI.get('/api/pets'),
    save: async (data) => await RealAPI.post('/api/pets', data),
    update: async (id, data) => await RealAPI.put(`/api/pets/${id}`, data),
    delete: async (id) => await RealAPI.delete(`/api/pets/${id}`)
  },

  // === 商城 ===
  Product: {
    list: async (params) => await RealAPI.get('/api/products', params),
    detail: async (id) => await RealAPI.get(`/api/products/${id}`)
  },

  // === 订单 ===
  Order: {
    create: async (data) => await RealAPI.post('/api/orders', data)
  },

  // === 医院 ===
  Hospital: {
    list: async (params) => await RealAPI.get('/api/hospitals', params),
    detail: async (id) => await RealAPI.get(`/api/hospitals/${id}`)
  },

  // === 兼容旧版扁平 API ===
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

// Mock 也要提供命名空间版本
const MockNamespaced = {
  ...MockAPI,
  Report: {
    emotion: async (data) => {
      const r = await MockAPI.getEmotionReport(data)
      return r.data // 解包：返回纯 data
    },
    health: async (data) => {
      const r = await MockAPI.getHealthReport(data)
      return r.data
    },
    risk: async (data) => {
      const r = await MockAPI.getRiskReport(data)
      return r.data
    },
    medical: async (data) => {
      const r = await MockAPI.getMedicalGuide(data)
      return r.data
    },
    history: async (type) => {
      const r = await MockAPI.getHistory(type)
      return r.data
    },
    detail: async (id) => {
      const r = await MockAPI.getReportDetail(id)
      return r.data
    }
  },
  Upload: {
    upload: async (filePath) => {
      return { publicUrl: filePath }
    }
  },
  Favorite: {
    toggle: async (reportId, type) => {
      const r = await MockAPI.toggleFavorite(reportId, type)
      return r.data
    },
    list: async () => {
      const r = await MockAPI.getFavorites()
      return r.data
    }
  },
  Pet: {
    list: async () => {
      const r = await MockAPI.getPets()
      return r.data
    },
    save: async (data) => {
      const r = await MockAPI.savePet(data)
      return r.data
    },
    update: async (id, data) => {
      const r = await MockAPI.updatePet(id, data)
      return r.data
    },
    delete: async (id) => {
      return await MockAPI.deletePet(id)
    }
  },
  Product: {
    list: async (params) => {
      const r = await MockAPI.getProducts(params)
      return r.data
    },
    detail: async (id) => {
      const r = await MockAPI.getProductDetail(id)
      return r.data
    }
  },
  Order: {
    create: async (data) => {
      const r = await MockAPI.createOrder(data)
      return r.data
    }
  },
  Hospital: {
    list: async (params) => {
      const r = await MockAPI.getHospitals(params)
      return r.data
    },
    detail: async (id) => {
      const r = await MockAPI.getHospitalDetail(id)
      return r.data
    }
  }
}

// 导出：debug 模式用 mock，否则用真实 API
const API = DEBUG ? MockNamespaced : RealAPI

module.exports = API

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

// 导出：debug 模式用 mock，否则用真实 API
const API = DEBUG ? MockAPI : RealAPI

module.exports = API

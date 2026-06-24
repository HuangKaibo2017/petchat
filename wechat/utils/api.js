const { MockAPI } = require('./mock')

const DEBUG = false

const app = getApp()

const request = async (url, options = {}) => {
  const { method = 'GET', data = {}, needAuth = true, _retried = false } = options
  // 调用前确保已有有效登录态
  if (needAuth && app.ensureLogin) {
    await app.ensureLogin()
  }
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
      success: async (res) => {
        if (res.statusCode === 200) {
          const body = res.data
          if (body && body.code === 200) {
            resolve(body.data)
          } else {
            resolve(body)
          }
        } else if (res.statusCode === 401) {
          // token 失效：重新登录并重试一次
          wx.removeStorageSync('token')
          app.globalData.isLoggedIn = false
          if (needAuth && !_retried && app.wxLogin) {
            const newToken = await app.wxLogin()
            if (newToken) {
              return resolve(await request(url, { ...options, _retried: true }))
            }
          }
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
  });
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
    listSessions: async () => {
      const res = await RealAPI.get('/chat/sessions')
      if (res && res.sessions) {
        res.sessions = res.sessions.map(s => ({
          ...s,
          id: s.id || s.f_id,
          petId: s.petId || s.f_pet_id,
          time: s.time || s.f_started_at || '',
        }))
      }
      return res
    },
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

  // ═══ 宠物档案 → api function (后端已统一返回 camelCase) ═══
  Pet: {
    create: async (data) => {
      // 发送时兼容 mock 字段名
      const payload = { ...data };
      if (payload.avatar === undefined && payload.avatarUrl !== undefined) payload.avatar = payload.avatarUrl;
      return RealAPI.post('/api/pets', payload);
    },
    list: async () => {
      const pets = await RealAPI.get('/api/pets');
      // 后端已返回 camelCase，做兜底兼容
      if (Array.isArray(pets)) {
        return pets.map(p => ({
          id: p.id ?? p.f_id,
          name: p.name ?? p.f_name,
          avatar: p.avatar ?? p.avatarUrl ?? p.f_avatar_url ?? '',
          breed: p.breed ?? '',
          breedId: p.breedId ?? p.f_breed_id,
          petType: p.petType ?? '',
          petTypeId: p.petTypeId ?? p.f_pet_type_id,
          gender: p.gender ?? '',
          genderId: p.genderId ?? p.f_gender_id,
          birthDate: p.birthDate ?? p.f_birth_date,
          birthYear: p.birthYear ?? p.f_birth_year,
          birthMonth: p.birthMonth ?? p.f_birth_month,
          weight: p.weight ?? p.f_weight,
          sterilized: p.sterilized ?? p.f_sterilized ?? false,
          vaccinated: p.vaccinated ?? p.f_vaccinated ?? false,
          tags: p.tags ?? p.f_personality_tags ?? [],
          statusPet: p.statusPet ?? p.f_status_pet,
          createdAt: p.createdAt ?? p.f_created_at,
          updatedAt: p.updatedAt ?? p.f_updated_at,
        }));
      }
      return pets;
    },
    save: async (data) => RealAPI.Pet.create(data),
    update: async (id, data) => {
      const payload = { ...data };
      if (payload.avatar === undefined && payload.avatarUrl !== undefined) payload.avatar = payload.avatarUrl;
      return RealAPI.put(`/api/pets/${id}`, payload);
    },
    delete: async (id) => RealAPI.delete(`/api/pets/${id}`)
  },

  // ═══ 商城 → api function (后端已统一返回 camelCase) ═══
  Product: {
    list: async (params) => {
      const products = await RealAPI.get('/api/products', params);
      if (Array.isArray(products)) {
        return products.map(p => ({
          id: p.id ?? p.f_id,
          name: p.name ?? p.f_name,
          desc: p.desc ?? p.f_description ?? '',
          price: p.price ?? 0,
          category: p.category ?? '',
          categoryId: p.categoryId ?? p.f_category_id,
          image: p.image ?? '',
          brand: p.brand ?? p.f_brand ?? '',
        }));
      }
      return products;
    },
    detail: async (id) => {
      const product = await RealAPI.get(`/api/products/${id}`);
      if (product) {
        return {
          id: product.id ?? product.f_id,
          name: product.name ?? product.f_name,
          desc: product.desc ?? product.f_description ?? '',
          price: product.price ?? 0,
          category: product.category ?? '',
          categoryId: product.categoryId ?? product.f_category_id,
          image: product.image ?? '',
          brand: product.brand ?? product.f_brand ?? '',
        };
      }
      return product;
    }
  },

  // ═══ 订单 → api function ═══
  Order: {
    create: async (data) => RealAPI.post('/api/orders', data)
  },

  // ═══ 医院 → api function (后端已统一返回 camelCase) ═══
  Hospital: {
    list: async (params) => {
      const hospitals = await RealAPI.get('/api/hospitals', params);
      if (Array.isArray(hospitals)) {
        return hospitals.map(h => ({
          id: h.id ?? h.f_id,
          name: h.name ?? h.f_name,
          address: h.address ?? h.f_address ?? '',
          phone: h.phone ?? h.f_phone ?? '',
          rating: h.rating ?? h.f_rating ?? 0,
          tags: h.tags ?? h.f_service_tags ?? [],
          businessHours: h.businessHours ?? h.f_business_hours ?? '',
          distance: h.distance ?? '',
          image: h.image ?? '',
          lat: h.lat ?? null,
          lng: h.lng ?? null,
        }));
      }
      return hospitals;
    },
    detail: async (id) => {
      const hospital = await RealAPI.get(`/api/hospitals/${id}`);
      if (hospital) {
        return {
          id: hospital.id ?? hospital.f_id,
          name: hospital.name ?? hospital.f_name,
          address: hospital.address ?? hospital.f_address ?? '',
          phone: hospital.phone ?? hospital.f_phone ?? '',
          rating: hospital.rating ?? hospital.f_rating ?? 0,
          tags: hospital.tags ?? hospital.f_service_tags ?? [],
          businessHours: hospital.businessHours ?? hospital.f_business_hours ?? '',
          distance: hospital.distance ?? '',
          image: hospital.image ?? '',
          lat: hospital.lat ?? null,
          lng: hospital.lng ?? null,
        };
      }
      return hospital;
    }
  },

  // ═══ 兼容旧版扁平 API ═══
  getEmotionReport: (data) => RealAPI.post('/emotion-report', data),
  getHealthReport: (data) => RealAPI.post('/health-report', data),
  getRiskReport: (data) => RealAPI.post('/risk-report', data),
  getMedicalGuide: (data) => RealAPI.post('/api/medical/guide', data),
  toggleFavorite: (reportId, type) => RealAPI.post('/api/favorites', { reportId, type }),
  getFavorites: () => RealAPI.get('/api/favorites'),
  getPets: () => RealAPI.Pet.list(),
  savePet: (data) => RealAPI.Pet.create(data),
  updatePet: (id, data) => RealAPI.Pet.update(id, data),
  deletePet: (id) => RealAPI.Pet.delete(id),
  getHistory: (type) => RealAPI.get(`/api/reports${type ? '?type=' + type : ''}`),
  getReportDetail: (id) => RealAPI.get(`/api/reports/${id}`),
  getProducts: (params) => RealAPI.Product.list(params),
  getProductDetail: (id) => RealAPI.Product.detail(id),
  createOrder: (data) => RealAPI.Order.create(data),
  getHospitals: (params) => RealAPI.Hospital.list(params),
  getHospitalDetail: (id) => RealAPI.Hospital.detail(id),
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

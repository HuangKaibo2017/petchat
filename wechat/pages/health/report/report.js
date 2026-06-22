const util = require('../../../utils/util')
const API = require('../../../utils/api')
const app = getApp()

Page({
  data: {
    report: {},
    riskLevel: {},
    favorited: false
  },

  onLoad(options) {
    const rawData = app.globalData._reportData || {}; app.globalData._reportData = null
    this.buildReport(rawData)
    // 整体分析：绘制雷达图
    if (rawData.mode === 'overall') {
      this.prepareRadarData(rawData)
    }
  },

  // 准备雷达图数据
  prepareRadarData(report) {
    const dims = [
      { label: '气血', value: Math.floor(Math.random()*30+55), color: '#EF4444' },
      { label: '阴阳', value: Math.floor(Math.random()*30+55), color: '#F97316' },
      { label: '脏腑', value: Math.floor(Math.random()*30+55), color: '#8B5CF6' },
      { label: '经络', value: Math.floor(Math.random()*30+55), color: '#3B82F6' },
      { label: '情志', value: Math.floor(Math.random()*30+55), color: '#22C55E' },
      { label: '卫气', value: Math.floor(Math.random()*30+55), color: '#EC4899' }
    ]
    this.setData({ radarDimensions: dims }, () => {
      this.drawRadarChart(dims)
    })
  },

  // 绘制雷达图
  drawRadarChart(dims) {
    const query = wx.createSelectorQuery()
    query.select('#radarCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res[0] || !res[0].node) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getSystemInfoSync().pixelRatio
      const w = res[0].width
      const h = res[0].height
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)

      const cx = w / 2
      const cy = h / 2
      const radius = Math.min(w, h) / 2 - 30
      const count = dims.length
      const angleStep = (Math.PI * 2) / count

      // 绘制背景网格
      for (let level = 1; level <= 5; level++) {
        ctx.beginPath()
        const r = (radius / 5) * level
        for (let i = 0; i <= count; i++) {
          const angle = angleStep * i - Math.PI / 2
          const x = cx + r * Math.cos(angle)
          const y = cy + r * Math.sin(angle)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.strokeStyle = '#E5E7EB'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // 绘制轴线
      for (let i = 0; i < count; i++) {
        const angle = angleStep * i - Math.PI / 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle))
        ctx.strokeStyle = '#E5E7EB'
        ctx.stroke()

        // 标签
        const labelR = radius + 22
        const lx = cx + labelR * Math.cos(angle)
        const ly = cy + labelR * Math.sin(angle)
        ctx.fillStyle = '#6B7280'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(dims[i].label, lx, ly)
      }

      // 绘制数据区域
      ctx.beginPath()
      for (let i = 0; i <= count; i++) {
        const idx = i % count
        const angle = angleStep * idx - Math.PI / 2
        const r = (dims[idx].value / 100) * radius
        const x = cx + r * Math.cos(angle)
        const y = cy + r * Math.sin(angle)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fillStyle = 'rgba(45, 125, 110, 0.15)'
      ctx.fill()
      ctx.strokeStyle = '#2D7D6E'
      ctx.lineWidth = 2
      ctx.stroke()

      // 数据点
      for (let i = 0; i < count; i++) {
        const angle = angleStep * i - Math.PI / 2
        const r = (dims[i].value / 100) * radius
        const x = cx + r * Math.cos(angle)
        const y = cy + r * Math.sin(angle)
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fillStyle = '#2D7D6E'
        ctx.fill()
      }
    })
  },

  buildReport(data) {
    if (data.healthScore !== undefined || data.healthLevel) {
      const healthScore = data.healthScore ?? 0
      const healthLevel = data.healthLevel || (healthScore >= 80 ? '健康良好' : healthScore >= 60 ? '亚健康' : '需要关注')
      const report = {
        ...data,
        id: data.reportId || data.id || `rpt_${Date.now()}`,
        type: data.type || 'health',
        typeName: data.typeName || '健康监测',
        time: data.time || new Date().toLocaleString(),
        healthScore,
        healthLevel,
        favorited: false
      }
      this.setData({ report })
      this.saveReport(report)
      return
    }

    if (data.riskLevel) {
      const riskLevel = util.getRiskLevel(data.riskLevel)
      const report = {
        ...data,
        id: data.reportId || data.id || `rpt_${Date.now()}`,
        type: data.type || 'health',
        typeName: data.typeName || '健康监测',
        time: data.time || new Date().toLocaleString(),
        riskText: riskLevel.text,
        favorited: false
      }
      this.setData({
        report,
        riskLevel: { ...riskLevel, icon: data.riskLevel === 'high' ? '🚨' : data.riskLevel === 'medium' ? '⚠️' : '✅', desc: data.riskLevel === 'high' ? '建议立即就医' : '建议关注' }
      })
      this.saveReport(report)
      return
    }

    // 兜底 mock
    const pet = app.globalData.currentPet || {}
    const level = ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
    const riskLevel = util.getRiskLevel(level)
    const report = {
      id: `rpt_${Date.now()}`, type: 'health', typeName: '健康监测',
      petName: pet.name || '小橘', petAvatar: pet.avatar || '',
      petId: data.petId, time: new Date().toLocaleString(),
      symptom: data.symptom, duration: data.duration,
      riskLevel: level, riskText: riskLevel.text,
      currentSymptoms: level === 'high' ? '尿频、尿量减少、精神萎靡。需紧急关注！' : '出现尿频、舔舐增多，精神状态尚可。',
      symptomMapping: [
        { area: '泌尿系统', symptoms: '尿带隐血、尿频尿急、频繁在猫砂盆附近徘徊、喝水少' },
        { area: '消化系统', symptoms: '食欲轻微下降、偶尔软便' }
      ],
      potentialDeficiencies: '脾肾气虚，膀胱气化不利。',
      deficiencyDetails: [
        { type: '肾气不足', manifestations: '不爱动、玩一会就累了、总睡觉没精神' },
        { type: '脾胃不足', manifestations: '食欲不振、时长软便、舌头颜色浅淡' }
      ],
      emergency: level === 'high' ? '如出现尿闭（超过12小时无排尿），请立即就医！' : '',
      futureRisk: '重点关注泌尿系统健康，定期检查肾功能。',
      carePlan: [
        { title: '中兽医养护', desc: '温补肾阳，健脾利湿。茯苓白术泽泻煎水（需遵医嘱）。' },
        { title: '香疗建议', desc: '温阳化气类香珠，苍术艾叶化湿。' },
        { title: '饮食调理', desc: '增加湿粮，充足饮水。加蔓越莓提取物。' },
        { title: '保健品', desc: '益生菌调理肠胃，泌尿保健营养膏。' }
      ],
      summary: level === 'high' ? '泌尿系统高风险预警' : '轻度泌尿系统失调，建议调理',
      favorited: false
    }
    this.setData({
      report,
      riskLevel: { ...riskLevel, icon: level === 'high' ? '🚨' : level === 'medium' ? '⚠️' : '✅', desc: level === 'high' ? '建议立即就医' : '建议关注' }
    })
    this.saveReport(report)
  },

  saveReport(report) {
    const reports = wx.getStorageSync('reports') || []
    reports.unshift(report)
    wx.setStorageSync('reports', reports)
  },

  async toggleFavorite() {
    const { report, favorited } = this.data
    try {
      await API.Favorite.toggle(report.id, report.type || 'health')
      this.setData({ favorited: !favorited })
      wx.showToast({ title: !favorited ? '已收藏' : '已取消收藏', icon: 'none' })
    } catch (err) {
      this.setData({ favorited: !favorited })
      wx.showToast({ title: !favorited ? '已收藏' : '已取消收藏', icon: 'none' })
    }
  },

  goHospitals() { wx.navigateTo({ url: '/pages/hospitals/hospitals' }) },
  goShop() { wx.switchTab({ url: '/pages/shop/shop' }) },
  shareReport() { wx.showShareMenu({ withShareTicket: true }) },

  onShareAppMessage() {
    return { title: `${this.data.report.petName}的健康监测报告`, path: '/pages/health/report/report' }
  }
})

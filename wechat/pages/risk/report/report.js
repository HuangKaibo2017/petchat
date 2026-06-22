const API = require('../../../utils/api')

Page({
  data: {
    report: {},
    pet: null,
    favorited: false,
    reportId: '',
    time: '',
  },

  onLoad(options) {
    if (options.data) {
      try {
        const data = JSON.parse(decodeURIComponent(options.data))
        let report = data.report || {}

        // If report is a string (raw LLM output), wrap it
        if (typeof report === 'string') {
          report = {
            petConstitution: '分析中',
            petCoreState: report.replace(/[{}\[\]"':,\n]/g, ' ').slice(0, 300),
            conclusion: '以上内容仅供参考，不替代执业兽医诊断。',
          }
        }

        // Ensure nested objects exist to prevent template crashes
        report.ownerMirrorAnalysis = report.ownerMirrorAnalysis || { title: '', items: [] }
        report.ownerWarnings = report.ownerWarnings || []
        report.ownerBadHabits = report.ownerBadHabits || []
        report.petIssues = report.petIssues || []
        report.petRisks = report.petRisks || []
        report.carePlan = report.carePlan || { pet: [], owner: [] }
        report.convergenceChanges = report.convergenceChanges || { recommendations: [] }
        report.sharedPoints = report.sharedPoints || {}

        this.setData({
          report,
          pet: data.pet || null,
          reportId: `risk_${Date.now()}`,
          time: new Date().toLocaleString(),
        })
      } catch (e) {
        console.warn('解析数据失败:', e)
      }
    }
  },

  async toggleFavorite() {
    const { reportId, favorited } = this.data
    try {
      await API.Favorite.toggle(reportId, 'risk')
      this.setData({ favorited: !favorited })
      wx.showToast({ title: !favorited ? '已收藏' : '已取消收藏', icon: 'none' })
    } catch {
      this.setData({ favorited: !favorited })
      wx.showToast({ title: !favorited ? '已收藏' : '已取消收藏', icon: 'none' })
    }
  },

  shareReport() { wx.showShareMenu({ withShareTicket: true }) },
})

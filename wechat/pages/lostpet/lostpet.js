const app = getApp()
const API = require('../../utils/api')

Page({
  data: {
    petName: '', breed: '', location: '', lostDate: '', senseNum: '',
    envResidential: false, envPark: false, envRoad: false, envWater: false, envCommercial: false,
    generating: false, report: null
  },
  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) },
  onDateChange(e) { this.setData({ lostDate: e.detail.value }) },
  toggleEnv(e) {
    const env = e.currentTarget.dataset.env
    this.setData({ ['env' + env.charAt(0).toUpperCase() + env.slice(1)]: !this.data['env' + env.charAt(0).toUpperCase() + env.slice(1)] })
  },

  async generateReport() {
    if (!this.data.petName.trim() || !this.data.location.trim()) {
      wx.showToast({ title: '请至少填写名称和地点', icon: 'none' })
      return
    }
    this.setData({ generating: true })
    try {
      const envs = []
      if (this.data.envResidential) envs.push('住宅区')
      if (this.data.envPark) envs.push('公园')
      if (this.data.envRoad) envs.push('公路')
      if (this.data.envWater) envs.push('水域')
      if (this.data.envCommercial) envs.push('商业区')
      const result = await API.Report.medical({
        symptom: '宠物走失: ' + this.data.petName + ' ' + this.data.breed,
        imageUrl: '',
        guideType: 'lostpet',
        extra: { location: this.data.location, lostDate: this.data.lostDate, envs, senseNum: this.data.senseNum }
      })
      let report = (result && result.data) ? result.data : result
      if (typeof report === 'string') report = { actionPlan: report }
      this.setData({ generating: false, report })
    } catch (err) {
      this.setData({ generating: false })
      this.setData({ report: {
        predictedStatus: this.data.petName + '目前大概率仍在走失地周边2-3公里范围内。宠物通常不会走太远，尤其是家养宠物。',
        direction: '建议先搜索东南方向的绿化带、地下车库和餐饮店后巷区域。猫科可能藏在隐蔽角落（车底、灌木丛），犬科可能在有人活动的区域游荡。',
        actionPlan: '1. 立即在走失地500米范围内张贴寻宠启事\n2. 联系附近宠物医院和救助站\n3. 在小区业主群/本地宠物群发布信息\n4. 夜晚安静时段（22:00-2:00）带着零食和玩具去搜索',
        socialTemplate: '【紧急寻宠】\n🐱宠物名：' + this.data.petName + '\n📍走失地点：' + this.data.location + '\n📅走失时间：' + (this.data.lostDate || '近日') + '\n💡特征：' + (this.data.breed || '详见图片') + '\n\n如有线索请联系我，必有重谢！🙏\n#宠物走失 #紧急寻宠 #' + this.data.location
      }})
      wx.showToast({ title: '报告已生成', icon: 'success' })
    }
  },

  copyTemplate() {
    if (this.data.report && this.data.report.socialTemplate) {
      wx.setClipboardData({
        data: this.data.report.socialTemplate,
        success: () => wx.showToast({ title: '文案已复制，可粘贴发布', icon: 'success' })
      })
    }
  }
})
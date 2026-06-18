Page({
  data: {
    report: {},
    favorited: false
  },

  onLoad(options) {
    const rawData = options.data ? JSON.parse(decodeURIComponent(options.data)) : {}
    this.generateMockReport(rawData)
  },

  generateMockReport(data) {
    const report = this.data.report;
    const reports = wx.getStorageSync('reports') || [];
    reports.unshift(report);
    wx.setStorageSync('reports', reports);
    this.setData({
      report: {
        petImbalance: '小橘当前呈现肾气不足、膀胱气化不利的失衡状态，情绪略低落。体质偏阳虚，水液代谢功能减弱。',
        qiRisk: '宠物肾气不足常对应主人的肾气或泌尿系统同样处于亚健康状态。根据人宠同构理论，长期共处的主人与宠物会形成气机同步，建议主人关注自身腰部酸软、精力不济、夜尿增多等情况。',
        microbiomeRisk: '共栖菌群研究显示，宠物泌尿系统菌群失衡可能会通过日常接触影响主人的微生态平衡。主人若出现皮肤敏感、消化不适，可能与共栖环境相关。',
        lifestyleRisk: '宠物近期饮水减少、活动量下降，可能反映出家庭整体作息不规律、环境湿度偏低。建议主人自查：近期是否工作压力大、熬夜频繁？环境是否过于干燥？',
        jointCarePlan: '1. 饮食同步：主人可增加黑色食物（黑豆、黑芝麻）补肾，宠物可搭配温补食材。\n2. 作息同步：设定固定就寝时间，人宠同步休息有助于气机调和。\n3. 运动同步：每日15分钟互动游戏，共同活动有助于菌群交换正向化。\n4. 环境调理：增加室内湿度，使用合香香珠改善空间气场。',
        medicalAdvice: '建议主人进行肾功能、泌尿系统常规检查。宠物需做尿检和肾功能评估。推荐预约中西医结合门诊。'
      }
    })
  },

  toggleFavorite() {
    this.setData({ favorited: !this.data.favorited })
    wx.showToast({ title: this.data.favorited ? '已收藏' : '已取消收藏', icon: 'none' })
  },
  shareReport() { wx.showShareMenu({ withShareTicket: true }) }
})

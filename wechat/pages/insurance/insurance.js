Page({
  data: {
    plans: [
      { id: 1, name: '基础医疗险', tag: '热门', desc: '门诊+住院·全年保障·直付理赔', price: '299' },
      { id: 2, name: '全面守护险', tag: '推荐', desc: '基础+手术+重疾·高额保障', price: '599' },
      { id: 3, name: '尊享无忧险', tag: '顶配', desc: '全面+体检+疫苗·一站式服务', price: '999' }
    ]
  },
  claimFree() { wx.showToast({ title: '免费保险已领取', icon: 'success' }) },
  buyPlan(e) { wx.showToast({ title: '跳转投保页面', icon: 'none' }) },
  goPolicy() { wx.showToast({ title: '保单功能开发中', icon: 'none' }) },
  goClaim() { wx.showToast({ title: '理赔功能开发中', icon: 'none' }) },
  goService() { wx.showToast({ title: '客服功能开发中', icon: 'none' }) }
})

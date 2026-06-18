Page({
  goMedical() { wx.navigateTo({ url: '/pages/medical/medical' }) },
  goInsurance() { wx.navigateTo({ url: '/pages/insurance/insurance' }) },
  goHospitals() { wx.navigateTo({ url: '/pages/hospitals/hospitals' }) },
  goLost() { wx.showToast({ title: '丢失方向建议开发中', icon: 'none' }) },
  goCommunity() { wx.navigateTo({ url: '/pages/community/community' }) },
  goNewPet() { wx.navigateTo({ url: '/pages/medical/medical?type=newpet' }) }
})

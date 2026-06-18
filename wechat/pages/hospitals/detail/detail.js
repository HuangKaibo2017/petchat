Page({
  callPhone() { wx.makePhoneCall({ phoneNumber: '400-123-4567' }) },
  makeAppointment() { wx.showToast({ title: '预约功能开发中', icon: 'none' }) },
  navigate() {
    wx.openLocation({ latitude: 22.5431, longitude: 113.9496, name: '瑞鹏宠物医院(南山店)', address: '南山区科技园南路100号' })
  },
  syncReport() { wx.showToast({ title: '报告同步功能开发中', icon: 'none' }) }
})

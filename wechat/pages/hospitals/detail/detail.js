Page({
  data: {
    hospital: null,
    loading: true
  },

  onLoad(options) {
    const hospitals = [
      { id: 1, name: '瑞鹏宠物医院(南山店)', rating: '4.8', distance: '1.2km', tags: ['24小时','直付','中医'], address: '南山区科技园南路100号', phone: '0755-88888888', lat: 22.5431, lng: 113.9496 },
      { id: 2, name: '芭比堂动物医院', rating: '4.7', distance: '2.5km', tags: ['康复','牙科'], address: '福田区莲花路200号', phone: '0755-88888889', lat: 22.5480, lng: 114.0580 },
      { id: 3, name: '爱诺动物医院', rating: '4.6', distance: '3.1km', tags: ['急诊','手术'], address: '宝安区新安路300号', phone: '0755-88888890', lat: 22.5610, lng: 113.8830 },
      { id: 4, name: '美联众合动物医院', rating: '4.9', distance: '4.0km', tags: ['综合','CT','MRI'], address: '罗湖区深南东路400号', phone: '0755-88888891', lat: 22.5480, lng: 114.1180 }
    ]

    const id = options.id ? parseInt(options.id) : 1
    const hospital = hospitals.find(h => h.id === id) || hospitals[0]
    this.setData({ hospital, loading: false })
  },

  callPhone() {
    const phone = this.data.hospital?.phone || '400-123-4567'
    wx.makePhoneCall({ phoneNumber: phone })
  },

  makeAppointment() {
    wx.showToast({ title: '预约功能开发中', icon: 'none' })
  },

  navigate() {
    const h = this.data.hospital
    if (h && h.lat && h.lng) {
      wx.openLocation({
        latitude: h.lat,
        longitude: h.lng,
        name: h.name,
        address: h.address
      })
    }
  },

  syncReport() {
    wx.showToast({ title: '报告同步功能开发中', icon: 'none' })
  }
})

const API = require('../../utils/api')

Page({
  data: {
    hospitals: [
      { id: 1, name: '瑞鹏宠物医院(南山店)', rating: '4.8', distance: '1.2km', tags: ['24小时','直付','中医'], address: '南山区科技园南路100号', image: '' },
      { id: 2, name: '芭比堂动物医院', rating: '4.7', distance: '2.5km', tags: ['康复','牙科'], address: '福田区莲花路200号', image: '' },
      { id: 3, name: '爱诺动物医院', rating: '4.6', distance: '3.1km', tags: ['急诊','手术'], address: '宝安区新安路300号', image: '' },
      { id: 4, name: '美联众合动物医院', rating: '4.9', distance: '4.0km', tags: ['综合','CT','MRI'], address: '罗湖区深南东路400号', image: '' }
    ]
  },
  onLoad() {
    this.loadHospitals()
  },
  async loadHospitals() {
    try {
      const res = await API.Hospital.list()
      const hospitals = Array.isArray(res) ? res : (res?.data || [])
      if (hospitals && hospitals.length > 0) {
        this.setData({ hospitals })
      }
    } catch (e) {
      console.warn('Failed to load hospitals from API, using default')
    }
  },
  onSearch(e) {},
  goDetail(e) {
    wx.navigateTo({ url: `/pages/hospitals/detail/detail?id=${e.currentTarget.dataset.id}` })
  }
})

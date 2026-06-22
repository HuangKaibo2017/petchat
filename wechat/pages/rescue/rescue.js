const app = getApp()

Page({
  data: {
    activeTab: 'help',
    organizations: [
      { id: 1, emoji: '🏥', name: '深圳流浪动物救助中心', phone: '0755-12345678', desc: '南山·宝安' },
      { id: 2, emoji: '🐈', name: '猫奴爱心救助站', phone: '0755-87654321', desc: '福田·罗湖' },
      { id: 3, emoji: '🐕', name: '汪星人救助联盟', phone: '0755-11223344', desc: '龙岗·龙华' },
      { id: 4, emoji: '💚', name: '它基金·深圳分会', phone: '400-888-9999', desc: '全市覆盖' }
    ],
    helpList: [
      { id: 1, petType: '猫咪', location: '南山区科技园附近', description: '一只橘猫左后腿受伤，躲在绿化带中，需要紧急救助', time: '2小时前', contactPhone: '138****5678', donationCount: 320 },
      { id: 2, petType: '狗狗', location: '福田区华强北地铁站B口', description: '白色小型犬，疑似走失，脖子有项圈但无联系方式', time: '5小时前', contactPhone: '', donationCount: 150 },
      { id: 3, petType: '猫咪', location: '宝安区西乡街道', description: '母猫带着3只幼崽在废弃店铺里，需要安置', time: '1天前', contactPhone: '139****2345', donationCount: 500 }
    ],
    adoptList: [
      { id: 1, petName: '小橘', breed: '橘猫', age: '1岁', adoptionType: '送养', description: '性格温顺粘人，已驱虫打疫苗，适合新手家庭', location: '南山区', contactPhone: '138****5678', image: '' },
      { id: 2, petName: '旺财', breed: '田园犬', age: '2岁', adoptionType: '送养', description: '健康活泼，已绝育，会基本指令，适合有院子的家庭', location: '龙岗区', contactPhone: '136****3344', image: '' },
      { id: 3, petName: '花花', breed: '三花猫', age: '8个月', adoptionType: '领养申请', description: '颜值超高的小三花，有点胆小需要耐心', location: '罗湖区', contactPhone: '137****9900', image: '' }
    ]
  },

  onLoad(options) {
    if (options.tab) {
      this.setData({ activeTab: options.tab })
    }
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  callOrg(e) {
    const phone = e.currentTarget.dataset.phone
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone.replace(/[^0-9]/g, '') })
    }
  },

  goPublishHelp() {
    wx.showToast({ title: '发布求助功能开发中', icon: 'none' })
  },
  goPublishAdopt() {
    wx.showToast({ title: '发布领养功能开发中', icon: 'none' })
  },
  donateToHelp(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '捐赠积分',
      content: '确认捐赠100积分帮助该求助？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '捐赠成功！感谢您的爱心 ❤️', icon: 'none' })
        }
      }
    })
  },
  contactAdopt(e) {
    const phone = e.currentTarget.dataset.phone
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone.replace(/[^0-9]/g, '') })
    } else {
      wx.showToast({ title: '暂未留下联系方式', icon: 'none' })
    }
  },
  goDonate() {
    wx.showModal({
      title: '积分捐赠',
      content: '您的积分可以兑换平台权益。每100积分 = 1份流浪动物口粮。当前积分：520',
      editable: true,
      placeholderText: '请输入捐赠积分数量',
      success: (res) => {
        if (res.confirm && res.content) {
          wx.showToast({ title: '已捐赠 ' + res.content + ' 积分 ❤️', icon: 'none' })
        }
      }
    })
  },
  goVolunteer() {
    wx.showModal({
      title: '志愿者申请',
      content: '志愿者将参与实地数据采集、救助协助等工作。确认申请？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '申请已提交，等待审核', icon: 'success' })
        }
      }
    })
  }
})

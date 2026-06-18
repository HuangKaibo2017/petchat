Page({
  data: {
    banners: [
      { id: 1, title: '萌宠打卡挑战', desc: '连续打卡7天赢好礼', bg: 'linear-gradient(135deg,#F97316,#FB923C)' },
      { id: 2, title: '最美宠物评选', desc: '上传照片参与评选', bg: 'linear-gradient(135deg,#8B5CF6,#A78BFA)' }
    ],
    activities: [
      { id: 1, title: '宠物中医养护讲座', time: '2026-06-20 14:00', desc: '线上直播，专业中兽医讲解宠物养护知识', status: '报名中' },
      { id: 2, title: '灵犀NFC新品体验官招募', time: '2026-06-15 - 06-30', desc: '免费试用灵犀NFC项圈，分享体验心得', status: '进行中' }
    ],
    feeds: [
      { id: 1, nickname: '猫咪爱好者', avatar: '', time: '2小时前', content: '我家小橘戴上灵犀项圈后，出门再也不怕走丢了！', image: '', likes: 128, comments: 23 },
      { id: 2, nickname: '宠物达人小王', avatar: '', time: '5小时前', content: '分享一个猫咪不爱喝水的解决办法：用流动饮水机+放一点猫薄荷', image: '', likes: 256, comments: 45 }
    ]
  },
  goPost() {
    wx.navigateTo({ url: '/pages/community/post/post' })
  }
})

Page({
  data: {
    activeCircle: 'all',
    unreadMessages: 2,
    banners: [
      { id: 1, title: '萌宠打卡挑战', desc: '连续打卡7天赢好礼', bg: 'linear-gradient(135deg,#2D7D6E,#5BA89A)' },
      { id: 2, title: '最美宠物评选', desc: '上传照片参与评选', bg: 'linear-gradient(135deg,#8B5CF6,#A78BFA)' }
    ],
    activities: [
      { id: 1, title: '宠物中医养护讲座', time: '2026-06-20 14:00', desc: '线上直播，专业中兽医讲解宠物养护知识', status: '报名中' },
      { id: 2, title: '灵犀NFC新品体验官招募', time: '2026-06-15 - 06-30', desc: '免费试用灵犀NFC项圈，分享体验心得', status: '进行中' }
    ],
    feeds: [
      { id: 1, nickname: '猫咪爱好者', avatar: '', time: '2小时前', circle: '猫咪圈',
        content: '我家小橘戴上灵犀项圈后，出门再也不怕走丢了！推荐所有养猫家庭入手~', image: '', likes: 128, comments: 23 },
      { id: 2, nickname: '宠物达人小王', avatar: '', time: '5小时前', circle: '养宠妙招',
        content: '分享一个猫咪不爱喝水的解决办法：用流动饮水机+放一点猫薄荷，亲测有效！', image: '', likes: 256, comments: 45 },
      { id: 3, nickname: '柯基拆家王', avatar: '', time: '3小时前', circle: '吐槽专区',
        content: '今天回家发现沙发又没了...已经是第三个沙发了，有同款拆家柯基的吗？求妙招！😭', image: '', likes: 89, comments: 67 }
    ]
  },

  switchCircle(e) { this.setData({ activeCircle: e.currentTarget.dataset.circle }) },
  goPost() { wx.navigateTo({ url: '/pages/community/post/post' }) },
  goMessages() {
    wx.showToast({ title: '私信功能开发中', icon: 'none' })
  },
  reportFeed(e) {
    const id = e.currentTarget.dataset.id
    wx.showActionSheet({
      itemList: ['内容违规', '虚假信息', '广告骚扰', '人身攻击'],
      success: (res) => {
        const reasons = ['内容违规', '虚假信息', '广告骚扰', '人身攻击']
        wx.showModal({
          title: '举报确认',
          content: '确认举报该内容为「' + reasons[res.tapIndex] + '」？运营团队将在24小时内审核处理。',
          success: (modalRes) => {
            if (modalRes.confirm) {
              wx.showToast({ title: '举报已提交，感谢监督', icon: 'success' })
            }
          }
        })
      }
    })
  }
})
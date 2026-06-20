Page({
  data: {
    guide: {}
  },

  onLoad(options) {
    if (options.data) {
      try {
        const guide = JSON.parse(decodeURIComponent(options.data))
        this.setData({ guide })
      } catch (e) {
        console.warn('解析医疗咨询数据失败:', e)
      }
    }
  }
})

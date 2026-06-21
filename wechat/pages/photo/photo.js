const app = getApp()

const MODE_CONFIG = {
  watermark: {
    title: '水印照片', emoji: '🖼️',
    desc: '选择一张宠物照片，输入一句心里话（20字以内），生成带有日期和文字的水印照片，定格温馨瞬间。'
  },
  comic: {
    title: '日记漫画', emoji: '📖',
    desc: '选择6张以上宠物日常照片，AI自动生成一组日记式漫画，用漫画语言记录与宠物的每一天。'
  },
  series: {
    title: '漫剧', emoji: '🎬',
    desc: '选择多张照片，AI生成多格叙事漫剧，像看电影一样回顾宠物的成长故事。'
  }
}

Page({
  data: {
    mode: 'watermark',
    pageTitle: '水印照片',
    modeEmoji: '🖼️',
    modeIntro: MODE_CONFIG.watermark,

    // 水印
    photoPath: '',
    watermarkText: '',
    watermarkedImage: '',

    // 漫画
    comicPhotos: [],
    comicResult: '',

    // 漫剧
    seriesPhotos: [],
    seriesTitle: '',
    seriesResult: ''
  },

  onLoad(options) {
    const mode = options.mode || 'watermark'
    const config = MODE_CONFIG[mode] || MODE_CONFIG.watermark
    this.setData({
      mode,
      pageTitle: config.title,
      modeEmoji: config.emoji,
      modeIntro: config
    })
  },

  // ─── 水印照片 ───
  choosePhoto() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sizeType: ['compressed'],
      success: (res) => {
        this.setData({ photoPath: res.tempFiles[0].tempFilePath, watermarkedImage: '' })
      }
    })
  },
  onTextInput(e) {
    this.setData({ watermarkText: e.detail.value })
  },
  generateWatermark() {
    wx.showLoading({ title: '生成中...' })
    const ctx = wx.createCanvasContext('watermarkCanvas', this)
    const { photoPath, watermarkText } = this.data
    // Get image info
    wx.getImageInfo({
      src: photoPath,
      success: (imgInfo) => {
        const w = imgInfo.width
        const h = imgInfo.height
        ctx.drawImage(photoPath, 0, 0, w, h)
        // Watermark text
        const today = new Date()
        const dateStr = today.getFullYear() + '.' + (today.getMonth()+1) + '.' + today.getDate()
        ctx.setFontSize(Math.max(24, w / 20))
        ctx.setFillStyle('rgba(255,255,255,0.9)')
        ctx.setTextAlign('center')
        ctx.fillText(watermarkText, w / 2, h - 60)
        ctx.setFontSize(Math.max(16, w / 30))
        ctx.setFillStyle('rgba(255,255,255,0.7)')
        ctx.fillText(dateStr, w / 2, h - 24)
        ctx.draw(false, () => {
          setTimeout(() => {
            wx.canvasToTempFilePath({
              canvasId: 'watermarkCanvas',
              success: (res) => {
                this.setData({ watermarkedImage: res.tempFilePath })
                wx.hideLoading()
              },
              fail: () => {
                wx.hideLoading()
                wx.showToast({ title: '生成失败，请重试', icon: 'none' })
              }
            }, this)
          }, 500)
        })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '图片加载失败', icon: 'none' })
      }
    })
  },
  saveWatermark() {
    this.saveImage(this.data.watermarkedImage)
  },

  // ─── 日记漫画 ───
  chooseComicPhoto() {
    wx.chooseMedia({
      count: 12 - this.data.comicPhotos.length, mediaType: ['image'], sizeType: ['compressed'],
      success: (res) => {
        const paths = res.tempFiles.map(f => f.tempFilePath)
        this.setData({ comicPhotos: [...this.data.comicPhotos, ...paths], comicResult: '' })
      }
    })
  },
  removeComicPhoto(e) {
    const idx = e.currentTarget.dataset.index
    const photos = [...this.data.comicPhotos]
    photos.splice(idx, 1)
    this.setData({ comicPhotos: photos, comicResult: '' })
  },
  generateComic() {
    wx.showLoading({ title: 'AI生成漫画中...' })
    // Simulate AI comic generation
    setTimeout(() => {
      wx.hideLoading()
      this.setData({ comicResult: this.data.comicPhotos[0] })
      wx.showToast({ title: '漫画已生成！', icon: 'success' })
    }, 2000)
  },
  saveComic() {
    this.saveImage(this.data.comicResult)
  },

  // ─── 漫剧 ───
  chooseSeriesPhoto() {
    wx.chooseMedia({
      count: 12 - this.data.seriesPhotos.length, mediaType: ['image'], sizeType: ['compressed'],
      success: (res) => {
        const paths = res.tempFiles.map(f => f.tempFilePath)
        this.setData({ seriesPhotos: [...this.data.seriesPhotos, ...paths], seriesResult: '' })
      }
    })
  },
  removeSeriesPhoto(e) {
    const idx = e.currentTarget.dataset.index
    const photos = [...this.data.seriesPhotos]
    photos.splice(idx, 1)
    this.setData({ seriesPhotos: photos, seriesResult: '' })
  },
  onSeriesTitleInput(e) {
    this.setData({ seriesTitle: e.detail.value })
  },
  generateSeries() {
    wx.showLoading({ title: 'AI生成漫剧中...' })
    setTimeout(() => {
      wx.hideLoading()
      this.setData({ seriesResult: this.data.seriesPhotos[0] })
      wx.showToast({ title: '漫剧已生成！', icon: 'success' })
    }, 3000)
  },
  saveSeries() {
    this.saveImage(this.data.seriesResult)
  },

  // ─── 通用 ───
  saveImage(path) {
    if (!path) return
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: () => {
        wx.showModal({
          title: '需要相册权限',
          content: '请在设置中允许小程序访问相册',
          success: (res) => {
            if (res.confirm) wx.openSetting()
          }
        })
      }
    })
  }
})

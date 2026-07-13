const app = getApp()

Page({
  data: {
    addressList: [],
    showModal: false,
    editingIndex: -1,
    form: {
      name: '',
      phone: '',
      region: '',
      detail: '',
      isDefault: false
    }
  },

  onShow() {
    this.loadAddresses()
  },

  loadAddresses() {
    const list = wx.getStorageSync('addressList') || []
    this.setData({ addressList: list })
  },

  addAddress() {
    this.setData({
      showModal: true,
      editingIndex: -1,
      form: {
        name: '',
        phone: '',
        region: '',
        detail: '',
        isDefault: this.data.addressList.length === 0
      }
    })
  },

  editAddress(e) {
    const item = e.currentTarget.dataset.item
    const idx = this.data.addressList.findIndex(a => a.id === item.id)
    this.setData({
      showModal: true,
      editingIndex: idx,
      form: {
        name: item.name || '',
        phone: item.phone || '',
        region: item.region || '',
        detail: item.detail || '',
        isDefault: item.isDefault || false
      }
    })
  },

  deleteAddress(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '提示',
      content: '确定删除该地址？',
      success: (res) => {
        if (res.confirm) {
          const list = this.data.addressList.filter(a => a.id !== id)
          this.setData({ addressList: list })
          wx.setStorageSync('addressList', list)
        }
      }
    })
  },

  toggleDefault(e) {
    const id = e.currentTarget.dataset.id
    const isDefault = e.currentTarget.dataset.default === true || e.currentTarget.dataset.default === 'true'
    const list = this.data.addressList.map(a => {
      if (a.id === id) {
        return { ...a, isDefault: !isDefault }
      }
      if (!isDefault && a.id !== id) {
        return { ...a, isDefault: false }
      }
      return a
    })
    this.setData({ addressList: list })
    wx.setStorageSync('addressList', list)
  },

  selectAddress(e) {
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]
    if (prevPage && prevPage.route === 'pages/shop/cart/cart') {
      const item = e.currentTarget.dataset.item
      prevPage.setData({ selectedAddress: item })
      prevPage.onAddressSelected(item)
    }
    wx.navigateBack()
  },

  onFormInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  onRegionChange(e) {
    this.setData({ 'form.region': e.detail.value.join(' ') })
  },

  saveAddress() {
    const form = this.data.form
    if (!form.name.trim()) { wx.showToast({ title: '请填写收货人', icon: 'none' }); return }
    if (!/^1\d{10}$/.test(form.phone)) { wx.showToast({ title: '请填写正确手机号', icon: 'none' }); return }
    if (!form.region) { wx.showToast({ title: '请选择所在地区', icon: 'none' }); return }
    if (!form.detail.trim()) { wx.showToast({ title: '请填写详细地址', icon: 'none' }); return }

    const list = [...this.data.addressList]
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

    const address = {
      id: this.data.editingIndex === -1 ? id : list[this.data.editingIndex].id,
      name: form.name.trim(),
      phone: form.phone.trim(),
      region: form.region,
      detail: form.detail.trim(),
      isDefault: form.isDefault
    }

    if (this.data.editingIndex === -1) {
      if (address.isDefault) list.forEach(a => a.isDefault = false)
      list.push(address)
    } else {
      if (address.isDefault) list.forEach((a, i) => { if (i !== this.data.editingIndex) a.isDefault = false })
      list[this.data.editingIndex] = address
    }

    this.setData({ addressList: list, showModal: false })
    wx.setStorageSync('addressList', list)
    wx.showToast({ title: '保存成功', icon: 'success' })
  },

  closeModal() {
    this.setData({ showModal: false })
  },

  noop() {}
})

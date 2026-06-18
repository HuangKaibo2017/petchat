Component({
  properties: {
    visible: { type: Boolean, value: false }
  },
  methods: {
    onAuth() {
      const app = getApp()
      app.requestAuth((res) => {
        this.triggerEvent('success', res)
        this.setData({ visible: false })
      })
    },
    onCancel() {
      this.setData({ visible: false })
      this.triggerEvent('cancel')
    },
    onMaskTap() {},
    noop() {}
  }
})

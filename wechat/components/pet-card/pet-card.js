Component({
  properties: {
    pet: { type: Object, value: {} },
    selected: { type: Boolean, value: false },
    showArrow: { type: Boolean, value: true }
  },
  methods: {
    onTap() {
      this.triggerEvent('select', { pet: this.properties.pet })
    }
  }
})

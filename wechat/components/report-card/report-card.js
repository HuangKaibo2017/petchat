Component({
  properties: {
    report: { type: Object, value: {} }
  },
  data: {
    typeIcon: '🔮'
  },
  observers: {
    'report.type': function(type) {
      const icons = { emotion: '🔮', health: '💊', risk: '⚡', medical: '📋' }
      this.setData({ typeIcon: icons[type] || '📄' })
    }
  },
  methods: {
    onTap() { this.triggerEvent('tap', { report: this.properties.report }) },
    onFavorite() { this.triggerEvent('favorite', { report: this.properties.report }) },
    onShare() { this.triggerEvent('share', { report: this.properties.report }) }
  }
})

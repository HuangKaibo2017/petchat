Page({
  data: {
    activeTab: 'all',
    reports: [],
    filteredReports: []
  },
  onLoad() {
    const reports = wx.getStorageSync('reports') || []
    this.setData({ reports })
    this.filterReports()
  },
  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
    this.filterReports()
  },
  filterReports() {
    const { activeTab, reports } = this.data
    const filtered = activeTab === 'all' ? reports : reports.filter(r => r.type === activeTab)
    this.setData({ filteredReports: filtered })
  },
  goDetail(e) {
    const report = e.detail.report
    const pageMap = { emotion: 'emotion', health: 'health', risk: 'risk' }
    const page = pageMap[report.type] || 'emotion'
    wx.navigateTo({ url: `/pages/${page}/report/report?id=${report.id}` })
  }
})

const app = getApp()
const API = require('../../../utils/api')

Page({
  data: {
    type: '',
    // Constitution
    sections: [],
    // Medical guide
    guide: null,
    // Common
    pet: null,
    favorited: false,
    reportId: '',
    time: '',
    // Follow-up chat (for medical)
    showChat: false,
    chatInput: '',
    chatMessages: [],
    chatLoading: false,
  },

  onLoad(options) {
    if (options.data) {
      try {
        const data = JSON.parse(decodeURIComponent(options.data))
        const reportId = data.reportId || `rpt_${Date.now()}`
        const time = new Date().toLocaleString()

        if (data.type === 'constitution') {
          this.setData({
            type: 'constitution',
            report: data.report || '',
            sections: this.parseReport(data.report || ''),
            pet: data.pet || null,
            reportId,
            time,
          })
        } else if (data.type === 'newpet') {
          this.setData({
            type: 'newpet',
            guide: data.guide || {},
            reportId,
            time,
          })
        } else if (data.type === 'medical') {
          this.setData({
            type: 'medical',
            guide: data.guide || {},
            pet: data.pet || null,
            reportId,
            time,
          })
        } else {
          this.setData({ type: 'guide', guide: data, time })
        }
      } catch (e) {
        console.warn('解析数据失败:', e)
      }
    }
  },

  // ═══ Constitution Report Parser ═══
  parseReport(md) {
    if (!md) return []
    const sections = []
    const lines = md.split('\n')
    let currentSection = null
    let currentSubsections = []
    let currentSub = null
    let currentItems = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      if (line.startsWith('# ') && !line.startsWith('## ')) continue

      if (line.startsWith('## ')) {
        if (currentSection) {
          if (currentSub) { currentSub.items = currentItems.slice(); currentSubsections.push(currentSub); currentSub = null; currentItems = []; }
          sections.push({ title: currentSection, subsections: currentSubsections.slice(), items: currentItems.slice(), isBaseInfo: currentSection.includes('基础信息') })
        }
        currentSection = line.replace(/^## /, '').trim()
        currentSubsections = []; currentSub = null; currentItems = []
        continue
      }

      const boldMatch = line.match(/^\*\*(.+?)\*\*[：:]?\s*(.*)/)
      if (boldMatch) {
        if (currentSub) { currentSub.items = currentItems.slice(); currentSubsections.push(currentSub); currentItems = []; }
        currentSub = { label: boldMatch[1].trim(), content: boldMatch[2].trim(), items: [], isRisk: boldMatch[1].includes('高风险') || boldMatch[1].includes('中风险') || boldMatch[1].includes('状态良好') }
        continue
      }

      const numMatch = line.match(/^(\d+)\.\s+\*?\*?(.+?)\*?\*?\s*$/)
      if (numMatch && currentSection && currentSection.includes('十二项体质维度')) {
        currentItems.push({ index: parseInt(numMatch[1]), text: numMatch[2].replace(/\*+/g, '').trim() })
        continue
      }

      if (line.startsWith('- ') || line.startsWith('▶')) {
        const text = line.replace(/^[-▶]\s*/, '').trim()
        if (text.startsWith('**')) {
          const subMatch = text.match(/^\*\*(.+?)\*\*[：:]?\s*(.*)/)
          if (subMatch) {
            if (currentSub) { currentSub.items = currentItems.slice(); currentSubsections.push(currentSub); currentItems = []; }
            currentSub = { label: subMatch[1].trim(), content: subMatch[2].trim(), items: [], isRisk: subMatch[1].includes('高风险') || subMatch[1].includes('中风险') || subMatch[1].includes('状态良好') }
          } else { currentItems.push({ text: text.replace(/\*+/g, '').trim() }) }
        } else { currentItems.push({ text: text.replace(/\*+/g, '').trim() }) }
        continue
      }

      if (line.startsWith('> ')) { currentItems.push({ text: line.replace(/^> /, '').trim(), isQuote: true }); continue }

      const cleanLine = line.replace(/\*+/g, '').trim()
      if (cleanLine) {
        if (currentSub) { currentSub.content = currentSub.content ? currentSub.content + '\n' + cleanLine : cleanLine }
        else { currentItems.push({ text: cleanLine }) }
      }
    }

    if (currentSection) {
      if (currentSub) { currentSub.items = currentItems.slice(); currentSubsections.push(currentSub) }
      sections.push({ title: currentSection, subsections: currentSubsections.slice(), items: currentItems.slice(), isBaseInfo: currentSection.includes('基础信息') })
    }
    return sections
  },

  getSectionIcon(title) {
    const map = { '十二项体质维度': '🔬', '时空气运影响': '🌤️', '象数能量调和': '✨', '综合体质总结': '📋', '现存问题': '🔍', '健康风险分级': '⚡', '专属调理': '🌿', '品种': '🧬' }
    for (const [key, icon] of Object.entries(map)) { if (title.includes(key)) return icon }
    return '📌'
  },

  getRiskClass(label) {
    if (label && label.includes('高风险')) return 'risk-high'
    if (label && label.includes('中风险')) return 'risk-mid'
    if (label && label.includes('状态良好')) return 'risk-good'
    return ''
  },

  getRiskEmoji(riskClass) {
    if (riskClass === 'risk-high') return '🔴'
    if (riskClass === 'risk-mid') return '🟡'
    if (riskClass === 'risk-good') return '✅'
    return ''
  },

  // ═══ Follow-up Chat ═══
  toggleChat() { this.setData({ showChat: !this.data.showChat }) },

  onChatInput(e) { this.setData({ chatInput: e.detail.value }) },

  async sendChat() {
    const { chatInput, chatMessages, pet } = this.data
    if (!chatInput.trim()) return
    const userMsg = { role: 'user', content: chatInput, time: new Date().toLocaleTimeString() }
    const msgs = chatMessages.concat([userMsg])
    this.setData({ chatMessages: msgs, chatInput: '', chatLoading: true })

    try {
      const context = msgs.slice(-4).map(m => `${m.role === 'user' ? '学生' : '教授'}: ${m.content}`).join('\n')
      const result = await API.post('/api/medical/followup', {
        petId: pet ? pet.id : undefined,
        question: chatInput,
        context,
      })
      const reply = result.reply || '抱歉，我暂时无法回答。建议咨询专业兽医。'
      this.setData({
        chatMessages: msgs.concat([{ role: 'assistant', content: reply, time: new Date().toLocaleTimeString() }]),
        chatLoading: false,
      })
    } catch (err) {
      this.setData({ chatLoading: false })
      wx.showToast({ title: '发送失败', icon: 'none' })
    }
  },

  // ═══ Actions ═══
  async toggleFavorite() {
    const { reportId, favorited } = this.data
    try {
      await API.Favorite.toggle(reportId, 'medical')
      this.setData({ favorited: !favorited })
      wx.showToast({ title: !favorited ? '已收藏' : '已取消收藏', icon: 'none' })
    } catch {
      this.setData({ favorited: !favorited })
      wx.showToast({ title: !favorited ? '已收藏' : '已取消收藏', icon: 'none' })
    }
  },

  shareReport() { wx.showShareMenu({ withShareTicket: true }) },
})

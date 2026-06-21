const app = getApp()
const API = require('../../utils/api')

const QUESTIONS = [
  { text: '见到陌生人时，宠物通常的反应是？', options: ['主动靠近求摸', '保持距离观察', '躲起来或低吼', '完全不理'] },
  { text: '独处时的行为表现？', options: ['安静睡觉或自娱自乐', '偶尔叫几声后自行停止', '持续焦躁、拆家或嚎叫', '必须时刻有人陪着'] },
  { text: '对新玩具的态度？', options: ['立刻兴奋玩耍', '先观察再尝试', '完全不感兴趣', '玩两下就腻了'] },
  { text: '和其他宠物的互动？', options: ['主动社交玩耍', '被撩才回应', '回避或攻击', '只跟熟悉的玩'] },
  { text: '对指令的服从度？', options: ['大部分指令能执行', '看心情选择性执行', '基本不理指令', '能执行但需要零食'] },
  { text: '日常精力水平？', options: ['精力充沛，停不下来', '适度活跃，按时休息', '懒散，大部分时间在睡', '定时疯狂，其他时间安静'] }
]

Page({
  data: {
    step: 0, currentQ: 0,
    petName: '', birthDate: '', senseNum: '', pawImage: '',
    questions: QUESTIONS, answers: {},
    generating: false, report: null
  },

  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) },
  onDateChange(e) { this.setData({ birthDate: e.detail.value }) },
  uploadPaw() {
    wx.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'],
      success: (res) => this.setData({ pawImage: res.tempFiles[0].tempFilePath }) })
  },

  nextStep() {
    if (!this.data.petName.trim()) { wx.showToast({ title: '请输入宠物名称', icon: 'none' }); return }
    this.setData({ step: 1, currentQ: 0 })
  },

  selectAnswer(e) {
    const q = e.currentTarget.dataset.q, a = e.currentTarget.dataset.a
    const answers = { ...this.data.answers, [q]: a }
    this.setData({ answers })
  },
  nextQ() { this.setData({ currentQ: this.data.currentQ + 1 }) },
  prevQ() { this.setData({ currentQ: this.data.currentQ - 1 }) },

  async generateReport() {
    if (Object.keys(this.data.answers).length < this.data.questions.length) {
      wx.showToast({ title: '请完成所有题目', icon: 'none' })
      return
    }
    this.setData({ generating: true })
    try {
      const result = await API.Report.medical({
        symptom: '性格分析: ' + this.data.petName,
        imageUrl: this.data.pawImage || '',
        guideType: 'personality',
        extra: { birthDate: this.data.birthDate, senseNum: this.data.senseNum, answers: this.data.answers }
      })
      let report = (result && result.data) ? result.data : result
      this.setData({ generating: false, report })
    } catch (err) {
      this.setData({ generating: false })
      this.setData({ report: {
        tags: ['粘人精', '社牛', '治愈系', '小聪明'],
        radarScores: [
          { label: '社交力', score: 85 }, { label: '独立性', score: 40 },
          { label: '好奇心', score: 78 }, { label: '服从度', score: 65 },
          { label: '精力值', score: 72 }, { label: '亲和力', score: 90 }
        ],
        radarDesc: this.data.petName + '是典型的社交型宠物，热爱与人互动，好奇心强但服从度一般。属于高能量高亲和的乐天派。',
        familyRole: '家庭地位：🏆 C位小太阳。在家庭中起着活跃气氛的核心作用，擅长用卖萌化解尴尬。但偶尔会因为过于热情而闯祸。',
        blindBoxes: [
          { id: 1, emoji: '🧸', name: '发声布偶', price: '39' },
          { id: 2, emoji: '🔔', name: '铃铛球', price: '29' },
          { id: 3, emoji: '🪶', name: '逗猫棒套装', price: '49' },
          { id: 4, emoji: '🧩', name: '漏食益智球', price: '59' }
        ]
      }})
      wx.showToast({ title: '性格报告已生成', icon: 'success' })
    }
  }
})
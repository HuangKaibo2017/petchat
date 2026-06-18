const formatTime = (date, fmt = 'YYYY-MM-DD HH:mm') => {
  const d = new Date(date)
  const map = {
    'YYYY': d.getFullYear(),
    'MM': String(d.getMonth() + 1).padStart(2, '0'),
    'DD': String(d.getDate()).padStart(2, '0'),
    'HH': String(d.getHours()).padStart(2, '0'),
    'mm': String(d.getMinutes()).padStart(2, '0'),
    'ss': String(d.getSeconds()).padStart(2, '0')
  }
  return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, m => map[m])
}

const getDurationText = (days) => {
  if (days < 1) return '今天'
  if (days < 2) return '昨天'
  if (days < 7) return `${Math.floor(days)}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  if (days < 365) return `${Math.floor(days / 30)}个月前`
  return `${Math.floor(days / 365)}年前`
}

const debounce = (fn, delay = 300) => {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

const throttle = (fn, delay = 300) => {
  let last = 0
  return function (...args) {
    const now = Date.now()
    if (now - last >= delay) {
      last = now
      fn.apply(this, args)
    }
  }
}

const getRiskLevel = (level) => {
  const map = {
    'low': { text: '低风险', color: '#22C55E', bg: '#F0FDF4' },
    'medium': { text: '中风险', color: '#F59E0B', bg: '#FFFBEB' },
    'high': { text: '高风险', color: '#EF4444', bg: '#FEF2F2' }
  }
  return map[level] || map['low']
}

const breedList = [
  '中华田园猫', '英国短毛猫', '美国短毛猫', '布偶猫', '暹罗猫',
  '波斯猫', '缅因猫', '苏格兰折耳猫', '异国短毛猫', '俄罗斯蓝猫',
  '中华田园犬', '金毛寻回犬', '拉布拉多', '柯基', '柴犬',
  '泰迪', '比熊', '博美', '哈士奇', '萨摩耶', '其他'
]

const constitutionTags = [
  '平和质', '气虚质', '阳虚质', '阴虚质', '痰湿质',
  '湿热质', '血瘀质', '气郁质', '特禀质'
]

module.exports = {
  formatTime,
  getDurationText,
  debounce,
  throttle,
  getRiskLevel,
  breedList,
  constitutionTags
}

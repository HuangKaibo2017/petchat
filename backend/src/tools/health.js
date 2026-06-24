/**
 * 健康指标计算工具
 * 计算出当前值是否异常
 */
const tools = require('./registry')

tools.register('check_vitals', {
  description: '根据宠物健康指标判断是否异常，返回各指标的状态和建议',
  parameters: {
    type: 'object',
    properties: {
      weight: { type: 'number', description: '体重（kg）' },
      temperature: { type: 'number', description: '体温（℃）' },
      heartRate: { type: 'number', description: '心率（次/分）' },
      breed: { type: 'string', description: '品种' },
      age: { type: 'number', description: '年龄（岁）' },
    },
    required: ['weight', 'temperature'],
  },
  handler: async ({ weight, temperature, heartRate, breed, age }) => {
    const results = []

    // 体温检查（正常 38-39.2℃）
    if (temperature < 37.5) results.push({ item: '体温', status: '偏低', value: `${temperature}℃`, advice: '注意保暖，建议就医' })
    else if (temperature > 39.5) results.push({ item: '体温', status: '偏高', value: `${temperature}℃`, advice: '可能发烧，建议就医' })
    else results.push({ item: '体温', status: '正常', value: `${temperature}℃`, advice: '' })

    // 心率检查（狗：60-140，猫：140-220）
    if (heartRate) {
      const isCat = breed && breed.includes('猫')
      const [low, high] = isCat ? [140, 220] : [60, 140]
      if (heartRate < low) results.push({ item: '心率', status: '偏低', value: `${heartRate}次/分`, advice: '建议检查心脏' })
      else if (heartRate > high) results.push({ item: '心率', status: '偏高', value: `${heartRate}次/分`, advice: '可能紧张或发热' })
      else results.push({ item: '心率', status: '正常', value: `${heartRate}次/分`, advice: '' })
    }

    results.push({ item: '体重', status: '已记录', value: `${weight}kg`, advice: '保持观察' })

    return { results, summary: `${results.filter(r => r.status !== '正常' && r.status !== '已记录').length} 项指标异常` }
  },
})

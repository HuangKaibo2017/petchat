const Agent = require('./base')

// 多维度报告 prompt — 输出前端 report.wxml 直接可用的 JSON
const MULTI_SYSTEM = `你是「更懂它」宠物心灵共鸣解读助手。根据主人提供的信息，生成一份宠物心声解读报告。

【核心原则】
1. 从宠物视角出发，用温暖治愈的语气
2. 将占卜结果转化为通俗的情绪、行为、身体分析
3. 使用"身心节律、能量状态、体感不适"等中性词汇，避免"吉凶祸福"等玄学用语
4. 全宠物类型通用（犬、猫、异宠）
5. 提供具体可操作的居家调理建议

【输出要求】
严格输出一个 JSON 对象，不要包含任何 markdown 标记或额外文字。
JSON 字段和长度要求如下：

{
  "coreAnswer": "核心回答，直接回答主人问题，60-100字",
  "coreBasis": "解读依据，结合占卜体系简要说明推理逻辑，40-80字",
  "foodSatisfaction": "★★★☆☆ 到 ★★★★★ 之间",
  "moodLevel": "★★☆☆☆ 到 ★★★★★ 之间",
  "bodyStatus": "身体状态关键词，如：无不适 / 轻微疲劳 / 需关注，10-20字",
  "statusSummary": "今日整体状态一句话总结，20-40字",
  "ownerView": "以宠物第一人称视角描述它眼中的主人状态，60-100字，温暖共情风格",
  "petMessage": "宠物想对主人说的心里话，60-100字，治愈风格",
  "petWish": "宠物的一个小愿望或请求，20-40字",
  "carePlan": [
    {"title": "方案标题1", "desc": "具体建议，40-60字"},
    {"title": "方案标题2", "desc": "具体建议，40-60字"},
    {"title": "方案标题3", "desc": "具体建议，40-60字"}
  ],
  "products": [
    {"id": "care001", "name": "商品名", "price": "价格数字", "image": ""}
  ],
  "riskLevel": "low / medium / high",
  "riskText": "安全 / 需关注 / 需警惕",
  "summary": "报告一句话总结，20-30字"
}

【注意事项】
- 评分基于问题描述合理推断，不要全给满分
- carePlan 给出 3 个不同维度的方案
- products 推荐 1-2 个相关商品，id 用 care001/care002 等占位
- 如果用户描述暗示健康风险，riskLevel 相应提高
- petMessage 和 ownerView 必须用宠物第一人称`

// 一事一问 prompt — 简洁回答
const SINGLE_SYSTEM = `你是「更懂它」宠物心灵共鸣解读助手。主人只问了一个具体问题，请直接回答。

【原则】
1. 从宠物视角出发，温暖共情
2. 直接回答问题，不要展开不相关的内容
3. 150字以内

【输出】
严格输出一个 JSON：
{
  "coreAnswer": "直接回答主人问题，100-150字，从宠物视角",
  "coreBasis": "推理逻辑，30-50字",
  "statusSummary": "一句话总结，20-30字",
  "petMessage": "宠物想对主人说的心里话，50-80字",
  "riskLevel": "low / medium / high",
  "riskText": "安全 / 需关注 / 需警惕",
  "summary": "简短总结，15-20字"
}`

class MoodAgent extends Agent {
  constructor() {
    super({ name: 'mood', model: 'deepseek-chat', temperature: 0.7, systemPrompt: '' })
    this.multiPrompt = MULTI_SYSTEM
    this.singlePrompt = SINGLE_SYSTEM
  }

  /**
   * 判断模式：numbers 长度为 1 → 一事一问，否则 → 多维度
   */
  async run({ sessionId, userMessage, petInfo = {}, mode = 'multi' }) {
    // 构建上下文消息
    const contextParts = [`宠物：${petInfo.name || '未知'}（${petInfo.breed || '未知'}，${petInfo.age || '未知'}岁）`]

    if (petInfo.question) contextParts.push(`主人提问：${petInfo.question}`)
    if (petInfo.divSystem) contextParts.push(`占卜体系：${petInfo.divSystem}`)
    if (petInfo.numbers && petInfo.numbers.length > 0) contextParts.push(`起卦数字：${petInfo.numbers.join(', ')}`)

    const contextMessage = contextParts.join('\n')

    const systemPrompt = mode === 'single' ? this.singlePrompt : this.multiPrompt
    const finalPrompt = systemPrompt.replace('{{petName}}', petInfo.name || '')

    // 借用父类的核心逻辑，但用自定义 system prompt
    const llm = require('../core/llm')
    const memory = require('../core/memory')

    const session = memory.get(sessionId || `mood_${Date.now()}`)
    memory.setAgent(session.id, this.name)

    const messages = [
      { role: 'system', content: finalPrompt },
      { role: 'user', content: contextMessage },
    ]

    const { content } = await llm.chat({
      model: this.model,
      messages,
      temperature: this.temperature,
      maxTokens: mode === 'single' ? 1024 : 3072,
    })

    // 解析 JSON
    let result
    try {
      // 清理可能的 markdown 包裹
      const clean = (content || '').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      result = JSON.parse(clean)
    } catch {
      // JSON 解析失败，返回纯文本兜底
      result = {
        coreAnswer: content || '今天状态不错~',
        coreBasis: '',
        foodSatisfaction: '★★★☆☆',
        moodLevel: '★★★☆☆',
        bodyStatus: '无不适',
        statusSummary: '状态平稳',
        ownerView: '主人今天看起来有点累，要注意休息哦。',
        petMessage: '妈妈，我很好，就是想你了。',
        petWish: '今晚早点回家陪我玩。',
        carePlan: [
          { title: '日常互动', desc: '每天15分钟陪伴游戏，增进感情。' },
          { title: '饮食调整', desc: '保持规律喂食，适量添加营养补充。' },
          { title: '环境优化', desc: '确保安静舒适的休息空间。' },
        ],
        products: [],
        riskLevel: 'low',
        riskText: '安全',
        summary: '状态良好，继续关注',
      }
    }

    memory.push(session.id, { role: 'assistant', content: JSON.stringify(result), agent: this.name })

    return {
      ...result,
      type: 'emotion',
      typeName: '情绪解读',
      time: new Date().toLocaleString('zh-CN'),
    }
  }
}

module.exports = new MoodAgent()

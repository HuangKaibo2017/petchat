const CAT_SIZES = 'XS 2-3斤/15cm，S 4-6斤/18cm，M 7-9斤/23cm，L 10-12斤/27cm，XL 13-16斤/32cm，XXL 20斤左右/32cm，S调节款15-30cm，M调节款30-35cm'
const DOG_SIZES = 'S 23-27cm，M 26-32cm，L 30.5-37cm，XL 38-46cm，XXL 45-60cm，XXXL 60-70cm'

const DOG_HERBS = ['宽胸理气珠', '化浊清肺珠', '清心宁神珠', '护腰壮骨珠', '疏风润肤珠', '清胆定志珠', '温脾暖中珠', '固表防感珠']
const CAT_HERBS = ['轻身化浊珠', '宣通润肤珠', '温阳护元珠', '滋水涵木珠', '清肝降火珠', '理中暖胃珠', '解郁舒情珠', '固本防惊珠']

const COMMON_NECKLACE_DETAIL = {
  summary: '科研级AI中兽医辨证与古法手工本草香疗结合的宠物康养佩饰，手机轻触NFC即可进入专属云端康养后台，适配猫狗日常情志舒缓、体质养护与居家健康管理。',
  highlights: [
    'NFC无源芯片，免充电、免下载APP，手机轻触即可读取',
    'AI中兽医辨证系统，结合行为、体征、舌象、眼象进行体质与情志分析',
    '天然本草香珠外用闻香，非药非食，不增加肝肾与脾胃代谢负担',
    '轻量亲肤织带与安全快拆卡扣，兼顾日常佩戴、牵引和应急挣脱',
    '防水耐磨，适配居家、户外、寄养、洗护等多场景'
  ],
  sections: [
    {
      title: '产品介绍',
      paragraphs: [
        '更懂它·知宠康乐本草智能NFC项链，依托宠物临床体质数据库与中兽医辨证思路，针对犬猫常见亚健康、情志波动和体质偏性提供日常养护参考。',
        '产品以无创穿戴闻香为核心，不喂食、不打针，结合专属本草香珠进行长期、温和的居家康养。'
      ]
    },
    {
      title: 'NFC智能核心',
      bullets: [
        'AI智能情志解码：辅助识别躁动、易怒、胆小、应激、焦虑等隐性情绪状态。',
        '五运六气与六经辨证：结合多维信息生成宠物体质筛查与养护建议。',
        '人宠共生健康预警：通过宠物体质状态，辅助主人关注家庭共处环境与作息健康。'
      ]
    },
    {
      title: '本草香疗原理',
      paragraphs: [
        '本草佩香源自传统外治体系，甄选天然草木花卉制珠，通过宠物日常嗅闻与外用佩戴，进行温和、持续的气味养护。',
        '香珠可串于项圈佩戴，也可悬挂于宠物卧榻周边。本品仅作外用闻香配饰，严禁喂食。'
      ]
    },
    {
      title: '古法手作预售',
      bullets: [
        '每枚香珠需经历选药、炮制、配伍、打粉、合泥、搓珠、阴干、罨藏退火等工序。',
        '下单后约45-60天发货，遇连续阴雨天气可能顺延。',
        '纯草本手作无化学香精、无工业速干剂、无精油添加，香气一般可持续4-5个月。'
      ]
    },
    {
      title: '安全提示',
      bullets: [
        '本文品种体质倾向仅作日常养护参考，不构成诊断或医疗建议。',
        '本品为外用闻香佩饰，非药品，无法替代兽医处方及临床治疗。',
        '禁止喂食、啃咬吞食；草本过敏体质、孕宠慎用。',
        '初次使用建议先短时间嗅闻适应，若出现明显不适请立即摘除并保持通风。'
      ]
    }
  ]
}

function makeNecklaceDetail(options) {
  const catSizes = Object.prototype.hasOwnProperty.call(options, 'catSizes') ? options.catSizes : CAT_SIZES
  const dogSizes = Object.prototype.hasOwnProperty.call(options, 'dogSizes') ? options.dogSizes : DOG_SIZES
  const specs = [
    { label: '适用品种', value: options.petType || '猫、狗' },
    { label: '猫咪尺码', value: catSizes },
    { label: '狗狗尺码', value: dogSizes }
  ]

  if (options.colors) specs.push({ label: '可选颜色', value: options.colors })
  if (options.buckles) specs.push({ label: '可选扣具', value: options.buckles })

  return Object.assign({
    title: options.title,
    specs: specs.filter(item => item.value),
    herbGroups: [
      { title: '犬用本草款式', items: options.dogHerbs || DOG_HERBS },
      { title: '猫用本草款式', items: options.catHerbs || CAT_HERBS }
    ].filter(group => group.items && group.items.length)
  }, COMMON_NECKLACE_DETAIL)
}

function makeToyDetail(options) {
  return {
    title: options.title,
    summary: '科研级AI中兽医辨证与NFC智能入口结合的宠物互动玩具，适合狗狗日常玩耍、情绪舒缓与健康养护管理。',
    specs: [
      { label: '适用品种', value: '狗' },
      { label: '可选款式', value: '章鱼、鸟' }
    ],
    highlights: [
      'NFC无源芯片，手机轻触即可进入专属云端康养后台',
      '通过AI中兽医模型辅助分析宠物健康与情志状态',
      '区别普通玩具，兼顾互动陪伴与日常健康管理入口',
      '无需充电、无需下载APP，日常使用更轻便'
    ],
    herbGroups: [],
    sections: [
      {
        title: '产品介绍',
        paragraphs: [
          '更懂它·知宠康乐智能NFC玩具，依托AI中兽医辨证体系与宠物临床体质数据库，辅助主人关注宠物先天体质偏性、亚健康状态与情志情绪。',
          '产品在日常互动玩耍之外，提供一触即达的健康管理入口，适合作为全年龄段犬只的居家陪伴与康养辅助用品。'
        ]
      },
      {
        title: 'NFC智能核心',
        bullets: [
          'AI智能情志解码：辅助识别躁动、易怒、胆小、应激、焦虑等隐性状态。',
          '全维度体质筛查：结合宠物体征、舌象、眼象等信息生成体质养护建议。',
          '人宠共生健康预警：辅助主人关注长期共处带来的作息、环境与健康联动。',
          '无源无感NFC芯片：免充电、免繁琐操作，手机一碰即可读取。'
        ]
      },
      {
        title: '安全提示',
        bullets: [
          '本文所述体质倾向仅作日常养护参考，不构成诊断或医疗建议。',
          '宠物出现急症、重症或持续异常时，请及时前往正规动物医院就诊。',
          '使用过程中请定期检查玩具状态，如出现破损、开裂或松脱，应及时停止使用。'
        ]
      }
    ]
  }
}

function makeHandmadeDetail(options) {
  return {
    title: options.title,
    summary: '手作类商品的原始文档暂未填写具体正文，详情页先展示基础购买信息与预售/免责说明，具体尺寸、颜色和本草配置以下单确认信息为准。',
    specs: [
      { label: '商品类型', value: '手作挂件' },
      { label: '尺寸', value: '以实际手作款式为准' },
      { label: '颜色', value: '以图片展示与下单确认信息为准' },
      { label: '本草', value: '以定制配置或客服确认为准' }
    ],
    highlights: [
      '手作商品存在纹理、色泽和细节差异，属于正常工艺表现',
      '适合挂饰、装饰或定制搭配场景',
      '下单前建议确认尺寸、颜色、本草配置等关键信息'
    ],
    herbGroups: [],
    sections: [
      {
        title: '预售声明',
        bullets: [
          '手作商品可能需要按批次制作或整理，具体发货时间以下单页面和客服确认为准。',
          '不同批次的手作细节可能略有差异，请以实物为准。'
        ]
      },
      {
        title: '免责条款',
        bullets: [
          '商品页面展示信息仅作选购参考，不构成医疗、诊断或治疗建议。',
          '涉及宠物佩戴、悬挂或接触使用时，请主人根据宠物性格与实际情况看护使用。',
          '若宠物出现啃咬、吞食风险或明显抗拒，请及时取下并停止使用。'
        ]
      }
    ]
  }
}

const SHOP_ITEMS = [
  { id: 'handmade-1', category: 'handmade', categoryName: '手作', name: '手作挂件 1', price: 49, images: ['/images/shop/handmade/WechatIMGb2313cba0db9517a8ad72b64effb6b06.jpg'], detail: makeHandmadeDetail({ title: '手作挂件 1' }) },
  { id: 'handmade-2', category: 'handmade', categoryName: '手作', name: '手作挂件 2', price: 49, images: ['/images/shop/handmade/WechatIMGf1d7b50e1dd753e6557847ce413eaba1.jpg'], detail: makeHandmadeDetail({ title: '手作挂件 2' }) },
  { id: 'necklace-1', category: 'necklace', categoryName: '项链', name: '水晶菩提象数本草智能项链', price: 68, images: ['/images/shop/necklace/1/1.jpg', '/images/shop/necklace/1/2.jpg', '/images/shop/necklace/1/3.jpg', '/images/shop/necklace/1/4.jpg'], detail: makeNecklaceDetail({ title: '更懂它-知宠康乐-水晶菩提象数本草智能项链（NFC版）', colors: '紫色、墨绿色、深棕色、粉色、天蓝色' }) },
  { id: 'necklace-2', category: 'necklace', categoryName: '项链', name: '本草智能项链硅胶扣款', price: 68, images: ['/images/shop/necklace/2/1.jpg', '/images/shop/necklace/2/2.jpg', '/images/shop/necklace/2/3.jpg', '/images/shop/necklace/2/4.jpg'], detail: makeNecklaceDetail({ title: '更懂它-知宠康乐-本草智能项链（NFC版）（硅胶扣）', colors: '粉色、黑色' }) },
  { id: 'necklace-3', category: 'necklace', categoryName: '项链', name: '珍珠水晶本草智能项链', price: 68, images: ['/images/shop/necklace/3/1.jpg', '/images/shop/necklace/3/2.jpg', '/images/shop/necklace/3/3.jpg', '/images/shop/necklace/3/4.jpg'], detail: makeNecklaceDetail({ title: '更懂它-知宠康乐-珍珠水晶本草智能项链（NFC版）', buckles: '塑料插扣、金属插扣、金属圆扣' }) },
  { id: 'necklace-4', category: 'necklace', categoryName: '项链', name: '水晶菩提硅胶带智能项链', price: 68, images: ['/images/shop/necklace/4/1.jpg', '/images/shop/necklace/4/2.jpg', '/images/shop/necklace/4/3.jpg', '/images/shop/necklace/4/4.jpg'], detail: makeNecklaceDetail({ title: '更懂它-知宠康乐-本草智能象数项链（NFC版）（水晶菩提硅胶带）', colors: '松针绿、砂粉、薰衣草、蓝绿色、深蓝、烟紫、黄色、黑色、酒红、梅子色、杏色' }) },
  { id: 'necklace-5', category: 'necklace', categoryName: '项链', name: '撞色硅胶本草智能项链', price: 68, images: ['/images/shop/necklace/5/1.jpg', '/images/shop/necklace/5/2.jpg', '/images/shop/necklace/5/3.jpg', '/images/shop/necklace/5/4.jpg'], detail: makeNecklaceDetail({ title: '更懂它-知宠康乐-象数本草智能项链（NFC版）撞色硅胶版', colors: '白色、云雾灰、酒红、紫丁香、碧海、松针绿、大红、复古玫粉、午夜蓝、橙色、黄色、粉色' }) },
  { id: 'necklace-6', category: 'necklace', categoryName: '项链', name: '菩提针织扣本草智能项链', price: 68, images: ['/images/shop/necklace/6/1.jpg', '/images/shop/necklace/6/2.jpg', '/images/shop/necklace/6/3.jpg', '/images/shop/necklace/6/4.jpg'], detail: makeNecklaceDetail({ title: '更懂它-知宠康乐-象数本草智能项链（NFC版）菩提针织扣款', colors: '棕色、绿色、蓝色、黑色' }) },
  { id: 'necklace-7', category: 'necklace', categoryName: '项链', name: '水晶菩提本草智能项链', price: 68, images: ['/images/shop/necklace/7/1.jpg', '/images/shop/necklace/7/2.jpg', '/images/shop/necklace/7/3.jpg', '/images/shop/necklace/7/4.jpg'], detail: makeNecklaceDetail({ title: '更懂它-知宠康乐-水晶菩提本草智能项链（NFC版）', colors: '紫色、墨绿色、深棕色、粉色、天蓝色' }) },
  { id: 'necklace-8', category: 'necklace', categoryName: '项链', name: '软香笼本草智能项圈', price: 68, images: ['/images/shop/necklace/8/1.jpg', '/images/shop/necklace/8/2.jpg', '/images/shop/necklace/8/3.jpg', '/images/shop/necklace/8/4.jpg'], detail: makeNecklaceDetail({ title: '更懂它-知宠康乐-本草智能项圈（NFC版）软香笼版', catSizes: '', dogSizes: 'S 26-42cm，M 31-50cm，L 38-60cm', colors: '棕色、黑色、红色、军绿、蓝色', catHerbs: [] }) },
  { id: 'necklace-9', category: 'necklace', categoryName: '项链', name: '菩提本草智能项链', price: 68, images: ['/images/shop/necklace/9/1.jpg', '/images/shop/necklace/9/2.jpg', '/images/shop/necklace/9/3.jpg', '/images/shop/necklace/9/4.jpg'], detail: makeNecklaceDetail({ title: '更懂它-知宠康乐-菩提本草智能项链（NFC版）', colors: '草绿色、黄色、绿色、深蓝、浅蓝、白色、玫粉、黑色、橙色、红色、紫色' }) },
  { id: 'necklace-10', category: 'necklace', categoryName: '项链', name: '菩提本草智能项圈', price: 68, images: ['/images/shop/necklace/10/1.jpg', '/images/shop/necklace/10/2.jpg', '/images/shop/necklace/10/3.jpg', '/images/shop/necklace/10/4.jpg'], detail: makeNecklaceDetail({ title: '更懂它-知宠康乐-菩提本草智能项圈（NFC版）', colors: '黑色、红色、黄色、深蓝色、卡其色、玫红色、紫色、白色、棕色、粉色、天蓝色' }) },
  { id: 'toy-1', category: 'toy', categoryName: '玩具', name: '智能玩具', price: 29, images: ['/images/shop/toy/toy.jpg'], detail: makeToyDetail({ title: '更懂它-知宠康乐-智能玩具（NFC版）' }) }
]

function getProductsByCategory(category) {
  return SHOP_ITEMS.filter(item => category === 'all' || item.category === category)
}

function getProductById(id) {
  return SHOP_ITEMS.find(item => item.id === id)
}

module.exports = {
  SHOP_ITEMS,
  getProductsByCategory,
  getProductById
}

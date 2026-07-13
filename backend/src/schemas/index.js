const { z } = require('zod')

const schemas = {}

schemas.wechatAuth = z.object({
  code: z.string().min(1, '缺少微信登录 code'),
  nickName: z.string().optional(),
  avatarUrl: z.string().optional(),
})

schemas.emotionReport = z.object({
  petId: z.union([z.string(), z.number()], { message: '缺少宠物 ID' }),
  question: z.string().optional(),
  divSystem: z.string().optional(),
  numbers: z.array(z.number()).optional(),
  imageUrl: z.string().optional(),
  reportType: z.string().optional(),
})

schemas.healthReport = z.object({
  petId: z.union([z.string(), z.number()], { message: '缺少宠物 ID' }),
  symptom: z.string().optional(),
  duration: z.string().optional(),
  abnormal: z.string().optional(),
  numbers: z.array(z.number()).optional(),
  imageUrl: z.string().optional(),
})

schemas.riskReport = z.object({
  petId: z.union([z.string(), z.number()], { message: '缺少宠物 ID' }),
  ownerBirthday: z.string().optional(),
  reportId: z.any().optional(),
  tongueImage: z.string().optional(),
})

schemas.constitutionReport = z.object({
  petId: z.union([z.string(), z.number()], { message: '缺少宠物 ID' }),
  ownerBirthday: z.string().optional(),
})

schemas.medicalGuide = z.object({
  petId: z.union([z.string(), z.number()]).optional(),
  symptom: z.string().optional(),
  duration: z.string().optional(),
})

schemas.medicalFollowup = z.object({
  sessionId: z.string().optional(),
  message: z.string().optional(),
})

schemas.petCreate = z.object({
  name: z.string().min(1, '宠物名称不能为空').max(64),
  petTypeId: z.number().int().min(1).optional(),
  breedId: z.number().int().nullable().optional(),
  genderId: z.number().int().optional(),
  birthDate: z.string().nullable().optional(),
  birthYear: z.number().int().nullable().optional(),
  birthMonth: z.number().int().min(1).max(12).nullable().optional(),
  weight: z.number().positive().nullable().optional(),
  sterilized: z.boolean().optional(),
  vaccinated: z.boolean().optional(),
  avatar: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

schemas.petUpdate = z.object({
  name: z.string().max(64).optional(),
  petTypeId: z.number().int().min(1).optional(),
  breedId: z.number().int().nullable().optional(),
  genderId: z.number().int().optional(),
  birthDate: z.string().nullable().optional(),
  birthYear: z.number().int().nullable().optional(),
  birthMonth: z.number().int().min(1).max(12).nullable().optional(),
  weight: z.number().positive().nullable().optional(),
  sterilized: z.boolean().optional(),
  vaccinated: z.boolean().optional(),
  avatar: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

schemas.orderCreate = z.object({
  productId: z.union([z.string(), z.number()]),
  skuId: z.union([z.string(), z.number()]).optional(),
  productName: z.string().optional(),
  price: z.number().optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  receiver: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
})

schemas.chatSessionCreate = z.object({
  petId: z.union([z.string(), z.number()], { message: '缺少 petId' }),
})

schemas.chatSend = z.object({
  sessionId: z.union([z.string(), z.number()], { message: '缺少 sessionId' }),
  message: z.string().min(1, '消息内容不能为空'),
})

schemas.payJsapi = z.object({
  orderId: z.union([z.string(), z.number()], { message: '缺少 orderId' }),
})

module.exports = schemas

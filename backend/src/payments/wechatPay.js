const crypto = require('crypto')
const fs = require('fs')
const https = require('https')

const WECHAT_PAY_HOST = 'https://api.mch.weixin.qq.com'

function mustGetConfig() {
  const config = {
    appid: process.env.WECHAT_APPID || process.env.WECHAT_PAY_APPID || '',
    mchid: process.env.WECHAT_MCH_ID || '',
    serialNo: process.env.WECHAT_PAY_SERIAL_NO || '',
    apiV3Key: process.env.WECHAT_PAY_API_V3_KEY || '',
    notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || '',
    privateKey: loadPrivateKey(),
    platformPublicKey: loadPlatformPublicKey(),
  }

  const missing = []
  for (const key of ['appid', 'mchid', 'serialNo', 'apiV3Key', 'notifyUrl', 'privateKey']) {
    if (!config[key]) missing.push(key)
  }
  if (missing.length) {
    const err = new Error(`微信支付配置缺失: ${missing.join(', ')}`)
    err.code = 'WECHAT_PAY_CONFIG_MISSING'
    throw err
  }

  return config
}

function loadPrivateKey() {
  if (process.env.WECHAT_PAY_PRIVATE_KEY) {
    return process.env.WECHAT_PAY_PRIVATE_KEY.replace(/\\n/g, '\n')
  }
  if (process.env.WECHAT_PAY_PRIVATE_KEY_PATH) {
    return fs.readFileSync(process.env.WECHAT_PAY_PRIVATE_KEY_PATH, 'utf8')
  }
  return ''
}

function loadPlatformPublicKey() {
  if (process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY) {
    return process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY.replace(/\\n/g, '\n')
  }
  if (process.env.WECHAT_PAY_PLATFORM_CERT_PATH) {
    const cert = fs.readFileSync(process.env.WECHAT_PAY_PLATFORM_CERT_PATH, 'utf8')
    return crypto.createPublicKey(cert).export({ type: 'spki', format: 'pem' })
  }
  return ''
}

function randomNonce(size = 16) {
  return crypto.randomBytes(size).toString('hex')
}

function signWithMerchantKey(message, privateKey) {
  return crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64')
}

function buildAuthorization(method, urlPath, body, config) {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = randomNonce()
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`
  const signature = signWithMerchantKey(message, config.privateKey)

  return 'WECHATPAY2-SHA256-RSA2048 ' + [
    `mchid="${config.mchid}"`,
    `nonce_str="${nonce}"`,
    `signature="${signature}"`,
    `timestamp="${timestamp}"`,
    `serial_no="${config.serialNo}"`,
  ].join(',')
}

async function requestWechatPay(method, path, payload) {
  const config = mustGetConfig()
  const body = payload ? JSON.stringify(payload) : ''
  const authorization = buildAuthorization(method, path, body, config)

  const res = await fetch(`${WECHAT_PAY_HOST}${path}`, {
    method,
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'petchat-wechat-pay/1.0',
    },
    body: body || undefined,
  })

  const text = await res.text()
  let data = {}
  if (text) {
    try { data = JSON.parse(text) } catch { data = { raw: text } }
  }

  if (!res.ok) {
    const err = new Error(data.message || data.raw || `微信支付请求失败: ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }

  return data
}

async function createJsapiOrder({ openid, outTradeNo, description, amountFen, attach }) {
  const config = mustGetConfig()
  const payload = {
    appid: config.appid,
    mchid: config.mchid,
    description: String(description || '商品订单').slice(0, 127),
    out_trade_no: outTradeNo,
    notify_url: config.notifyUrl,
    amount: {
      total: amountFen,
      currency: 'CNY',
    },
    payer: {
      openid,
    },
  }

  if (attach) payload.attach = String(attach).slice(0, 128)

  const result = await requestWechatPay('POST', '/v3/pay/transactions/jsapi', payload)
  const pkg = `prepay_id=${result.prepay_id}`
  const timeStamp = Math.floor(Date.now() / 1000).toString()
  const nonceStr = randomNonce()
  const payMessage = `${config.appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`

  return {
    appId: config.appid,
    timeStamp,
    nonceStr,
    package: pkg,
    signType: 'RSA',
    paySign: signWithMerchantKey(payMessage, config.privateKey),
    prepayId: result.prepay_id,
  }
}

function verifyWechatPaySignature(headers, rawBody) {
  const config = mustGetConfig()
  if (!config.platformPublicKey) {
    const err = new Error('微信支付平台证书未配置，无法验签回调')
    err.code = 'WECHAT_PAY_PLATFORM_CERT_MISSING'
    throw err
  }

  const timestamp = headers['wechatpay-timestamp']
  const nonce = headers['wechatpay-nonce']
  const signature = headers['wechatpay-signature']
  if (!timestamp || !nonce || !signature) return false

  const message = `${timestamp}\n${nonce}\n${rawBody}\n`
  return crypto
    .createVerify('RSA-SHA256')
    .update(message)
    .verify(config.platformPublicKey, signature, 'base64')
}

function decryptResource(resource) {
  const config = mustGetConfig()
  const ciphertext = Buffer.from(resource.ciphertext, 'base64')
  const authTag = ciphertext.subarray(ciphertext.length - 16)
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(config.apiV3Key, 'utf8'), resource.nonce)

  decipher.setAuthTag(authTag)
  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'))
  }

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return JSON.parse(decrypted.toString('utf8'))
}

module.exports = {
  createJsapiOrder,
  decryptResource,
  verifyWechatPaySignature,
}

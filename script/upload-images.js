const fs = require('fs')
const path = require('path')
const BACKEND_DIR = path.join(__dirname, '..', 'backend')
require(path.join(BACKEND_DIR, 'node_modules', 'dotenv')).config({ path: path.join(BACKEND_DIR, '.env') })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('请在 backend/.env 中设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const BUCKET = 'gengdongta-assets'
const IMAGES_DIR = path.join(__dirname, '..', 'wechat', 'images')
const REMOTE_PREFIX = 'images'

const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

const SKIP_PATTERNS = [
  '.DS_Store',
  '.docx',
  'README.md',
  'Thumbs.db',
  '.gitkeep',
]

function shouldSkip(filePath) {
  const basename = path.basename(filePath)
  return SKIP_PATTERNS.includes(basename)
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_MAP[ext] || 'application/octet-stream'
}

function walkDir(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDir(fullPath, fileList)
    } else if (entry.isFile() && !shouldSkip(fullPath)) {
      fileList.push(fullPath)
    }
  }
  return fileList
}

async function apiRequest(endpoint, options = {}) {
  const url = `${SUPABASE_URL}${endpoint}`
  const headers = {
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...options.headers,
  }
  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  return res
}

async function uploadFile(localPath, remotePath, mimeType) {
  const fileBuffer = fs.readFileSync(localPath)

  const res = await apiRequest(
    `/storage/v1/object/${BUCKET}/${remotePath}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
        'x-upsert': 'true',
        'Cache-Control': 'max-age=31536000',
      },
      body: fileBuffer,
    }
  )

  return true
}

async function listAllFiles(prefix) {
  const result = []
  const url = `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}?prefix=${encodeURIComponent(prefix)}&limit=500`
  const headers = { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }

  async function listRecursive(currentPrefix) {
    const u = `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}?prefix=${encodeURIComponent(currentPrefix)}&limit=500`
    const res = await fetch(u, { headers })
    if (!res.ok) return
    const items = await res.json()
    if (!Array.isArray(items)) return

    for (const item of items) {
      const fullPath = currentPrefix ? `${currentPrefix}/${item.name}` : item.name
      if (item.id) {
        result.push(fullPath)
      } else {
        await listRecursive(fullPath)
      }
    }
  }

  await listRecursive(prefix)
  return new Set(result)
}

async function main() {
  console.log('=== Gengdongta 图片批量上传 ===')
  console.log(`Bucket: ${BUCKET}`)
  console.log(`目录: ${IMAGES_DIR}\n`)

  const localFiles = walkDir(IMAGES_DIR)
  console.log(`找到 ${localFiles.length} 个文件\n`)

  console.log('正在检查远端已有文件...')
  const existingFiles = await listAllFiles(REMOTE_PREFIX)
  console.log(`远端已有 ${existingFiles.size} 个文件\n`)

  let uploaded = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < localFiles.length; i++) {
    const localPath = localFiles[i]
    const relativePath = path.relative(IMAGES_DIR, localPath)
    const remotePath = `${REMOTE_PREFIX}/${relativePath}`

    if (existingFiles.has(remotePath)) {
      skipped++
      continue
    }

    const mimeType = getMimeType(localPath)
    const fileSize = (fs.statSync(localPath).size / 1024).toFixed(1)

    process.stdout.write(`[${i + 1}/${localFiles.length}] ${remotePath} (${fileSize}KB)... `)

    try {
      await uploadFile(localPath, remotePath, mimeType)
      console.log('✓')
      uploaded++
    } catch (err) {
      console.log('✗')
      console.error(`    错误: ${err.message}`)
      failed++
    }
  }

  console.log(`\n=== 上传完成 ===`)
  console.log(`上传: ${uploaded} | 跳过(已存在): ${skipped} | 失败: ${failed}`)
  console.log(`\nCDN 基础 URL:`)
  console.log(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`)
}

main().catch((err) => {
  console.error('上传脚本异常:', err)
  process.exit(1)
})

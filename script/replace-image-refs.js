const fs = require('fs')
const path = require('path')

const WECHAT_DIR = path.join(__dirname, '..', 'wechat')

function getWxsPath(filePath) {
  const depth = path.relative(WECHAT_DIR, filePath).split(path.sep).length - 1
  const prefix = '../'.repeat(depth)
  return `${prefix}utils/image.wxs`
}

function addWxsImport(content, wxsPath) {
  if (content.includes(`src="${wxsPath}"`)) return content

  const moduleDecl = `<wxs module="image" src="${wxsPath}" />\n`

  const lines = content.split('\n')
  let insertIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.length > 0 && !line.startsWith('<!--') && !line.startsWith('<wxs')) {
      insertIdx = i
      break
    }
  }

  if (insertIdx === 0) {
    return moduleDecl + content
  }

  lines.splice(insertIdx, 0, moduleDecl)
  return lines.join('\n')
}

function replaceAllImagePaths(content) {
  // Case 1: src="/images/xxx" -> src="{{image.url('/images/xxx')}}"
  content = content.replace(
    /(\s)src="(\/images\/[^"]+)"/g,
    (match, space, imgPath) => {
      return `${space}src="{{image.url('${imgPath}')}}"`
    }
  )

  // Case 2: src="{{ ... '/images/xxx' ... }}" inside template expressions
  // Skip if already processed (contains 'image.url(')
  content = content.replace(
    /src="{{(?!.*?image\.url\()([^}]*?)'(\/images\/[^']+)'([^}]*?)}}"/g,
    (match, before, imgPath, after) => {
      return `src="{{${before}image.url('${imgPath}')${after}}}"`
    }
  )

  return content
}

function processWxmlFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8')
  const wxsPath = getWxsPath(filePath)

  if (!content.includes('/images/')) {
    return { modified: false }
  }

  content = addWxsImport(content, wxsPath)

  const newContent = replaceAllImagePaths(content)

  if (newContent === content) {
    return { modified: false }
  }

  fs.writeFileSync(filePath, newContent, 'utf-8')
  const rel = path.relative(WECHAT_DIR, filePath)
  console.log(`  ✓ ${rel}`)
  return { modified: true }
}

function processJsFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8')

  if (!content.includes("'/images/") && !content.includes('"/images/')) {
    return { modified: false }
  }

  const rel = path.relative(WECHAT_DIR, filePath)
  const isUtilDir = rel.startsWith('utils/')
  const requirePath = isUtilDir ? './image' : '../utils/image'

  if (!content.includes("require('" + requirePath)) {
    content = `const { getImageUrl } = require('${requirePath}')\n` + content
  }

  content = content.replace(
    /(['"])(\/images\/[^'"]+)\1/g,
    (match, quote, imgPath) => `getImageUrl('${imgPath}')`
  )

  fs.writeFileSync(filePath, content, 'utf-8')
  console.log(`  ✓ ${rel}`)
  return { modified: true }
}

function walkDir(dir, ext, ignoreDirs = []) {
  const results = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (ignoreDirs.includes(entry.name)) continue
      results.push(...walkDir(fullPath, ext, ignoreDirs))
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath)
    }
  }
  return results
}

console.log('=== 替换图片引用为 CDN URL ===\n')

const wxmlFiles = walkDir(WECHAT_DIR, '.wxml').sort()
let wxmlModified = 0
for (const f of wxmlFiles) {
  const r = processWxmlFile(f)
  if (r.modified) wxmlModified++
}

const jsFiles = walkDir(WECHAT_DIR, '.js', ['node_modules']).sort()
let jsModified = 0
for (const f of jsFiles) {
  const r = processJsFile(f)
  if (r.modified) jsModified++
}

console.log(`\n=== 完成 ===`)
console.log(`WXML: ${wxmlModified} 个 | JS: ${jsModified} 个`)

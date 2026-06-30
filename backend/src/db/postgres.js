/**
 * PostgreSQL / Supabase 数据库连接（接口兼容原 mysql.js）
 *
 * 用法完全兼容旧 mysql.js：
 *   const db = require('./db/postgres')
 *   const rows = await db.query('SELECT * FROM t_pet WHERE f_id = ?', [id])
 *   const result = await db.execute('INSERT INTO t_pet (...) VALUES (?)', [data])
 *   const alive = await db.ping()
 */

const { Pool } = require('pg')

let pool = null

function getPool() {
  if (pool) return pool

  // 优先使用 SUPABASE_DB_URL / DATABASE_URL 连接字符串
  const connectionString =
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'db.dlvgbwyvxjdggxpddpod.supabase.co'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'postgres'}`

  pool = new Pool({
    connectionString,
    ssl: connectionString.includes('supabase.co')
      ? { rejectUnauthorized: false }
      : false,
    max: 10,
    idleTimeoutMillis: 30000,
  })

  pool.on('error', (err) => {
    console.error('[Postgres] Unexpected pool error:', err.message)
  })

  console.log('[Postgres] Pool created')
  return pool
}

/**
 * 将 MySQL 风格的 ? 占位符转换为 PostgreSQL 的 $1, $2, ...
 * 同时跳过字符串和注释内的 ?
 */
function convertPlaceholders(sql) {
  let result = ''
  let i = 0
  let inSingle = false
  let inDouble = false
  let inDollar = false  // $$...$$ 字面量

  for (let pos = 0; pos < sql.length; pos++) {
    const ch = sql[pos]
    const next = sql[pos + 1] || ''

    if (inDollar) {
      result += ch
      if (ch === '$' && next === '$') {
        inDollar = false
        result += next
        pos++
      }
      continue
    }

    if (ch === '$' && next === '$' && !inSingle && !inDouble) {
      inDollar = true
      result += ch
      continue
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
      result += ch
      continue
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble
      result += ch
      continue
    }

    if (!inSingle && !inDouble && ch === '?') {
      i++
      result += `$${i}`
      continue
    }

    result += ch
  }

  return result
}

/**
 * 执行 SELECT 查询，返回行数组
 */
async function query(sql, params = []) {
  const pgSql = convertPlaceholders(sql)
  const client = await getPool().connect()
  try {
    const result = await client.query(pgSql, params)
    return result.rows
  } finally {
    client.release()
  }
}

/**
 * 执行 INSERT/UPDATE/DELETE，返回结果对象
 * 兼容 mysql2 的 execute 返回值：
 *   { affectedRows, insertId, ... }
 */
async function execute(sql, params = []) {
  const pgSql = convertPlaceholders(sql)
  const client = await getPool().connect()
  try {
    const result = await client.query(pgSql, params)

    // 兼容 mysql2 的 result 接口
    return {
      affectedRows: result.rowCount || 0,
      insertId: result.rows && result.rows.length > 0 && result.rows[0].f_id
        ? result.rows[0].f_id
        : null,
      changedRows: result.rowCount || 0,
      fieldCount: result.fields ? result.fields.length : 0,
    }
  } finally {
    client.release()
  }
}

/**
 * 健康检查
 */
async function ping() {
  try {
    const rows = await query('SELECT 1 AS ok')
    return rows && rows.length > 0
  } catch {
    return false
  }
}

module.exports = { query, execute, ping, getPool }

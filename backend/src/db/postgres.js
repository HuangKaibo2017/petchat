const path = require('path')
global.WebSocket = require('ws')

const BACKEND_DIR = path.join(__dirname, '..', '..')
require('dotenv').config({ path: path.join(BACKEND_DIR, '.env') })

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

let client = null

function getClient() {
  if (client) return client
  client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  })
  console.log('[Supabase REST] Client created')
  return client
}

function convertPlaceholders(sql, params) {
  if (!params || params.length === 0) return sql

  let idx = 0
  let result = ''
  let inStr = false
  let char = ''

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]

    if (inStr) {
      result += ch
      if (ch === char && sql[i - 1] !== '\\') inStr = false
      continue
    }

    if (ch === "'" || ch === '"') {
      inStr = true
      char = ch
      result += ch
      continue
    }

    if (ch === '?' && idx < params.length) {
      const val = params[idx++]
      if (val === null || val === undefined) {
        result += 'NULL'
      } else if (typeof val === 'number') {
        result += val
      } else if (typeof val === 'boolean') {
        result += val ? 'TRUE' : 'FALSE'
      } else {
        result += "'" + String(val).replace(/'/g, "''").replace(/\\/g, '\\\\') + "'"
      }
      continue
    }

    result += ch
  }

  return result
}

async function execRPC(sql) {
  const { data, error } = await getClient().rpc('exec_sql', { sql })
  if (error) throw new Error(error.message)
  return data
}

async function query(sql, params = []) {
  const fullSql = convertPlaceholders(sql, params)
  return await execRPC(fullSql)
}

async function execute(sql, params = []) {
  const fullSql = convertPlaceholders(sql, params)
  const { data, error } = await getClient().rpc('exec_sql', { sql: fullSql })
  if (error) throw new Error(error.message)

  const rows = data || []

  let affectedRows = 0
  let insertId = null

  if (/^\s*INSERT/i.test(sql)) {
    affectedRows = rows.length || (rows.length === 0 ? 1 : 0)
    if (rows.length > 0 && rows[0].f_id) {
      insertId = rows[0].f_id
    }
  } else if (/^\s*(UPDATE|DELETE)/i.test(sql)) {
    affectedRows = rows.length || 1
  }

  return {
    affectedRows,
    insertId,
    changedRows: affectedRows,
    rowCount: affectedRows,
    rows,
    fieldCount: rows.length > 0 ? Object.keys(rows[0]).length : 0,
  }
}

async function ping() {
  try {
    const data = await query('SELECT 1 AS ok')
    return data && data.length > 0
  } catch {
    return false
  }
}

function getPool() {
  return getClient()
}

module.exports = { query, execute, ping, getPool }

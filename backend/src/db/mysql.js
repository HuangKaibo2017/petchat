const mysql = require('mysql2/promise')

let pool = null

function getPool() {
  if (pool) return pool

  const config = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gengdongta_dev',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
  }

  // Use Unix socket if available (bypasses TCP sandbox restrictions)
  const socketPath = process.env.DB_SOCKET || '/tmp/mysql_petchat.sock'
  const fs = require('fs')
  if (fs.existsSync(socketPath)) {
    config.socketPath = socketPath
  } else {
    config.host = process.env.DB_HOST || 'localhost'
    config.port = parseInt(process.env.DB_PORT || '3306', 10)
  }

  pool = mysql.createPool(config)
  return pool
}

async function query(sql, params = []) {
  const conn = await getPool().getConnection()
  try {
    const [rows] = await conn.query(sql, params)
    return rows
  } finally {
    conn.release()
  }
}

async function execute(sql, params = []) {
  const conn = await getPool().getConnection()
  try {
    const [result] = await conn.execute(sql, params)
    return result
  } finally {
    conn.release()
  }
}

async function ping() {
  try {
    await query('SELECT 1')
    return true
  } catch {
    return false
  }
}

module.exports = { query, execute, ping, getPool }

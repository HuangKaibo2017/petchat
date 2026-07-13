const crypto = require('crypto')

function now() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function timestamp() {
  const d = new Date()
  return parseInt(
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0') +
    String(d.getSeconds()).padStart(2, '0')
  )
}

function uuid() {
  return crypto.randomUUID()
}

function yuanToFen(amount) {
  return Math.round(Number(amount || 0) * 100)
}

module.exports = { now, timestamp, uuid, yuanToFen }

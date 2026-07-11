function setupCors(app) {
  const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const IS_DEV = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV

  app.use((req, res, next) => {
    const origin = req.headers.origin || ''
    if (ALLOWED_ORIGINS.length > 0) {
      const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o))
      if (origin && isAllowed) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
    } else if (IS_DEV) {
      res.header('Access-Control-Allow-Origin', '*')
    }
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    if (req.method === 'OPTIONS') return res.sendStatus(200)
    next()
  })
}

module.exports = { setupCors }

const { Router } = require('express')

module.exports = function createUploadRoutes({ auth }) {
  const router = Router()

  router.post('/', auth, async (req, res) => {
    try {
      const { fileUrl } = req.body
      const publicUrl = fileUrl || ''
      res.json({ code: 200, data: { publicUrl } })
    } catch (err) {
      console.error('[POST /api/upload]', err.message)
      res.status(500).json({ code: 500, message: '上传失败' })
    }
  })

  return router
}

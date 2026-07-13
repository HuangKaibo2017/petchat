const { Router } = require('express')

module.exports = function createFavoriteRoutes({ auth }) {
  const router = Router()

  router.get('/', auth, async (req, res) => {
    res.json({ code: 200, data: [] })
  })

  router.post('/', auth, async (req, res) => {
    res.json({ code: 200, data: { favorited: true } })
  })

  return router
}

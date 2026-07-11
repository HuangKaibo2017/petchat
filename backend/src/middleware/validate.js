function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
      return res.status(400).json({
        code: 400,
        message: '请求参数校验失败',
        errors,
      })
    }
    req.body = result.data
    next()
  }
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query)
    if (!result.success) {
      const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))
      return res.status(400).json({
        code: 400,
        message: '查询参数校验失败',
        errors,
      })
    }
    req.query = result.data
    next()
  }
}

module.exports = { validate, validateQuery }

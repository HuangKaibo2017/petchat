/**
 * Tool Registry — 工具注册表
 * Agent 可通过 function calling 调用这些工具
 */

const tools = {}

/**
 * 注册工具
 */
function register(name, { description, parameters, handler }) {
  tools[name] = { description, parameters, handler }
}

/**
 * 获取工具的 OpenAI function calling 格式描述
 */
function getFunctionDefs(names = []) {
  const defs = []
  const targetTools = names.length > 0
    ? names.filter(n => tools[n]).map(n => tools[n])
    : Object.values(tools)

  for (const [name, tool] of Object.entries(tools)) {
    if (names.length > 0 && !names.includes(name)) continue
    defs.push({
      type: 'function',
      function: {
        name,
        description: tool.description,
        parameters: tool.parameters,
      },
    })
  }
  return defs
}

/**
 * 执行工具
 */
async function execute(name, args) {
  const tool = tools[name]
  if (!tool) throw new Error(`工具 ${name} 不存在`)
  return await tool.handler(args)
}

module.exports = { register, getFunctionDefs, execute }

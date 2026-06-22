/**
 * Agent Registry — 根据名称获取 Agent 实例
 */
const agents = {
  chat:          require('./chat'),
  mood:          require('./mood'),
  health:        require('./health'),
  constitution:  require('./constitution'),
  personality:   require('./personality'),
  consultation:  require('./consultation'),
  newpet:        require('./newpet'),
  risk:          require('./risk'),
}

function get(name) {
  return agents[name] || agents.chat
}

function list() {
  return Object.keys(agents)
}

module.exports = { get, list }

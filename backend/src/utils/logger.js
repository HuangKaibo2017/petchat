const fs = require('fs');
const path = require('path');

function pad(n) {
  return String(n).padStart(2, '0');
}

function getTimestamp(withTime) {
  const d = new Date();
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  if (!withTime) return { date };
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return { date, time };
}

const defaultLogDir = path.resolve(__dirname, '..', '..', 'log');

function createLogger(name, opts = {}) {
  const logDir = opts.dir || defaultLogDir;

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const isTest = name.startsWith('test_') || opts.withTimestamp;
  const { date, time } = getTimestamp(isTest);
  const filename = isTest ? `${name}_${date}-${time}.log` : `${name}_${date}.log`;
  const filepath = path.join(logDir, filename);

  const write = (level, ...args) => {
    const ts = new Date().toISOString();
    const text = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    const line = `[${ts}] [${level}] ${text}\n`;
    fs.appendFile(filepath, line, (err) => {
      if (err) process.stderr.write(`[Logger] write error: ${err.message}\n`);
    });
    process.stdout.write(line);
  };

  return {
    info: (...args) => write('INFO', ...args),
    warn: (...args) => write('WARN', ...args),
    error: (...args) => write('ERROR', ...args),
    debug: (...args) => write('DEBUG', ...args),
    log: (...args) => write('LOG', ...args),
  };
}

module.exports = { createLogger };

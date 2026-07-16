import fs from 'fs';
import { join } from 'path';
import { config } from './config.js';

const LOG_DIR = join(process.cwd(), 'logs');
let fileStream = null;

if (config.nodeEnv === 'production') {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fileStream = fs.createWriteStream(join(LOG_DIR, 'app.log'), { flags: 'a' });
  } catch (e) {
    // fall back to console
  }
}

function ts() {
  return new Date().toISOString();
}

function write(level, args) {
  const msg = `[${ts()}] [${level}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')}`;
  if (fileStream) fileStream.write(msg + '\n');
  if (level === 'ERROR') console.error(msg);
  else console.log(msg);
}

export const logger = {
  info: (...a) => write('INFO', a),
  warn: (...a) => write('WARN', a),
  error: (...a) => write('ERROR', a),
  debug: (...a) => { if (config.nodeEnv !== 'production') write('DEBUG', a); },
};

export default logger;

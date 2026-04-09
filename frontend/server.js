const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 19006;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ENV_FILE = path.join(__dirname, '.env');

function parseEnv() {
  const values = {};
  if (!fs.existsSync(ENV_FILE)) {
    return values;
  }
  const content = fs.readFileSync(ENV_FILE, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }
    const [key, ...rest] = trimmed.split('=');
    values[key] = rest.join('=').trim();
  }
  return values;
}

const env = parseEnv();
const API_BASE_URL = env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3011';

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  return 'text/plain; charset=utf-8';
}

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

const requestHandler = (req, res) => {
  if (req.url === '/config.js') {
    return send(res, 200, `window.__APP_CONFIG__ = ${JSON.stringify({ API_BASE_URL })};`, 'application/javascript; charset=utf-8');
  }

  const safePath = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return send(res, 403, 'Forbidden');
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    return send(res, 200, fs.readFileSync(indexPath, 'utf8'), 'text/html; charset=utf-8');
  }
  const body = fs.readFileSync(filePath);
  return send(res, 200, body, contentType(filePath));
};

// Only listen if not in Vercel environment
if (process.env.VERCEL !== '1') {
  const http = require('http');
  const server = http.createServer(requestHandler);
  server.listen(PORT, () => {
    console.log(`Frontend running on http://localhost:${PORT}`);
  });
}

module.exports = requestHandler;

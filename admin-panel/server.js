const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3012;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ENV_FILE = path.join(__dirname, '.env');

function env() {
  if (!fs.existsSync(ENV_FILE)) {
    return {};
  }
  return fs.readFileSync(ENV_FILE, 'utf8').split('\n').reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      return acc;
    }
    const [k, ...rest] = trimmed.split('=');
    acc[k] = rest.join('=').trim();
    return acc;
  }, {});
}

const vars = env();
const API_BASE_URL = vars.API_BASE_URL || 'http://localhost:3011';
const ALERTS_REFRESH_MS = Math.max(5000, Number(vars.ALERTS_REFRESH_MS || 30000));

function type(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

const server = http.createServer((req, res) => {
  if (req.url === '/config.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end(`window.__ADMIN_CONFIG__ = ${JSON.stringify({ API_BASE_URL, ALERTS_REFRESH_MS })};`);
    return;
  }
  const clean = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.join(PUBLIC_DIR, clean);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  const finalPath = fs.existsSync(filePath) ? filePath : path.join(PUBLIC_DIR, 'index.html');
  res.writeHead(200, { 'Content-Type': type(finalPath) });
  res.end(fs.readFileSync(finalPath));
});

server.listen(PORT, () => {
  console.log(`Admin panel running on http://localhost:${PORT}`);
});

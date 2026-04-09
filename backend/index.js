require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { initDb } = require('./src/db');
const metrics = require('./src/services/metrics');
const { rateLimit } = require('./src/middleware/rateLimit');

const app = express();
const port = Number(process.env.PORT || 3011);

app.disable('x-powered-by');

// Middleware to check JWT_SECRET on first request (better for Vercel)
let jwtSecretChecked = false;
app.use((req, res, next) => {
  if (!jwtSecretChecked) {
    jwtSecretChecked = true;
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set. Requests to protected routes will fail.');
      if (process.env.VERCEL === '1') {
        console.error('Add JWT_SECRET to Vercel Environment Variables and redeploy.');
      }
    }
  }
  next();
});

// Harden common HTTP headers. In development we relax CSP to avoid blocking tooling;
// in production we enable a stricter policy.
const helmetOptions = {};
if (process.env.NODE_ENV === 'production') {
  helmetOptions.contentSecurityPolicy = {
    useDefaults: true,
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      // Backend mostly serves JSON; these are safe defaults if HTML is ever returned.
      'default-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'none'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'script-src': ["'self'"],
      'connect-src': ["'self'"],
    },
  };
  helmetOptions.hsts = {
    maxAge: 15552000, // 180 days
    includeSubDomains: true,
    preload: true,
  };
}

app.use(helmet(helmetOptions));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:19006,http://localhost:3012')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const dur = Date.now() - start;
    // Avoid logging bodies or sensitive data; method/path/status are usually safe.
    console.log(`${req.method} ${req.path} ${res.statusCode} ${dur}ms`);
  });
  next();
});

initDb();

app.get(['/', '/healthz'], (req, res) => {
  res.json({ status: 'ok', service: 'plxyground-backend', port });
});

app.get('/metrics', (req, res) => {
  res.json({ counters: metrics.snapshot() });
});

app.use('/api', rateLimit({ windowMs: 30000, max: 600, keyPrefix: 'api-all' }));

const apiRouter = require('./src/routes');
app.use('/api', apiRouter);

app.use((err, req, res, next) => {
  void next;
  console.error(err);
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const isServerError = status >= 500;
  const message = isServerError ? 'Internal server error' : (err.message || 'Request failed');
  res.status(status).json({ error: message });
});

// Only listen if not in Vercel environment
if (process.env.VERCEL !== '1') {
  app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
}

module.exports = app;

// Harden common HTTP headers. In development we relax CSP to avoid blocking tooling;
// in production we enable a stricter policy.
const helmetOptions = {};
if (process.env.NODE_ENV === 'production') {
  helmetOptions.contentSecurityPolicy = {
    useDefaults: true,
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      // Backend mostly serves JSON; these are safe defaults if HTML is ever returned.
      'default-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'none'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'script-src': ["'self'"],
      'connect-src': ["'self'"],
    },
  };
  helmetOptions.hsts = {
    maxAge: 15552000, // 180 days
    includeSubDomains: true,
    preload: true,
  };
}

app.use(helmet(helmetOptions));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:19006,http://localhost:3012')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const dur = Date.now() - start;
    // Avoid logging bodies or sensitive data; method/path/status are usually safe.
    console.log(`${req.method} ${req.path} ${res.statusCode} ${dur}ms`);
  });
  next();
});

initDb();

app.get(['/', '/healthz'], (req, res) => {
  res.json({ status: 'ok', service: 'plxyground-backend', port });
});

app.get('/metrics', (req, res) => {
  res.json({ counters: metrics.snapshot() });
});

app.use('/api', rateLimit({ windowMs: 30000, max: 600, keyPrefix: 'api-all' }));

const apiRouter = require('./src/routes');
app.use('/api', apiRouter);

app.use((err, req, res, next) => {
  void next;
  console.error(err);
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const isServerError = status >= 500;
  const message = isServerError ? 'Internal server error' : (err.message || 'Request failed');
  res.status(status).json({ error: message });
});

// Only listen if not in Vercel environment
if (process.env.VERCEL !== '1') {
  app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
}

module.exports = app;

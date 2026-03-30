const jwt = require('jsonwebtoken');

function generateToken(payload) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    // Default to short‑lived access tokens; override via env if needed.
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
}

function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid authorization format' });
  }
  jwt.verify(parts[1], process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = decoded;
    next();
  });
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

module.exports = { generateToken, verifyToken, requireRole };

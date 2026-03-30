const crypto = require('crypto');

const codes = new Map();
const TTL_MS = 10 * 60 * 1000;

function keyFor(type, email) {
  return `${type}:${String(email || '').trim().toLowerCase()}`;
}

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function createCode(type, email) {
  const code = String(crypto.randomInt(100000, 1000000));
  const key = keyFor(type, email);
  codes.set(key, {
    codeHash: hashCode(code),
    expiresAt: Date.now() + TTL_MS,
    attempts: 0,
  });
  return { code, expiresInMs: TTL_MS };
}

function verifyCode(type, email, code) {
  const key = keyFor(type, email);
  const row = codes.get(key);
  if (!row) return { ok: false, reason: 'missing' };
  if (Date.now() > row.expiresAt) {
    codes.delete(key);
    return { ok: false, reason: 'expired' };
  }
  row.attempts += 1;
  if (row.attempts > 5) {
    codes.delete(key);
    return { ok: false, reason: 'too_many_attempts' };
  }
  if (row.codeHash !== hashCode(code)) {
    return { ok: false, reason: 'invalid' };
  }
  codes.delete(key);
  return { ok: true };
}

module.exports = {
  createCode,
  verifyCode,
};

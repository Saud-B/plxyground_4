const crypto = require('crypto');
const { supabaseAdmin } = require('../lib/supabaseClient');

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function ttlSeconds() {
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS || '7');
  const safeDays = Number.isFinite(days) && days > 0 && days <= 365 ? days : 7;
  return safeDays * 24 * 60 * 60;
}

async function createRefreshToken({ subjectId, subjectType }) {
  const raw = crypto.randomBytes(48).toString('base64url');
  const tokenHash = hashToken(raw);
  const now = Date.now();
  const expiresAt = new Date(now + ttlSeconds() * 1000).toISOString();
  
  const { error } = await supabaseAdmin
    .from('refresh_tokens')
    .insert([
      {
        subject_id: subjectId,
        subject_type: subjectType,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    ]);
  
  if (error) throw error;
  
  return { token: raw, expiresAt };
}

async function verifyRefreshToken(raw) {
  const tokenHash = hashToken(raw);
  const { data: row, error } = await supabaseAdmin
    .from('refresh_tokens')
    .select('id, subject_id, subject_type, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .single();
  
  if (error) {
    throw new Error('invalid or expired refresh token');
  }
  
  if (!row) {
    throw new Error('invalid or expired refresh token');
  }
  
  if (row.revoked_at) {
    throw new Error('refresh token revoked');
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new Error('refresh token expired');
  }
  return {
    id: row.id,
    subjectId: row.subject_id,
    subjectType: row.subject_type,
  };
}

async function rotateRefreshToken(oldRaw, { subjectId, subjectType }) {
  const oldHash = hashToken(oldRaw);
  const { data: existing, error: queryError } = await supabaseAdmin
    .from('refresh_tokens')
    .select('id')
    .eq('token_hash', oldHash)
    .is('revoked_at', null)
    .single();
  
  if (queryError || !existing) {
    throw new Error('refresh token not found');
  }
  
  const { error: revokeError } = await supabaseAdmin
    .from('refresh_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', existing.id);
  
  if (revokeError) throw revokeError;
  
  return createRefreshToken({ subjectId, subjectType });
}

async function revokeRefreshToken(raw) {
  const tokenHash = hashToken(raw);
  const { error } = await supabaseAdmin
    .from('refresh_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .is('revoked_at', null);
  
  if (error) throw error;
}

async function revokeAllForSubject(subjectId, subjectType) {
  const { error } = await supabaseAdmin
    .from('refresh_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('subject_id', subjectId)
    .eq('subject_type', subjectType)
    .is('revoked_at', null);
  
  if (error) throw error;
}

module.exports = {
  createRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForSubject,
};


const express = require('express');
const bcrypt = require('bcrypt');
const { supabaseAdmin } = require('../../lib/supabaseClient');
const { generateToken, verifyToken, requireRole } = require('../../middleware/auth');
const { validateEmailPassword } = require('../../middleware/validation');
const { rateLimit } = require('../../middleware/rateLimit');
const { writeAudit } = require('../../services/audit');
const metrics = require('../../services/metrics');
const {
  createRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForSubject,
} = require('../../services/refreshTokens');

const router = express.Router();

const ADMIN_REFRESH_COOKIE_NAME = 'plxy_admin_refresh';

function setAdminRefreshCookie(res, token, expiresAt) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(ADMIN_REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/admin',
    expires: new Date(expiresAt),
  });
}

function clearAdminRefreshCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(ADMIN_REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/admin',
    maxAge: 0,
  });
}

function readAdminRefreshCookie(req) {
  const header = req.headers.cookie || '';
  const parts = header.split(';');
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=');
    if (name === ADMIN_REFRESH_COOKIE_NAME) {
      return decodeURIComponent(rest.join('=') || '');
    }
  }
  return '';
}

router.post('/login', rateLimit({ windowMs: 60000, max: 20, keyPrefix: 'admin-login' }), validateEmailPassword, async (req, res, next) => {
  try {
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('email', req.body.email)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!admin) {
      metrics.inc('auth_failure');
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
    if (!admin.is_active) {
      metrics.inc('auth_failure');
      return res.status(403).json({ error: 'ACCOUNT_SUSPENDED', message: 'This admin account is disabled.' });
    }
    const isValid = await bcrypt.compare(req.body.password, admin.password_hash);
    if (!isValid) {
      metrics.inc('auth_failure');
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
    metrics.inc('auth_success');
    const token = generateToken({ id: admin.id, role: 'ADMIN', type: 'admin' });
    const refresh = await createRefreshToken({ subjectId: admin.id, subjectType: 'ADMIN' });
    setAdminRefreshCookie(res, refresh.token, refresh.expiresAt);
    return res.json({
      token,
      user: { id: admin.id, email: admin.email, role: 'ADMIN' },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/change-password', verifyToken, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const nextPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
    if (nextPassword.length < 8 || nextPassword.length > 128) {
      return res.status(400).json({ error: 'newPassword must be 8-128 chars' });
    }
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('id', req.user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!admin) {
      return res.status(404).json({ error: 'admin not found' });
    }
    const isValid = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'current password incorrect' });
    }
    const hash = await bcrypt.hash(nextPassword, 10);
    const { error: updateError } = await supabaseAdmin
      .from('admins')
      .update({ password_hash: hash })
      .eq('id', req.user.id);
    
    if (updateError) {
      throw updateError;
    }

    await revokeAllForSubject(req.user.id, 'ADMIN');
    await writeAudit({
      actionType: 'ADMIN_PASSWORD_CHANGE',
      actor: admin.email || `admin:${req.user.id}`,
      target: `admin:${req.user.id}`,
    });
    return res.json({ success: true });

  } catch (error) {
    return next(error);
  }
});

router.post('/refresh', rateLimit({ windowMs: 60000, max: 60, keyPrefix: 'admin-refresh' }), async (req, res, next) => {
  try {
    const raw = readAdminRefreshCookie(req);
    if (!raw) {
      return res.status(401).json({ error: 'Missing refresh token' });
    }
    const tokenRecord = await verifyRefreshToken(raw);
    if (tokenRecord.subjectType !== 'ADMIN') {
      clearAdminRefreshCookie(res);
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('id', tokenRecord.subjectId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!admin) {
      clearAdminRefreshCookie(res);
      return res.status(404).json({ error: 'admin not found' });
    }
    
    const accessToken = generateToken({ id: admin.id, role: 'ADMIN', type: 'admin' });
    const refreshed = await rotateRefreshToken(raw, { subjectId: tokenRecord.subjectId, subjectType: 'ADMIN' });
    setAdminRefreshCookie(res, refreshed.token, refreshed.expiresAt);
    return res.json({
      token: accessToken,
      user: { id: admin.id, email: admin.email, role: 'ADMIN' },
    });
  } catch (error) {
    clearAdminRefreshCookie(res);
    return next(Object.assign(new Error('Invalid or expired refresh token'), { status: 401 }));
  }
});

router.post('/logout', rateLimit({ windowMs: 60000, max: 60, keyPrefix: 'admin-logout' }), async (req, res) => {
  const raw = readAdminRefreshCookie(req);
  if (raw) {
    await revokeRefreshToken(raw).catch(() => {});
  }
  clearAdminRefreshCookie(res);
  return res.json({ success: true });
});

module.exports = router;

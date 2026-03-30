const express = require('express');
const bcrypt = require('bcrypt');
const { supabaseAdmin } = require('../lib/supabaseClient');
const { generateToken, verifyToken } = require('../middleware/auth');
const { validateEmailPassword } = require('../middleware/validation');
const { rateLimit } = require('../middleware/rateLimit');
const { writeAudit } = require('../services/audit');
const { createCode, verifyCode } = require('../services/passwordResetCodes');
const { sendEmail } = require('../services/email');
const metrics = require('../services/metrics');
const {
  createRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForSubject,
} = require('../services/refreshTokens');

const router = express.Router();

const REFRESH_COOKIE_NAME = 'plxy_refresh_token';

function setRefreshCookie(res, token, expiresAt) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api',
    expires: new Date(expiresAt),
  });
}

function clearRefreshCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api',
    maxAge: 0,
  });
}

function readRefreshCookie(req) {
  const header = req.headers.cookie || '';
  const parts = header.split(';');
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=');
    if (name === REFRESH_COOKIE_NAME) {
      return decodeURIComponent(rest.join('=') || '');
    }
  }
  return '';
}

router.post('/signup', rateLimit({ windowMs: 60000, max: 20, keyPrefix: 'creator-signup' }), validateEmailPassword, async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    const slug = (req.body.slug || '').trim() || null;
    if (!name || name.length > 120) {
      return res.status(400).json({ error: 'name is required and must be <= 120 chars' });
    }

    const passwordHash = await bcrypt.hash(req.body.password, 10);
    
    // Insert creator
    const { data: creatorData, error: creatorError } = await supabaseAdmin
      .from('creators')
      .insert([
        {
          name,
          role: 'CREATOR',
          profile_slug: slug,
        },
      ])
      .select('id');
    
    if (creatorError) throw creatorError;
    if (!creatorData || !creatorData[0]) {
      throw new Error('Failed to create creator');
    }
    
    const creatorId = creatorData[0].id;
    
    // Insert creator account
    const { error: accountError } = await supabaseAdmin
      .from('creator_accounts')
      .insert([
        {
          creator_id: creatorId,
          email: req.body.email,
          password_hash: passwordHash,
          is_approved: 1,
          is_email_verified: 1,
        },
      ]);
    
    if (accountError) throw accountError;

    await writeAudit({
      actionType: 'CREATOR_SIGNUP',
      actor: req.body.email,
      target: `creator:${creatorId}`,
    });
    
    return res.status(201).json({ success: true });
  } catch (error) {
    if (error.message && error.message.includes('unique')) {
      metrics.inc('auth_failure');
      return res.status(409).json({ error: 'email or slug already in use' });
    }
    return next(error);
  }
});

router.post('/login', rateLimit({ windowMs: 60000, max: 30, keyPrefix: 'creator-login' }), validateEmailPassword, async (req, res, next) => {
  try {
    // Query with join
    const { data: accounts, error: queryError } = await supabaseAdmin
      .from('creator_accounts')
      .select(`
        id,
        creator_id,
        email,
        password_hash,
        is_suspended,
        creators!inner(id, name, role)
      `)
      .eq('email', req.body.email)
      .eq('creators.role', 'CREATOR')
      .single();
    
    if (queryError && queryError.code !== 'PGRST116') {
      throw queryError;
    }

    if (!accounts) {
      metrics.inc('auth_failure');
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
    
    const account = {
      account_id: accounts.id,
      creator_id: accounts.creator_id,
      email: accounts.email,
      password_hash: accounts.password_hash,
      is_suspended: accounts.is_suspended,
      name: accounts.creators.name,
      role: accounts.creators.role,
    };

    if (account.is_suspended) {
      metrics.inc('auth_failure');
      return res.status(403).json({
        error: 'ACCOUNT_SUSPENDED',
        message: 'Your account is suspended. Contact support to restore access.',
      });
    }

    const isValid = await bcrypt.compare(req.body.password, account.password_hash);
    if (!isValid) {
      metrics.inc('auth_failure');
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    metrics.inc('auth_success');
    const token = generateToken({ id: account.creator_id, role: 'CREATOR', type: 'creator' });
    const refresh = await createRefreshToken({ subjectId: account.creator_id, subjectType: 'CREATOR' });
    setRefreshCookie(res, refresh.token, refresh.expiresAt);
    return res.json({
      token,
      user: {
        id: account.creator_id,
        name: account.name,
        role: account.role,
        email: account.email,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/forgot-password/request-code', rateLimit({ windowMs: 60000, max: 10, keyPrefix: 'creator-forgot-password-request' }), async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ error: 'valid email required' });
    }
    
    const { data: account, error: queryError } = await supabaseAdmin
      .from('creator_accounts')
      .select(`
        id,
        email,
        creators!inner(role)
      `)
      .eq('email', email)
      .eq('creators.role', 'CREATOR')
      .single();
    
    if (queryError && queryError.code !== 'PGRST116') {
      throw queryError;
    }

    if (!account) {
      // Return success even if account not found (security best practice)
      return res.json({ success: true });
    }
    
    const created = createCode('creator', email);
    await sendEmail({
      to: email,
      subject: 'PLXYGROUND password reset code',
      text: `Your verification code is ${created.code}. It expires in 10 minutes.`,
      html: `<p>Your verification code is <strong>${created.code}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });
    await writeAudit({
      actionType: 'CREATOR_FORGOT_PASSWORD_CODE_SENT',
      actor: email,
      target: `creator_account:${account.id}`,
    });
    return res.json({ success: true, expires_in_seconds: 600 });
  } catch (error) {
    return next(error);
  }
});

router.post('/forgot-password/verify-code', rateLimit({ windowMs: 60000, max: 12, keyPrefix: 'creator-forgot-password-verify' }), async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
    const nextPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
    if (!email || !/^\d{6}$/.test(code) || nextPassword.length < 8 || nextPassword.length > 128) {
      return res.status(400).json({ error: 'email, 6-digit code, and newPassword(8-128 chars) required' });
    }
    
    const { data: account, error: queryError } = await supabaseAdmin
      .from('creator_accounts')
      .select(`
        id,
        email,
        creators!inner(role)
      `)
      .eq('email', email)
      .eq('creators.role', 'CREATOR')
      .single();
    
    if (queryError && queryError.code !== 'PGRST116') {
      throw queryError;
    }

    if (!account) {
      return res.status(400).json({ error: 'invalid or expired verification code' });
    }
    
    const verified = verifyCode('creator', email, code);
    if (!verified.ok) {
      return res.status(400).json({ error: 'invalid or expired verification code' });
    }
    
    const passwordHash = await bcrypt.hash(nextPassword, 10);
    const { error: updateError } = await supabaseAdmin
      .from('creator_accounts')
      .update({ password_hash: passwordHash })
      .eq('id', account.id);
    
    if (updateError) throw updateError;

    await writeAudit({
      actionType: 'CREATOR_FORGOT_PASSWORD_RESET',
      actor: email,
      target: `creator_account:${account.id}`,
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/change-password', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'CREATOR') {
      return res.status(403).json({ error: 'forbidden' });
    }
    const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const nextPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
    if (!currentPassword || nextPassword.length < 8 || nextPassword.length > 128) {
      return res.status(400).json({ error: 'currentPassword and newPassword(8-128 chars) required' });
    }
    
    const { data: account, error: queryError } = await supabaseAdmin
      .from('creator_accounts')
      .select(`
        id,
        password_hash,
        email,
        creators!inner(role)
      `)
      .eq('creator_id', req.user.id)
      .eq('creators.role', 'CREATOR')
      .single();
    
    if (queryError && queryError.code !== 'PGRST116') {
      throw queryError;
    }

    if (!account) {
      return res.status(404).json({ error: 'account not found' });
    }
    
    const isValid = await bcrypt.compare(currentPassword, account.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'current password incorrect' });
    }
    
    const passwordHash = await bcrypt.hash(nextPassword, 10);
    const { error: updateError } = await supabaseAdmin
      .from('creator_accounts')
      .update({ password_hash: passwordHash })
      .eq('id', account.id);
    
    if (updateError) throw updateError;

    await revokeAllForSubject(req.user.id, 'CREATOR');
    await writeAudit({
      actionType: 'CREATOR_PASSWORD_CHANGE',
      actor: account.email || `creator:${req.user.id}`,
      target: `creator:${req.user.id}`,
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/change-email', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'CREATOR') {
      return res.status(403).json({ error: 'forbidden' });
    }
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const newEmail = normalizeEmail(req.body.newEmail);
    if (!password || !newEmail) {
      return res.status(400).json({ error: 'password and valid newEmail required' });
    }

    const { data: account, error: queryError } = await supabaseAdmin
      .from('creator_accounts')
      .select(`
        id,
        password_hash,
        email,
        creators!inner(role)
      `)
      .eq('creator_id', req.user.id)
      .eq('creators.role', 'CREATOR')
      .single();
    
    if (queryError && queryError.code !== 'PGRST116') {
      throw queryError;
    }

    if (!account) {
      return res.status(404).json({ error: 'account not found' });
    }
    
    const isValid = await bcrypt.compare(password, account.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'password incorrect' });
    }
    if (account.email === newEmail) {
      return res.status(400).json({ error: 'new email must be different' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('creator_accounts')
      .update({ email: newEmail })
      .eq('id', account.id);
    
    if (updateError) {
      if (updateError.message && updateError.message.includes('unique')) {
        return res.status(409).json({ error: 'email already in use' });
      }
      throw updateError;
    }

    await writeAudit({
      actionType: 'CREATOR_EMAIL_CHANGE',
      actor: account.email || `creator:${req.user.id}`,
      target: `creator:${req.user.id}`,
      metadata: { previousEmail: account.email, nextEmail: newEmail },
    });
    return res.json({ success: true, email: newEmail });
  } catch (error) {
    return next(error);
  }
});

router.post('/refresh', rateLimit({ windowMs: 60000, max: 60, keyPrefix: 'creator-refresh' }), async (req, res, next) => {
  try {
    const raw = readRefreshCookie(req);
    if (!raw) {
      return res.status(401).json({ error: 'Missing refresh token' });
    }
    const tokenRecord = await verifyRefreshToken(raw);
    if (tokenRecord.subjectType !== 'CREATOR') {
      clearRefreshCookie(res);
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { data: account, error: queryError } = await supabaseAdmin
      .from('creator_accounts')
      .select(`
        id,
        creator_id,
        email,
        creators!inner(id, name, role)
      `)
      .eq('creator_id', tokenRecord.subjectId)
      .eq('creators.role', 'CREATOR')
      .single();
    
    if (queryError && queryError.code !== 'PGRST116') {
      throw queryError;
    }

    if (!account) {
      clearRefreshCookie(res);
      return res.status(404).json({ error: 'account not found' });
    }
    
    const accessToken = generateToken({ id: account.creator_id, role: 'CREATOR', type: 'creator' });
    const refreshed = await rotateRefreshToken(raw, { subjectId: tokenRecord.subjectId, subjectType: 'CREATOR' });
    setRefreshCookie(res, refreshed.token, refreshed.expiresAt);
    return res.json({
      token: accessToken,
      user: {
        id: account.creator_id,
        name: account.creators.name,
        role: account.creators.role,
        email: account.email,
      },
    });
  } catch (error) {
    clearRefreshCookie(res);
    return next(Object.assign(new Error('Invalid or expired refresh token'), { status: 401 }));
  }
});

router.post('/logout', rateLimit({ windowMs: 60000, max: 60, keyPrefix: 'creator-logout' }), async (req, res) => {
  const raw = readRefreshCookie(req);
  if (raw) {
    await revokeRefreshToken(raw).catch(() => {});
  }
  clearRefreshCookie(res);
  return res.json({ success: true });
});

function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!email || email.length > 255 || !/^\S+@\S+\.\S+$/.test(email)) {
    return '';
  }
  return email;
}

module.exports = router;

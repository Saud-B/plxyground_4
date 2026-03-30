const express = require('express');
const bcrypt = require('bcrypt');
const { supabaseAdmin } = require('../../lib/supabaseClient');
const { verifyToken, requireRole } = require('../../middleware/auth');
const { writeAudit } = require('../../services/audit');

const router = express.Router();
router.use(verifyToken, requireRole('ADMIN'));

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    let query = supabaseAdmin
      .from('creator_accounts')
      .select('id, creator_id, email, is_approved, is_suspended, is_email_verified, created_at, updated_at, creators(name, role, profile_slug)')
      .order('created_at', { ascending: false });
    
    if (q) {
      query = query.or(`creators.name.ilike.%${q}%,email.ilike.%${q}%`);
    }
    const { data: rows, error } = await query;
    if (error && error.code !== 'PGRST116') throw error;
    
    const { data: admins, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('id', { count: 'exact' })
      .eq('role', 'ADMIN')
      .eq('is_active', true);
    if (adminError && adminError.code !== 'PGRST116') throw adminError;
    
    const users = (rows || []).map(u => ({
      user_id: u.id,
      creator_id: u.creator_id,
      email: u.email,
      is_approved: u.is_approved,
      is_suspended: u.is_suspended,
      is_email_verified: u.is_email_verified,
      created_at: u.created_at,
      updated_at: u.updated_at,
      name: u.creators?.name,
      role: u.creators?.role,
      profile_slug: u.creators?.profile_slug,
    }));
    
    return res.json({ users, active_admin_count: admins?.length || 0 });
  } catch (error) {
    return next(error);
  }
});

router.post('/:userId/suspend', async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    const rawSuspend = req.body.suspend;
    const shouldSuspend = !(rawSuspend === false || rawSuspend === 'false' || rawSuspend === 0 || rawSuspend === '0');
    const { data: account, error: getError } = await supabaseAdmin
      .from('creator_accounts')
      .select('*')
      .eq('id', userId)
      .single();
    if (getError?.code === 'PGRST116' || !account) {
      return res.status(404).json({ error: 'user not found' });
    }
    if (getError) throw getError;
    
    const { error } = await supabaseAdmin
      .from('creator_accounts')
      .update({ is_suspended: shouldSuspend })
      .eq('id', userId);
    if (error) throw error;
    
    await writeAudit({
      actionType: shouldSuspend ? 'USER_SUSPEND' : 'USER_REACTIVATE',
      actor: `admin:${req.user.id}`,
      target: `user:${userId}`,
    });
    return res.json({ success: true, suspended: shouldSuspend });
  } catch (error) {
    return next(error);
  }
});

async function upsertRole(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const role = String(req.body.role || '').toUpperCase();
    if (!['CREATOR', 'BUSINESS'].includes(role)) {
      return res.status(400).json({ error: 'role must be CREATOR or BUSINESS' });
    }
    const { data: account, error: getError } = await supabaseAdmin
      .from('creator_accounts')
      .select('creator_id')
      .eq('id', userId)
      .single();
    if (getError?.code === 'PGRST116' || !account) {
      return res.status(404).json({ error: 'user not found' });
    }
    if (getError) throw getError;
    
    const { error } = await supabaseAdmin
      .from('creators')
      .update({ role })
      .eq('id', account.creator_id);
    if (error) throw error;
    
    await writeAudit({
      actionType: 'USER_ROLE_CHANGE',
      actor: `admin:${req.user.id}`,
      target: `creator:${account.creator_id}`,
      afterSnapshot: { role },
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
}

router.put('/:userId/role', upsertRole);
router.post('/:userId/role', upsertRole);

async function upsertEmailVerify(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    const rawVerified = req.body.verified;
    const verified = !(rawVerified === false || rawVerified === 'false' || rawVerified === 0 || rawVerified === '0');
    const { data: account, error: getError } = await supabaseAdmin
      .from('creator_accounts')
      .select('id')
      .eq('id', userId)
      .single();
    if (getError?.code === 'PGRST116' || !account) {
      return res.status(404).json({ error: 'user not found' });
    }
    if (getError) throw getError;
    
    const { error } = await supabaseAdmin
      .from('creator_accounts')
      .update({ is_email_verified: verified })
      .eq('id', userId);
    if (error) throw error;
    
    await writeAudit({
      actionType: 'USER_EMAIL_VERIFY_TOGGLE',
      actor: `admin:${req.user.id}`,
      target: `user:${userId}`,
      afterSnapshot: { verified },
    });
    return res.json({ success: true, verified });
  } catch (error) {
    return next(error);
  }
}

router.put('/:userId/email-verify', upsertEmailVerify);
router.post('/:userId/email-verify', upsertEmailVerify);

async function resetPassword(req, res, next) {
  try {
    const userId = Number(req.body.userId);
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
    if (!userId || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: 'userId and newPassword(8-128 chars) required' });
    }
    const { data: account, error: getError } = await supabaseAdmin
      .from('creator_accounts')
      .select('id')
      .eq('id', userId)
      .single();
    if (getError?.code === 'PGRST116' || !account) {
      return res.status(404).json({ error: 'user not found' });
    }
    if (getError) throw getError;
    
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const { error } = await supabaseAdmin
      .from('creator_accounts')
      .update({ password_hash: passwordHash })
      .eq('id', userId);
    if (error) throw error;
    
    await writeAudit({
      actionType: 'USER_FORCE_PASSWORD_RESET',
      actor: `admin:${req.user.id}`,
      target: `user:${userId}`,
    });
    if (String(process.env.LOCAL_STUB_EMAIL).toLowerCase() === 'true') {
      console.log(`[LOCAL_STUB_EMAIL] Password reset for user ${userId}`);
    }
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
}

router.post('/reset-password', resetPassword);
router.post('/:userId/reset-password', (req, res, next) => {
  req.body.userId = Number(req.params.userId);
  return resetPassword(req, res, next);
});

module.exports = router;

const express = require('express');
const { supabaseAdmin } = require('../../lib/supabaseClient');
const { verifyToken, requireRole } = require('../../middleware/auth');

const router = express.Router();
router.use(verifyToken, requireRole('ADMIN'));

router.get('/', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 20);
    const safeLimit = Math.max(1, Math.min(limit, 200));
    
    const { data: newContent } = await supabaseAdmin
      .from('content')
      .select('id, title, content_type, created_at')
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    
    const { data: newUsers } = await supabaseAdmin
      .from('creator_accounts')
      .select('creators(id, name, role), email, created_at')
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    
    const formattedUsers = (newUsers || []).map(u => ({
      id: u.creators?.id,
      name: u.creators?.name,
      role: u.creators?.role,
      email: u.email,
      created_at: u.created_at,
    }));
    
    return res.json({
      label: 'Live Alerts',
      mock: String(process.env.MOCK_ALERTS || 'false').toLowerCase() === 'true',
      new_content: newContent || [],
      new_users: formattedUsers,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

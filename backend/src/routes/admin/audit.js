const express = require('express');
const { supabaseAdmin } = require('../../lib/supabaseClient');
const { verifyToken, requireRole } = require('../../middleware/auth');
const { paginate } = require('../../middleware/validation');

const router = express.Router();
router.use(verifyToken, requireRole('ADMIN'));

router.get('/', paginate, async (req, res, next) => {
  try {
    const { limit, offset } = req.pagination;
    const { data: rows, error } = await supabaseAdmin
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return res.json(rows || []);
  } catch (error) {
    return next(error);
  }
});

router.get('/export', async (req, res, next) => {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-log.json"');
    return res.status(200).send(JSON.stringify(rows || [], null, 2));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

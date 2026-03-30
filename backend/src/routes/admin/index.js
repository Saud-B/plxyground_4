const express = require('express');
const { get } = require('../../db');
const { verifyToken, requireRole } = require('../../middleware/auth');
const auth = require('./auth');
const queue = require('./queue');
const content = require('./content');
const users = require('./users');
const audit = require('./audit');
const analytics = require('./analytics');
const alerts = require('./alerts');

const router = express.Router();
router.use('/auth', auth);
router.use(verifyToken, requireRole('ADMIN'));

router.use(async (req, res, next) => {
  try {
    const active = await get("SELECT id FROM admins WHERE is_active = 1 ORDER BY id ASC LIMIT 2");
    const countRow = await get("SELECT COUNT(*) AS c FROM admins WHERE is_active = 1");
    if (countRow.c !== 1 || !active) {
      return res.status(403).json({ error: 'SINGLE_ADMIN_POLICY_VIOLATION' });
    }
    if (String(active.id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'SINGLE_ADMIN_POLICY_VIOLATION' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
});

router.use('/queue', queue);
router.use('/content', content);
router.use('/users', users);
router.use('/audit', audit);
router.use('/analytics', analytics);
router.use('/alerts', alerts);

module.exports = router;

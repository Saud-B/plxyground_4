const express = require('express');
const authRoutes = require('./auth');
const businessAuth = require('./businessAuth');
const creatorRoutes = require('./creators');
const contentRoutes = require('./content');
const uploadsRoutes = require('./uploads');
const emailRoutes = require('./email');
const adminRoutes = require('./admin');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/business/auth', businessAuth);
router.use('/creators', creatorRoutes);
router.use('/content', contentRoutes);
router.use('/uploads', uploadsRoutes);
router.use('/email', emailRoutes);
router.use('/opportunities', require('./opportunities'));
router.use('/admin', adminRoutes);

module.exports = router;

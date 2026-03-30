const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/|^video\//.test(file.mimetype || '');
    if (!ok) {
      return cb(new Error('Only image/video uploads are allowed'));
    }
    return cb(null, true);
  },
});

router.post('/', verifyToken, upload.single('media'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'media file is required' });
  }
  const mediaUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  return res.status(201).json({
    success: true,
    media_url: mediaUrl,
    mime_type: req.file.mimetype,
    size: req.file.size,
  });
});

module.exports = router;

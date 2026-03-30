const { URL } = require('url');

const CONTENT_TYPES = ['article', 'video_embed', 'image_story'];

function text(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function paginate(req, res, next) {
  let { limit = 20, offset = 0 } = req.query;
  limit = parseInt(limit, 10);
  offset = parseInt(offset, 10);
  const max = req.user && req.user.role === 'ADMIN' ? 2000 : 100;
  if (isNaN(limit) || limit < 1 || limit > max) {
    return res.status(400).json({ error: `limit must be 1-${max}` });
  }
  if (isNaN(offset) || offset < 0) {
    return res.status(400).json({ error: 'offset must be >=0' });
  }
  req.pagination = { limit, offset };
  next();
}

function requireMediaUrl(req, res, next) {
  const mediaUrl = text(req.body.media_url);
  if (!mediaUrl) {
    return res.status(400).json({ error: 'media_url is required' });
  }
  try {
    const parsed = new URL(mediaUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol');
    }
  } catch (error) {
    return res.status(400).json({ error: 'media_url must be a valid http/https URL' });
  }
  req.body.media_url = mediaUrl;
  next();
}

function validateContentType(req, res, next) {
  const value = req.body.content_type;
  if (value && !CONTENT_TYPES.includes(value)) {
    return res.status(400).json({ error: 'invalid content_type' });
  }
  next();
}

function validateContentPayload(req, res, next) {
  const title = text(req.body.title);
  const body = text(req.body.body);
  if (!title || title.length > 180) {
    return res.status(400).json({ error: 'title is required and must be <= 180 chars' });
  }
  if (!body || body.length > 10000) {
    return res.status(400).json({ error: 'body is required and must be <= 10000 chars' });
  }
  req.body.title = title;
  req.body.body = body;
  next();
}

function validateEmailPassword(req, res, next) {
  const email = text(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'valid email is required' });
  }
  if (!password || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'password must be 8-128 chars' });
  }
  req.body.email = email;
  req.body.password = password;
  next();
}

module.exports = {
  paginate,
  requireMediaUrl,
  validateContentType,
  validateContentPayload,
  validateEmailPassword,
  CONTENT_TYPES,
};

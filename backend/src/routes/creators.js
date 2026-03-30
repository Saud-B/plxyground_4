const express = require('express');
const { supabaseAdmin } = require('../lib/supabaseClient');
const { verifyToken } = require('../middleware/auth');
const { paginate } = require('../middleware/validation');

const router = express.Router();

router.get('/', paginate, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    const { limit, offset } = req.pagination;
    
    let query = supabaseAdmin
      .from('creators')
      .select('*')
      .eq('is_active', 1)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Apply search filter
    if (q) {
      query = query.or(`name.ilike.%${q}%,bio.ilike.%${q}%,location.ilike.%${q}%`);
    }
    
    const { data: rows, error } = await query;
    
    if (error) throw error;
    
    return res.json((rows || []).map((row) => ({ ...row, social_links: safeJson(row.social_links) })));
  } catch (error) {
    return next(error);
  }
});

router.get('/slug/:slug', async (req, res, next) => {
  try {
    const { data: row, error: getError } = await supabaseAdmin
      .from('creators')
      .select('*')
      .eq('profile_slug', req.params.slug)
      .single();
    
    if (getError) {
      if (getError.code === 'PGRST116') {
        return res.status(404).json({ error: 'not found' });
      }
      throw getError;
    }
    
    if (!row) {
      return res.status(404).json({ error: 'not found' });
    }
    
    // Fetch posts for this creator
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('content')
      .select('id, title, body, media_url, content_type, is_published, created_at, updated_at')
      .eq('creator_id', row.id)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (postsError) throw postsError;
    
    return res.json({ ...row, social_links: safeJson(row.social_links), posts: posts || [] });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { data: row, error: getError } = await supabaseAdmin
      .from('creators')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (getError) {
      if (getError.code === 'PGRST116') {
        return res.status(404).json({ error: 'not found' });
      }
      throw getError;
    }
    
    if (!row) {
      return res.status(404).json({ error: 'not found' });
    }
    
    // Fetch posts for this creator
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('content')
      .select('id, title, body, media_url, content_type, is_published, created_at, updated_at')
      .eq('creator_id', row.id)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (postsError) throw postsError;
    
    return res.json({ ...row, social_links: safeJson(row.social_links), posts: posts || [] });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', verifyToken, async (req, res, next) => {
  try {
    if (String(req.user.id) !== String(req.params.id)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const bio = sanitizeLen(req.body.bio, 1000);
    const location = sanitizeLen(req.body.location, 180);
    const socialLinks = validateSocialLinks(req.body.social_links || {});

    const { error } = await supabaseAdmin
      .from('creators')
      .update({
        bio,
        location,
        social_links: JSON.stringify(socialLinks),
      })
      .eq('id', req.params.id);
    
    if (error) throw error;
    
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

function validateSocialLinks(payload) {
  const result = {};
  if (!payload || typeof payload !== 'object') {
    return result;
  }
  const keys = ['instagram', 'x', 'tiktok', 'youtube', 'website', 'linkedin'];
  for (const key of keys) {
    const value = typeof payload[key] === 'string' ? payload[key].trim() : '';
    if (!value) {
      continue;
    }
    if (!/^https?:\/\/[^\s]+$/i.test(value)) {
      const error = new Error(`Invalid social link for ${key}`);
      error.status = 400;
      throw error;
    }
    result[key] = value.slice(0, 300);
  }
  return result;
}

function sanitizeLen(value, max) {
  if (typeof value !== 'string') {
    return null;
  }
  return value.trim().slice(0, max);
}

function safeJson(value) {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
}

module.exports = router;

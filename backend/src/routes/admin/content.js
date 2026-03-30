const express = require('express');
const { supabaseAdmin } = require('../../lib/supabaseClient');
const { verifyToken, requireRole } = require('../../middleware/auth');
const { paginate, requireMediaUrl, validateContentType, validateContentPayload } = require('../../middleware/validation');
const { writeAudit } = require('../../services/audit');

const router = express.Router();
router.use(verifyToken, requireRole('ADMIN'));

router.get('/', paginate, async (req, res, next) => {
  try {
    const { limit, offset } = req.pagination;
    const { data: rows, error } = await supabaseAdmin
      .from('content')
      .select('*, creators(name)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    
    const contentWithCreatorNames = (rows || []).map(c => ({
      ...c,
      creator_name: c.creators?.name,
    }));
    return res.json(contentWithCreatorNames);
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', requireMediaUrl, validateContentType, validateContentPayload, async (req, res, next) => {
  try {
    const { data: existing, error: getError } = await supabaseAdmin
      .from('content')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (getError?.code === 'PGRST116' || !existing) {
      return res.status(404).json({ error: 'not found' });
    }
    if (getError) throw getError;
    
    const isPublished = typeof req.body.is_published === 'boolean' ? req.body.is_published : existing.is_published;
    const contentType = req.body.content_type || existing.content_type;
    
    const updateData = {
      title: req.body.title,
      body: req.body.body,
      media_url: req.body.media_url,
      content_type: contentType,
      is_published: isPublished,
    };
    
    if (isPublished && !existing.published_at) {
      updateData.published_at = new Date().toISOString();
    } else if (!isPublished) {
      updateData.published_at = null;
    }
    
    const { error } = await supabaseAdmin
      .from('content')
      .update(updateData)
      .eq('id', req.params.id);
    if (error) throw error;
    
    await writeAudit({
      actionType: 'ADMIN_CONTENT_UPDATE',
      actor: `admin:${req.user.id}`,
      target: `content:${req.params.id}`,
      beforeSnapshot: existing,
      afterSnapshot: { ...existing, ...updateData },
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { data: existing, error: getError } = await supabaseAdmin
      .from('content')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (getError?.code === 'PGRST116' || !existing) {
      return res.status(404).json({ error: 'not found' });
    }
    if (getError) throw getError;
    
    const { error } = await supabaseAdmin
      .from('content')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    
    await writeAudit({
      actionType: 'ADMIN_CONTENT_DELETE',
      actor: `admin:${req.user.id}`,
      target: `content:${req.params.id}`,
      beforeSnapshot: existing,
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

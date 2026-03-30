const express = require('express');
const { supabaseAdmin } = require('../lib/supabaseClient');
const { verifyToken } = require('../middleware/auth');
const {
  paginate,
  requireMediaUrl,
  validateContentType,
  validateContentPayload,
} = require('../middleware/validation');
const { writeAudit } = require('../services/audit');
const metrics = require('../services/metrics');

const router = express.Router();

router.get('/', paginate, async (req, res, next) => {
  try {
    const { limit, offset } = req.pagination;
    const q = (req.query.q || '').trim().toLowerCase();
    
    let query = supabaseAdmin
      .from('content')
      .select(`
        *,
        creators!inner(name)
      `)
      .eq('is_published', 1)
      .order('feed_rank_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);
    
    // Apply search filter if query provided
    if (q) {
      query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`);
      query = query.or(`creators.name.ilike.%${q}%`, { referencedTable: 'creators' });
    }
    
    const { data: rows, error } = await query;
    
    if (error) throw error;
    
    // Transform createdData to match old format
    const transformed = (rows || []).map(row => ({
      ...row,
      creator_name: row.creators.name,
    }));
    
    return res.json(transformed);
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { data: row, error } = await supabaseAdmin
      .from('content')
      .select(`
        *,
        creators!inner(name)
      `)
      .eq('id', req.params.id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'not found' });
      }
      throw error;
    }
    
    if (!row) {
      return res.status(404).json({ error: 'not found' });
    }
    
    // Transform to old format
    const result = {
      ...row,
      creator_name: row.creators.name,
    };
    delete result.creators;
    
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.post('/', verifyToken, requireMediaUrl, validateContentType, validateContentPayload, async (req, res, next) => {
  try {
    const contentType = req.body.content_type || 'article';
    
    // Insert content
    const { data: contentData, error: contentError } = await supabaseAdmin
      .from('content')
      .insert([
        {
          creator_id: req.user.id,
          content_type: contentType,
          title: req.body.title,
          body: req.body.body,
          media_url: req.body.media_url,
          is_published: 0,
          feed_rank_at: new Date().toISOString(),
        },
      ])
      .select('id');
    
    if (contentError) throw contentError;
    if (!contentData || !contentData[0]) {
      throw new Error('Failed to create content');
    }
    
    const contentId = contentData[0].id;

    // Insert into moderation queue
    const { error: queueError } = await supabaseAdmin
      .from('moderation_queue')
      .insert([
        {
          type: 'content',
          status: 'PENDING',
          title_or_name: req.body.title,
          submitted_by: req.user.id,
          entity_id: contentId,
        },
      ]);
    
    if (queueError) throw queueError;

    metrics.inc('content_create');
    await writeAudit({
      actionType: 'CONTENT_CREATE',
      actor: `${req.user.role}:${req.user.id}`,
      target: `content:${contentId}`,
      afterSnapshot: { title: req.body.title, media_url: req.body.media_url, content_type: contentType },
    });
    return res.status(201).json({ id: contentId, status: 'PENDING' });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', verifyToken, requireMediaUrl, validateContentType, validateContentPayload, async (req, res, next) => {
  try {
    // Get existing content
    const { data: existing, error: getError } = await supabaseAdmin
      .from('content')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (getError) {
      if (getError.code === 'PGRST116') {
        return res.status(404).json({ error: 'not found' });
      }
      throw getError;
    }

    if (!existing) {
      return res.status(404).json({ error: 'not found' });
    }
    if (String(existing.creator_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    
    const nextType = req.body.content_type || existing.content_type;
    
    // Update content
    const { error: updateError } = await supabaseAdmin
      .from('content')
      .update({
        title: req.body.title,
        body: req.body.body,
        media_url: req.body.media_url,
        content_type: nextType,
        is_published: 0,
      })
      .eq('id', req.params.id);
    
    if (updateError) throw updateError;

    // Insert into moderation queue
    const { error: queueError } = await supabaseAdmin
      .from('moderation_queue')
      .insert([
        {
          type: 'content',
          status: 'PENDING',
          title_or_name: req.body.title,
          submitted_by: req.user.id,
          entity_id: req.params.id,
        },
      ]);
    
    if (queueError) throw queueError;

    metrics.inc('content_update');
    await writeAudit({
      actionType: 'CONTENT_UPDATE',
      actor: `${req.user.role}:${req.user.id}`,
      target: `content:${req.params.id}`,
      beforeSnapshot: existing,
      afterSnapshot: {
        ...existing,
        title: req.body.title,
        body: req.body.body,
        media_url: req.body.media_url,
        content_type: nextType,
      },
    });
    return res.json({ success: true, status: 'PENDING' });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    // Get existing content
    const { data: existing, error: getError } = await supabaseAdmin
      .from('content')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (getError) {
      if (getError.code === 'PGRST116') {
        return res.status(404).json({ error: 'not found' });
      }
      throw getError;
    }

    if (!existing) {
      return res.status(404).json({ error: 'not found' });
    }
    if (String(existing.creator_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    // Delete content
    const { error: deleteError } = await supabaseAdmin
      .from('content')
      .delete()
      .eq('id', req.params.id);
    
    if (deleteError) throw deleteError;

    metrics.inc('content_delete');
    await writeAudit({
      actionType: 'CONTENT_DELETE',
      actor: `${req.user.role}:${req.user.id}`,
      target: `content:${req.params.id}`,
      beforeSnapshot: existing,
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

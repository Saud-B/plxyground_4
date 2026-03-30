const express = require('express');
const { verifyToken, requireRole } = require('../../middleware/auth');
const { supabaseAdmin } = require('../../lib/supabaseClient');
const { writeAudit } = require('../../services/audit');
const metrics = require('../../services/metrics');

const router = express.Router();
router.use(verifyToken, requireRole('ADMIN'));

router.get('/', async (req, res, next) => {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('moderation_queue')
      .select('id, type, status, title_or_name, submitted_by, report_count, assigned_admin, entity_id, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error) throw error;
    return res.json(rows || []);
  } catch (error) {
    return next(error);
  }
});

router.post('/bulk-action', async (req, res, next) => {
  try {
    const action = String(req.body.action || '').toUpperCase();
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map((id) => Number(id)).filter(Boolean) : [];
    const assignAdmin = req.body.assign_admin ? Number(req.body.assign_admin) : null;
    if (!['APPROVE', 'REJECT', 'DELETE', 'ASSIGN'].includes(action) || ids.length === 0) {
      return res.status(400).json({ error: 'valid action and ids[] required' });
    }

    // Fetch queue items and related content
    const { data: previousState, error: fetchError } = await supabaseAdmin
      .from('moderation_queue')
      .select('*, content(is_published)')
      .in('id', ids);
    if (fetchError) throw fetchError;
    if (!previousState || previousState.length === 0) {
      return res.status(404).json({ error: 'queue items not found' });
    }

    // Process each item based on action
    for (const item of previousState) {
      if (action === 'ASSIGN') {
        await supabaseAdmin
          .from('moderation_queue')
          .update({ assigned_admin: assignAdmin || req.user.id, status: 'ASSIGNED' })
          .eq('id', item.id);
      } else if (action === 'APPROVE') {
        await supabaseAdmin
          .from('moderation_queue')
          .update({ status: 'APPROVED' })
          .eq('id', item.id);
        if (item.type === 'content' && item.entity_id) {
          const { data: existing } = await supabaseAdmin
            .from('content')
            .select('published_at')
            .eq('id', item.entity_id)
            .single();
          await supabaseAdmin
            .from('content')
            .update({ is_published: true, published_at: existing?.published_at || new Date().toISOString() })
            .eq('id', item.entity_id);
        }
      } else if (action === 'REJECT') {
        await supabaseAdmin
          .from('moderation_queue')
          .update({ status: 'REJECTED' })
          .eq('id', item.id);
        if (item.type === 'content' && item.entity_id) {
          await supabaseAdmin
            .from('content')
            .update({ is_published: false })
            .eq('id', item.entity_id);
        }
      } else if (action === 'DELETE') {
        await supabaseAdmin
          .from('moderation_queue')
          .update({ status: 'DELETED' })
          .eq('id', item.id);
        if (item.type === 'content' && item.entity_id) {
          await supabaseAdmin
            .from('content')
            .update({ is_published: false })
            .eq('id', item.entity_id);
        }
      }
    }

    // Store undo log
    const undoUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { data: logEntries, error: logError } = await supabaseAdmin
      .from('bulk_action_log')
      .insert([
        {
          admin: `admin:${req.user.id}`,
          action_type: action,
          target_type: 'moderation_queue',
          target_ids: JSON.stringify(ids),
          previous_state: JSON.stringify(previousState),
          undo_window_expires_at: undoUntil,
        },
      ])
      .select();
    if (logError) throw logError;
    const logId = logEntries[0].id;

    metrics.inc('moderation_actions');
    await writeAudit({
      actionType: `QUEUE_BULK_${action}`,
      actor: `admin:${req.user.id}`,
      target: `queue:${ids.join(',')}`,
      metadata: { undo_log_id: logId },
    });
    return res.json({ success: true, undo_log_id: logId, undo_window_expires_at: undoUntil });
  } catch (error) {
    return next(error);
  }
});

router.post('/bulk-action/undo', async (req, res, next) => {
  try {
    const logId = Number(req.body.log_id);
    if (!logId) {
      return res.status(400).json({ error: 'log_id is required' });
    }
    const { data: logRow, error: logFetchError } = await supabaseAdmin
      .from('bulk_action_log')
      .select('*')
      .eq('id', logId)
      .single();
    if (logFetchError?.code === 'PGRST116' || !logRow) {
      return res.status(404).json({ error: 'bulk action log not found' });
    }
    if (logFetchError) throw logFetchError;
    
    if (logRow.undone_at) {
      return res.status(400).json({ error: 'action already undone' });
    }
    if (new Date(logRow.undo_window_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'undo window expired' });
    }
    
    const previous = JSON.parse(logRow.previous_state || '[]');
    for (const item of previous) {
      await supabaseAdmin
        .from('moderation_queue')
        .update({ status: item.status, assigned_admin: item.assigned_admin })
        .eq('id', item.id);
      
      if (item.type === 'content' && item.entity_id) {
        if (item.status !== 'DELETED') {
          await supabaseAdmin
            .from('content')
            .update({ is_published: item.is_published || false })
            .eq('id', item.entity_id);
        }
      }
    }
    
    await supabaseAdmin
      .from('bulk_action_log')
      .update({ undone_at: new Date().toISOString() })
      .eq('id', logId);
    
    await writeAudit({
      actionType: 'QUEUE_BULK_UNDO',
      actor: `admin:${req.user.id}`,
      target: `bulk_action:${logId}`,
    });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

const { supabaseAdmin } = require('../lib/supabaseClient');

async function writeAudit({
  actionType,
  actor,
  target,
  beforeSnapshot = null,
  afterSnapshot = null,
  reason = null,
  metadata = null,
}) {
  const { error } = await supabaseAdmin
    .from('audit_log')
    .insert([
      {
        action_type: actionType,
        actor,
        target,
        before_snapshot: beforeSnapshot ? JSON.stringify(beforeSnapshot) : null,
        after_snapshot: afterSnapshot ? JSON.stringify(afterSnapshot) : null,
        reason,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    ]);
  
  if (error) throw error;
}

module.exports = { writeAudit };

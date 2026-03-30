// ADMIN ROUTES MIGRATION TEMPLATE
// Copy this template and apply to these files:
// - src/routes/admin/users.js
// - src/routes/admin/queue.js
// - src/routes/admin/content.js
// - src/routes/admin/analytics.js
// - src/routes/admin/alerts.js
// - src/routes/admin/audit.js

// ===================================================
// STEP 1: Replace the import
// ===================================================

// OLD:
// const { all, get, run } = require('../../db');

// NEW:
// const { supabaseAdmin } = require('../../lib/supabaseClient');


// ===================================================
// STEP 2: Replace query patterns
// ===================================================

// SELECT (multiple rows)
// OLD: const rows = await all('SELECT * FROM table WHERE ...', [params]);
// NEW:
/*
const { data: rows, error } = await supabaseAdmin
  .from('table')
  .select('*')
  .eq('column', value);

if (error) throw error;
// rows is now an array or null
*/

// SELECT (single row)
// OLD: const row = await get('SELECT * FROM table WHERE id = ?', [id]);
// NEW:
/*
const { data: row, error } = await supabaseAdmin
  .from('table')
  .select('*')
  .eq('id', id)
  .single();

if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
// row is the object or null
*/

// INSERT
// OLD: const result = await run('INSERT INTO table (...) VALUES (...)', [values]);
// NEW:
/*
const { data, error } = await supabaseAdmin
  .from('table')
  .insert([{ col1: val1, col2: val2 }])
  .select('id');

if (error) throw error;
// data[0].id contains the new ID if you selected it
*/

// UPDATE
// OLD: await run('UPDATE table SET ... WHERE id = ?', [values, id]);
// NEW:
/*
const { error } = await supabaseAdmin
  .from('table')
  .update({ column: newValue })
  .eq('id', id);

if (error) throw error;
*/

// DELETE
// OLD: await run('DELETE FROM table WHERE id = ?', [id]);
// NEW:
/*
const { error } = await supabaseAdmin
  .from('table')
  .delete()
  .eq('id', id);

if (error) throw error;
*/


// ===================================================
// DETAILED EXAMPLES FROM EXISTING MIGRATED FILES
// ===================================================

// Example 1: Admin Auth Login (already migrated - reference)
/*
const { data: admin, error } = await supabaseAdmin
  .from('admins')
  .select('*')
  .eq('email', req.body.email)
  .single();

if (error && error.code !== 'PGRST116') throw error;

if (!admin) {
  metrics.inc('auth_failure');
  return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
}
*/

// Example 2: Content Search with Pagination
/*
const { limit, offset } = req.pagination;
const q = (req.query.q || '').trim().toLowerCase();

let query = supabaseAdmin
  .from('content')
  .select('*, creators(name)')
  .eq('is_published', 1)
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);

if (q) {
  query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`);
}

const { data: rows, error } = await query;
if (error) throw error;

return res.json(rows);
*/

// Example 3: Moderation Queue Insert and Update
/*
// Insert:
const { error: insertError } = await supabaseAdmin
  .from('moderation_queue')
  .insert([{
    type: 'content',
    status: 'PENDING',
    title_or_name: title,
    submitted_by: userId,
    entity_id: entityId,
  }]);

if (insertError) throw insertError;

// Update:
const { error: updateError } = await supabaseAdmin
  .from('moderation_queue')
  .update({ 
    status: 'APPROVED',
    updated_at: new Date().toISOString()
  })
  .eq('id', queueId);

if (updateError) throw updateError;
*/

// Example 4: Complex Filter with Multiple Conditions
/*
const { data: results, error } = await supabaseAdmin
  .from('moderation_queue')
  .select('*')
  .eq('type', 'content')
  .eq('status', 'PENDING')
  .gte('created_at', startDate)
  .lte('created_at', endDate)
  .order('created_at', { ascending: false })
  .limit(50);

if (error) throw error;
*/

// Example 5: Audit Log Query
/*
const { data: logs, error } = await supabaseAdmin
  .from('audit_log')
  .select('*')
  .eq('action_type', 'CONTENT_DELETE')
  .order('created_at', { ascending: false })
  .range(0, 99);

if (error) throw error;

return res.json(logs);
*/


// ===================================================
// FILTER OPERATORS REFERENCE
// ===================================================

/*
EQUALITY:
.eq('column', value)              // = value
.neq('column', value)             // != value
.lte('column', value)             // <= value
.lt('column', value)              // < value
.gte('column', value)             // >= value
.gt('column', value)              // > value

PATTERN MATCHING:
.ilike('column', '%pattern%')     // CASE INSENSITIVE LIKE
.like('column', '%pattern%')      // CASE SENSITIVE LIKE
.in('column', [val1, val2])       // IN (val1, val2)

NULL CHECKS:
.is('column', null)               // IS NULL
.not('column', 'is', null)        // IS NOT NULL

OTHER:
.or('col1.eq.value,col2.eq.value') // OR condition (needs exact filter syntax)
.contains('column', '{"key": "value"}')  // For JSONB columns

ORDERING:
.order('column')
.order('column', { ascending: true })
.order('column', { ascending: false, nullsFirst: false })

PAGINATION:
.range(0, 9)           // Get rows 0-9 (10 rows)
.range(10, 19)         // Get rows 10-19
.limit(10)             // Get first 10 rows
.offset(10)            // Skip first 10 rows, then get all

RELATIONSHIPS:
.select('*, table_name(column1, column2)')  // JOIN
.select('*, table_name(*)')                 // JOIN all columns
*/


// ===================================================
// ADMIN ROUTES MIGRATION CHECKLIST
// ===================================================

/*
For each admin route file, follow this checklist:

[ ] 1. Change import:
       FROM: const { all, get, run } = require('../../db');
       TO: const { supabaseAdmin } = require('../../lib/supabaseClient');

[ ] 2. Replace all `await all()` calls with supabaseAdmin.from().select()
       
[ ] 3. Replace all `await get()` calls with supabaseAdmin.from().select().single()
       
[ ] 4. Replace all `await run()` calls with appropriate INSERT/UPDATE/DELETE

[ ] 5. Handle error responses:
       - Check for error object after every query
       - For single queries, check error.code === 'PGRST116' for "not found"
       
[ ] 6. Test the endpoint:
       - Call it with curl or Postman
       - Verify response matches expected format
       - Check no errors in server logs

[ ] 7. Verify in Supabase Dashboard:
       - Check data appears in correct tables
       - Verify RLS policies are working (if applicable)
*/


// ===================================================
// EXAMPLE COMPLETE MIGRATION: users.js
// ===================================================

/*
// BEFORE (SQLite):
const express = require('express');
const { all, get, run } = require('../../db');
const { verifyToken, requireRole } = require('../../middleware/auth');
const { writeAudit } = require('../../services/audit');

const router = express.Router();

router.get('/', verifyToken, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const rows = await all('SELECT ca.*, c.name FROM creator_accounts ca JOIN creators c ON c.id = ca.creator_id');
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

// AFTER (Supabase):
const express = require('express');
const { supabaseAdmin } = require('../../lib/supabaseClient');
const { verifyToken, requireRole } = require('../../middleware/auth');
const { writeAudit } = require('../../services/audit');

const router = express.Router();

router.get('/', verifyToken, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('creator_accounts')
      .select('*, creators(name)');
    
    if (error) throw error;
    
    return res.json(rows || []);
  } catch (error) {
    return next(error);
  }
});
*/

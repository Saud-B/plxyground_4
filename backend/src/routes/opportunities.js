const express = require('express');
const { supabaseAdmin } = require('../lib/supabaseClient');
const { paginate } = require('../middleware/validation');

const router = express.Router();

router.get('/', paginate, async (req, res, next) => {
  try {
    const { limit, offset } = req.pagination;
    
    const { data: rows, error } = await supabaseAdmin
      .from('opportunities')
      .select(`
        *,
        creators(name)
      `)
      .eq('is_published', 1)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    // Transform data to match old format
    const transformed = (rows || []).map(row => ({
      ...row,
      creator_name: row.creators?.name || null,
    }));
    
    return res.json(transformed);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

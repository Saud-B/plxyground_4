const express = require('express');
const { supabaseAdmin } = require('../../lib/supabaseClient');
const { verifyToken, requireRole } = require('../../middleware/auth');

const router = express.Router();
router.use(verifyToken, requireRole('ADMIN'));

router.get('/', async (req, res, next) => {
  try {
    // Get creator counts
    const { count: creatorsCount } = await supabaseAdmin
      .from('creators')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'CREATOR');
    
    const { count: businessesCount } = await supabaseAdmin
      .from('creators')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'BUSINESS');
    
    const { count: totalContentCount } = await supabaseAdmin
      .from('content')
      .select('*', { count: 'exact', head: true });
    
    const { count: publishedContentCount } = await supabaseAdmin
      .from('content')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true);
    
    const { count: pendingContentCount } = await supabaseAdmin
      .from('content')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', false);
    
    // Last 7 days content
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: last7DaysCount } = await supabaseAdmin
      .from('content')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo);
    
    // Trend: last 13 days of content creation
    const thirteenDaysAgo = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString();
    const { data: trendData, error: trendError } = await supabaseAdmin
      .rpc('get_content_trend', { days_back: 13 });
    
    let trend = [];
    if (!trendError && trendData) {
      trend = trendData;
    } else {
      // Fallback: basic daily count (manual grouping in memory)
      const { data: allContent } = await supabaseAdmin
        .from('content')
        .select('created_at')
        .gte('created_at', thirteenDaysAgo);
      
      const trendMap = {};
      (allContent || []).forEach(c => {
        const day = c.created_at.split('T')[0];
        trendMap[day] = (trendMap[day] || 0) + 1;
      });
      trend = Object.entries(trendMap).map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day));
    }

    return res.json({
      kpis: {
        creators: creatorsCount || 0,
        businesses: businessesCount || 0,
        total_content: totalContentCount || 0,
        published_content: publishedContentCount || 0,
        pending_content: pendingContentCount || 0,
        last_7_days_content: last7DaysCount || 0,
      },
      trend,
      mock: String(process.env.MOCK_ANALYTICS || 'false').toLowerCase() === 'true',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

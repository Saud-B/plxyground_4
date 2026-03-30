const { supabaseAdmin } = require('../src/lib/supabaseClient');
(async ()=>{
  try {
    const { data: creators } = await supabaseAdmin
      .from('creators')
      .select('id, profile_slug, name');
    console.log('creators:', creators);
    
    const { data: accounts } = await supabaseAdmin
      .from('creator_accounts')
      .select('id, creator_id, email, is_suspended');
    console.log('accounts:', accounts);
    
    const { data: content } = await supabaseAdmin
      .from('content')
      .select('id, creator_id, title, is_published')
      .order('id', { ascending: false })
      .limit(50);
    console.log('content:', content);
  } catch (e) {
    console.error('inspect error', e);
  }
})();

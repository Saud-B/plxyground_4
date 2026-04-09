const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Log warnings if vars are missing, but don't throw (Vercel needs the module to load)
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Warning: Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Environment Variables.'
  );
}

// Client for use in API routes (uses only public/anon key)
// Will be null if credentials are missing, routes should handle this gracefully
const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Client with service role key for server-side operations only
const supabaseAdmin = supabaseServiceKey && supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

module.exports = {
  supabase,
  supabaseAdmin,
};

const { supabaseAdmin } = require('./lib/supabaseClient');

let db;

function initDb() {
  if (db) {
    return db;
  }
  const dbProvider = process.env.DB_PROVIDER || 'supabase';
  if (dbProvider !== 'supabase') {
    throw new Error(`DB_PROVIDER "${dbProvider}" is not implemented in this build. Use supabase.`);
  }
  
  if (!supabaseAdmin) {
    console.warn('Warning: Supabase not fully initialized. Database credentials may be missing.');
    console.warn('Check that NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are set.');
  }
  
  db = supabaseAdmin;
  // Note: PostgreSQL schema must be created manually in Supabase Dashboard using postgres_schema.sql
  return db;
}

module.exports = {
  initDb,
};

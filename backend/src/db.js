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
    throw new Error('Supabase not initialized. Check environment variables.');
  }
  
  db = supabaseAdmin;
  // Note: PostgreSQL schema must be created manually in Supabase Dashboard using postgres_schema.sql
  return db;
}

module.exports = {
  initDb,
};

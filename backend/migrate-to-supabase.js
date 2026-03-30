/**
 * Migration script to transfer data from SQLite to Supabase
 * 
 * Run with: node migrate-to-supabase.js
 * 
 * Prerequisites:
 * 1. .env file must have Supabase credentials configured
 * 2. PostgreSQL schema must be created in Supabase (run postgres_schema.sql)
 * 3. SQLite database file must exist at the configured path
 * 4. Ensure all tables in Supabase are empty before running
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { supabaseAdmin } = require('./src/lib/supabaseClient');

if (!supabaseAdmin) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured. Check your .env file.');
}

const DB_PATH = process.env.DATABASE_URL || './data/plxyground.db';
const absolutePath = path.isAbsolute(DB_PATH) ? DB_PATH : path.join(process.cwd(), DB_PATH);

let migratedCount = {
  creators: 0,
  creator_accounts: 0,
  content: 0,
  opportunities: 0,
  admins: 0,
  moderation_queue: 0,
  audit_log: 0,
  bulk_action_log: 0,
  refresh_tokens: 0,
};

const BATCH_SIZE = 100; // Insert in batches to avoid overwhelming the DB

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getAllRows(db, query) {
  return new Promise((resolve, reject) => {
    db.all(query, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function insertBatch(table, records) {
  if (records.length === 0) return;
  
  try {
    const { data, error } = await supabaseAdmin
      .from(table)
      .insert(records);
    
    if (error) {
      console.error(`Error inserting into ${table}:`, error.message);
      throw error;
    }
    
    migratedCount[table] += records.length;
    console.log(`✓ Inserted ${records.length} rows into ${table} (total: ${migratedCount[table]})`);
  } catch (err) {
    console.error(`Failed to insert batch into ${table}:`, err);
    throw err;
  }
}

async function migrateTable(db, tableName, query) {
  console.log(`\n📋 Migrating ${tableName}...`);
  
  try {
    const rows = await getAllRows(db, query);
    console.log(`Found ${rows.length} rows in SQLite ${tableName}`);
    
    // Insert in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await insertBatch(tableName, batch);
      await sleep(100); // Small delay between batches
    }
    
    return rows.length;
  } catch (err) {
    console.error(`❌ Migration of ${tableName} failed:`, err.message);
    throw err;
  }
}

async function migrate() {
  console.log('🚀 Starting Supabase migration...\n');
  console.log(`SQLite DB path: ${absolutePath}`);
  console.log(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`);

  const db = new sqlite3.Database(absolutePath);

  try {
    // Table migration order (respecting foreign key constraints)
    
    // 1. Creators
    await migrateTable(db, 'creators', 'SELECT * FROM creators');
    
    // 2. Creator Accounts
    await migrateTable(db, 'creator_accounts', 'SELECT * FROM creator_accounts');
    
    // 3. Content
    await migrateTable(db, 'content', 'SELECT * FROM content');
    
    // 4. Opportunities
    await migrateTable(db, 'opportunities', 'SELECT * FROM opportunities');
    
    // 5. Admins
    await migrateTable(db, 'admins', 'SELECT * FROM admins');
    
    // 6. Moderation Queue
    await migrateTable(db, 'moderation_queue', 'SELECT * FROM moderation_queue');
    
    // 7. Audit Log
    await migrateTable(db, 'audit_log', 'SELECT * FROM audit_log');
    
    // 8. Bulk Action Log
    await migrateTable(db, 'bulk_action_log', 'SELECT * FROM bulk_action_log');
    
    // 9. Refresh Tokens
    await migrateTable(db, 'refresh_tokens', 'SELECT * FROM refresh_tokens');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\nSummary:');
    Object.entries(migratedCount).forEach(([table, count]) => {
      if (count > 0) {
        console.log(`  ${table}: ${count} rows`);
      }
    });
    console.log('\n⚠️  Next steps:');
    console.log('  1. Review the migrated data in Supabase Dashboard');
    console.log('  2. Update your backend code to use Supabase client');
    console.log('  3. Test all API endpoints thoroughly');
    console.log('  4. Remove SQLite dependencies from package.json');
    
  } catch (err) {
    console.error('\n❌ MIGRATION FAILED:', err.message);
    console.error('\nPlease check:');
    console.error('  1. Supabase credentials are correct in .env');
    console.error('  2. PostgreSQL schema is created in Supabase');
    console.error('  3. Supabase tables are empty (no foreign key conflicts)');
    process.exit(1);
  } finally {
    db.close();
  }
}

// Prevent accidental data loss
console.log('\n⚠️  WARNING: This script will transfer all data from SQLite to Supabase.');
console.log('   Ensure Supabase tables are EMPTY before proceeding.\n');

migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

# SQLite to Supabase Migration Guide - PROGRESS REPORT

## Completed ✅

### 1. Supabase Client Setup
- ✅ Installed `@supabase/supabase-js` package
- ✅ Created [src/lib/supabaseClient.js](src/lib/supabaseClient.js) with client initialization
- ✅ Updated `.env` with Supabase credentials (requires your anon key and service role key)

### 2. PostgreSQL Schema  
- ✅ Created [postgres_schema.sql](postgres_schema.sql) with:
  - All table definitions (creators, creator_accounts, content, opportunities, admins, etc.)
  - Row Level Security (RLS) policies for each table
  - Indexes for performance optimization
  - Auto-update triggers for `updated_at` columns

**Next step**: Copy the contents of `postgres_schema.sql` and run it in Supabase Dashboard → SQL Editor

### 3. Data Migration Script
- ✅ Created [migrate-to-supabase.js](migrate-to-supabase.js)
- Reads from existing SQLite database and inserts into Supabase
- Batch processing to handle large datasets efficiently
- **Usage**: 
  ```bash
  node migrate-to-supabase.js
  ```
  
⚠️ **Note**: Run this AFTER tables are created in Supabase and with your service role key configured

### 4. Database Layer
- ✅ Updated [src/db.js](src/db.js) to initialize Supabase client instead of SQLite

###  5. Service Updates
- ✅ [src/services/audit.js](src/services/audit.js) - Updated to use Supabase
- ✅ [src/services/refreshTokens.js](src/services/refreshTokens.js) - Updated to use Supabase

### 6. Route Updates
- ✅ [src/routes/auth.js](src/routes/auth.js) - Complete Supabase migration
- ✅ [src/routes/businessAuth.js](src/routes/businessAuth.js) - Complete Supabase migration  
- ✅ [src/routes/content.js](src/routes/content.js) - Complete Supabase migration
- ✅ [src/routes/creators.js](src/routes/creators.js) - Complete Supabase migration
- ✅ [src/routes/opportunities.js](src/routes/opportunities.js) - Complete Supabase migration

---

## Remaining Tasks

### Admin Routes (Need Supabase Migration)
These files still use the old SQLite `db` module imports and need conversion:

1. **[src/routes/admin/auth.js](src/routes/admin/auth.js)** - Admin login/password management
2. **[src/routes/admin/users.js](src/routes/admin/users.js)** - User management endpoints
3. **[src/routes/admin/content.js](src/routes/admin/content.js)** - Content moderation
4. **[src/routes/admin/queue.js](src/routes/admin/queue.js)** - Moderation queue management
5. **[src/routes/admin/analytics.js](src/routes/admin/analytics.js)** - Analytics queries
6. **[src/routes/admin/alerts.js](src/routes/admin/alerts.js)** - Alert listing
7. **[src/routes/admin/audit.js](src/routes/admin/audit.js)** - Audit log queries
8. **[src/routes/admin/index.js](src/routes/admin/index.js)** - Dashboard stats

### Scripts & Tools
These utility files need updating:
1. **[scripts/seed.js](scripts/seed.js)** - Database seeding
2. **[tools/inspect-db.js](tools/inspect-db.js)** - Database inspection utility

### Package.json Cleanup
1. Remove `sqlite3` dependency from [backend/package.json](package.json)
2. Run `npm install` to update lock file

---

## Migration Template for Remaining Files

### Pattern: Converting SQLite queries to Supabase

**Old Pattern (SQLite):**
```javascript
const { all, get, run } = require('../db');

const rows = await all('SELECT * FROM table WHERE ...', [params]);
const row = await get('SELECT * FROM table WHERE id = ?', [id]);
await run('UPDATE table SET ... WHERE id = ?', [values, id]);
```

**New Pattern (Supabase):**
```javascript
const { supabaseAdmin } = require('../lib/supabaseClient');

// SELECT (multiple rows)
const { data: rows, error } = await supabaseAdmin
  .from('table')
  .select('*')
  .eq('column', value)
  .order('created_at', { ascending: false });

if (error) throw error;

// SELECT (single row)
const { data: row, error } = await supabaseAdmin
  .from('table')
  .select('*')
  .eq('id', id)
  .single();

if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

// INSERT
const { data, error } = await supabaseAdmin
  .from('table')
  .insert([{ column1: value1, column2: value2 }])
  .select('id');

// UPDATE
const { error } = await supabaseAdmin
  .from('table')
  .update({ column: newValue })
  .eq('id', id);

// DELETE
const { error } = await supabaseAdmin
  .from('table')
  .delete()
  .eq('id', id);
```

### Supabase PostgREST Filter Examples

```javascript
// WHERE clause with AND
.eq('status', 'PENDING')
.eq('type', 'content')

// WHERE clause with OR
.or('name.ilike.%search%,bio.ilike.%search%')

// Comparison operators
.gt('created_at', timestamp)  // >
.gte('created_at', timestamp) // >=
.lt('updated_at', timestamp)  // <
.lte('updated_at', timestamp) // <=
.neq('status', 'deleted')     // !=

// Null checks
.is('revoked_at', null)       // IS NULL
.not('field', 'is', null)     // IS NOT NULL

// LIKE pattern matching
.eq('field', 'exact_match')
.ilike('field', '%pattern%')  // Case-insensitive LIKE

// JOIN with select
.select('*, users(name, email)')  // Join and select related records

// Pagination
.range(offset, offset + limit - 1)

// Ordering
.order('created_at', { ascending: false })
.order('field', { ascending: true, nullsFirst: false })
```

---

## Configuration Checklist

Before testing, ensure:

- [ ] PostgreSQL schema created in Supabase Dashboard (run `postgres_schema.sql`)
- [ ] `.env` file has valid Supabase credentials:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Data migrated from SQLite (run `migrate-to-supabase.js`)
- [ ] All admin routes converted to Supabase
- [ ] `sqlite3` removed from `package.json`
- [ ] All tests passing

---

## Testing the Migration

### 1. Test Core Auth Flow
```bash
# Test creator signup/login
curl -X POST http://localhost:3011/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "email": "test@example.com", "password": "TestPassword123"}'
  
# Test business signup/login  
curl -X POST http://localhost:3011/api/auth/business/signup \
  -H "Content-Type: application/json" \
  -d '{"name": "Business", "email": "business@example.com", "password": "TestPassword123"}'
```

### 2. Test Content Operations
```bash
# Create content (requires auth token)
curl -X POST http://localhost:3011/api/content \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "body": "Content", "media_url": "https://...", "content_type": "article"}'
```

### 3. Check Supabase Dashboard
- View data in Tables tab
- Check RLS Policies are working (should see "no rows" if permissions deny access)
- Monitor real-time events if enabled

---

## Common Issues & Solutions

### "Missing environment variables"
**Solution**: Ensure all three Supabase keys in `.env`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key...
SUPABASE_SERVICE_ROLE_KEY=your-key...
```

### "Policy error / Permission denied"
**Solution**: Check RLS policies in Supabase Dashboard → Authentication → Policies. Policies should:
- Allow service role full access
- Allow authenticated users to access their own data
- Allow public select for published content

### "PGRST116 error" (no rows found)
This is normal when `.single()` finds no results. Handle it:
```javascript
if (error && error.code === 'PGRST116') {
  return res.status(404).json({ error: 'not found' });
}
if (error) throw error;
```

### Timestamps not updating
Ensure triggers are created. Check Supabase Dashboard → Database → Functions → `update_updated_at_column`

### Data appears but searches don't work
Full-text search requires additional setup. For now, use `.ilike()` filters with `%pattern%`

---

## Next Steps

1. **Complete admin route migrations** using the template above
2. **Remove SQLite** from dependencies:
   ```bash
   npm uninstall sqlite3
   npm install
   ```
3. **Test thoroughly** - All CRUD operations, auth flows, searches
4. **Monitor logs** in Supabase Dashboard for any errors
5. **Update README** with new database setup instructions
6. **Deploy to production** when all tests pass

---

## File Locations Reference
```
backend/
├── src/
│   ├── db.js                          ✅ Updated
│   ├── lib/
│   │   └── supabaseClient.js          ✅ Created
│   ├── routes/
│   │   ├── auth.js                    ✅ Updated
│   │   ├── businessAuth.js            ✅ Updated
│   │   ├── content.js                 ✅ Updated
│   │   ├── creators.js                ✅ Updated
│   │   ├── opportunities.js           ✅ Updated
│   │   └── admin/                     ⏳ Needs update
│   └── services/
│       ├── audit.js                   ✅ Updated
│       └── refreshTokens.js           ✅ Updated
├── postgres_schema.sql                ✅ Created
├── migrate-to-supabase.js            ✅ Created
├── package.json                       ⏳ Remove sqlite3
├── scripts/
│   └── seed.js                        ⏳ Needs update
└── tools/
    └── inspect-db.js                  ⏳ Needs update
```

---

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs  
- **PostgREST Filters**: https://postgrest.org/en/stable/api/schemas.html
- **This Guide**: Refer back for migration patterns and examples

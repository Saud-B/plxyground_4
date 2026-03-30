# Complete Setup Guide - SQLite to Supabase Migration

## Overview
Your PLXYGROUND backend has been completely migrated from SQLite to Supabase (PostgreSQL). This guide walks you through the final setup steps.

---

## Step 1: Supabase Project Setup (MANUAL)

If you haven't created a Supabase project yet:

1. **Create a Supabase account** (free tier available)
   - Go to https://supabase.com
   - Sign up with email or GitHub
   
2. **Create a new project**
   - Click "New Project"
   - Select your region
   - Create a secure database password
   - Wait for project to initialize (2-3 minutes)

3. **Get your API credentials**
   - Go to Project Settings → API
   - Find these three values:
     - **Project URL** (under "API URL")
     - **Anon Public Key** (under "Project API keys")
     - **Service Role Key** (marked as secret - keep private!)

---

## Step 2: Update Environment Variables

Update the `.env` file in `backend/` with your actual credentials:

```bash
# backend/.env
PORT=3011
DB_PROVIDER=supabase
NODE_ENV=development

# Replace these with your actual Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key-here

JWT_SECRET=local_dev_secret_change_me_2026
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:19006,http://localhost:3012
LOCAL_STUB_EMAIL=true
MOCK_ANALYTICS=false
MOCK_ALERTS=false
```

**⚠️ Important:** Never commit the `.env` file with real credentials to Git.

---

## Step 3: Create Database Schema (MANUAL)

1. **In Supabase Dashboard:**
   - Go to SQL Editor
   - Click "New Query"
   
2. **Copy schema from `backend/postgres_schema.sql`:**
   - Open: `backend/postgres_schema.sql`
   - Copy ALL content
   - Paste into Supabase SQL Editor
   - Click "Run"
   
   This creates:
   - 9 tables (creators, creator_accounts, content, etc.)
   - Row Level Security (RLS) policies
   - Indexes for performance
   - Triggers for auto-updated_at timestamps

3. **Verify schema created:**
   - Go to "Table Editor" in Supabase
   - Should see tables: creators, creator_accounts, content, moderation_queue, etc.
   - Status should show no errors

---

## Step 4: (Optional) Seed Test Data

To populate sample data for testing:

```bash
# From backend/ directory
node scripts/seed.js
```

This creates:
- **Admin account:** admin@plxyground.local / Internet2026@
- **10 Creator accounts** (e.g., sarahjohnson@plxyground.local / Password1!)
- **3 Business accounts** (e.g., nike@plxyground.local / Password1!)
- **100+ content items** with various publication states
- **3 opportunities** listings
- **Moderation queue** entries

---

## Step 5: Verify Database Connection

Test the database connection without starting the server:

```bash
# From backend/ directory
node tools/inspect-db.js
```

Should output:
```
creators: [ { id: 1, profile_slug: 'sarah-johnson', name: 'Sarah Johnson' }, ... ]
accounts: [ { id: 1, creator_id: 1, email: '...', is_suspended: false }, ... ]
content: [ { id: 50, creator_id: 1, title: '...', is_published: true }, ... ]
```

---

## Step 6: Start the Backend Server

```bash
# From backend/ directory
npm install  # If not already done
npm start
```

Server runs on: **http://localhost:3011**

Test endpoints:
```bash
# Create account
curl -X POST http://localhost:3011/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Password1!"}'

# Login
curl -X POST http://localhost:3011/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password1!"}'

# Get creators
curl http://localhost:3011/creators
```

---

## Step 7: Admin Dashboard (Optional)

The admin panel provides web UI for management:

```bash
# From admin-panel/ directory
npm install
npm start
```

Admin URL: **http://localhost:3000**

Login with: admin@plxyground.local / Internet2026@

---

## Troubleshooting

### "No such table" errors
**Problem:** Schema wasn't created in Supabase yet
**Fix:** Run the SQL from `postgres_schema.sql` in Supabase SQL Editor (Step 3)

### "SUPABASE_SERVICE_ROLE_KEY is required" error
**Problem:** .env file is missing or incomplete
**Fix:** Update .env with your actual Supabase credentials

### "Invalid API key" error
**Problem:** Wrong credentials in .env
**Fix:** Verify Project URL and keys in Supabase Dashboard → Settings → API

### Connection timeouts
**Problem:** Network issue or Supabase project not running
**Fix:** Check Supabase Dashboard to ensure project is active; restart backend server

### Seed script fails
**Problem:** Schema not created yet
**Fix:** Complete Step 3 first (create schema in Supabase)

---

## Project Structure

```
backend/
├── src/
│   ├── db.js                 # Database initialization (now uses Supabase)
│   ├── lib/
│   │   └── supabaseClient.js # Supabase client setup (NEW)
│   ├── middleware/           # Auth, validation, rate limiting
│   ├── routes/               # All API endpoints (converted to Supabase)
│   └── services/             # Audit logging, token management
├── scripts/
│   ├── seed.js              # Populate test data (converted to Supabase)
│   └── smoke.js             # Basic smoke tests
├── tools/
│   └── inspect-db.js        # Database inspector utility (converted)
├── postgres_schema.sql       # PostgreSQL schema definition (NEW)
├── .env                      # Environment configuration
└── package.json
```

---

## Database Tables

| Table | Purpose |
|-------|---------|
| **creators** | User profiles (creators/businesses) |
| **creator_accounts** | Email/password authentication |
| **content** | Posts, videos, articles |
| **moderation_queue** | Content awaiting approval |
| **opportunities** | Business listing opportunities |
| **admins** | Admin accounts |
| **refresh_tokens** | Session token management |
| **audit_log** | Action history for compliance |
| **bulk_action_log** | Undo history for bulk operations |

---

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `PORT` | Backend server port | `3011` |
| `DB_PROVIDER` | Database type | `supabase` |
| `NODE_ENV` | Environment | `development` or `production` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side key | Anonymous public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key (SECRET!) | Use in backend only |
| `JWT_SECRET` | Session signing key | Any random string |
| `JWT_EXPIRES_IN` | Session lifetime | `7d` |
| `CORS_ORIGIN` | Allowed origins | `http://localhost:3012` |
| `LOCAL_STUB_EMAIL` | Mock email in dev | `true` for local testing |

---

## Security Notes

1. **Never commit `.env`** - Add to `.gitignore`
2. **Keep SERVICE_ROLE_KEY secret** - Only use on backend
3. **RLS policies enabled** - Database enforces access control
4. **Password hashing** - Using bcrypt (10 rounds)
5. **JWT tokens** - 7-day expiration by default
6. **Audit logging** - All admin actions logged

---

## Next Steps

1. ✅ Code migration complete
2. ⏳ **Create Supabase project** (Step 1)
3. ⏳ **Update .env with credentials** (Step 2)
4. ⏳ **Create schema in Supabase** (Step 3)
5. ⏳ **Seed test data** (Step 4 - optional)
6. ⏳ **Verify connection** (Step 5)
7. ⏳ **Start backend server** (Step 6)

---

## Support

- **Supabase Docs:** https://supabase.com/docs
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **Project:** PLXYGROUND - Full Stack Creator Platform

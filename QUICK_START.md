# Quick Start Checklist

## Pre-Flight (5 minutes)

- [ ] Read `SETUP_GUIDE.md` (in this directory)
- [ ] Have Supabase credentials ready (or create account at https://supabase.com)

## Configuration (2 minutes)

1. **Update backend/.env** with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-key
   SUPABASE_SERVICE_ROLE_KEY=your-secret-key
   ```

## Database Setup (5 minutes)

2. **Create schema in Supabase:**
   - Go to: Supabase Dashboard → SQL Editor → New Query
   - Copy all content from: `backend/postgres_schema.sql`
   - Paste into SQL editor and click "Run"
   - ✅ Should see 9 tables created

## Testing (2 minutes)

3. **Seed test data (optional but recommended):**
   ```bash
   cd backend
   node scripts/seed.js
   ```

4. **Verify connection:**
   ```bash
   cd backend
   node tools/inspect-db.js
   ```
   Should output creator, account, and content data

## Launch (1 minute)

5. **Start backend server:**
   ```bash
   cd backend
   npm start
   ```
   Server runs on: **http://localhost:3011**

## Test Endpoints (2 minutes)

```bash
# Get all creators
curl http://localhost:3011/creators

# Create new account
curl -X POST http://localhost:3011/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "Password1!"
  }'

# Login
curl -X POST http://localhost:3011/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password1!"
  }'
```

---

## Test Accounts (if you ran seed.js)

**Admin:**
- Email: `admin@plxyground.local`
- Password: `Internet2026@`

**Creator:**
- Email: `sarahjohnson@plxyground.local`
- Password: `Password1!`

**Business:**
- Email: `nike@plxyground.local`
- Password: `Password1!`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "table does not exist" | Run schema SQL in Supabase (Step 2) |
| "Invalid API key" | Check credentials in .env are correct |
| Connection timeout | Ensure Supabase project is active |
| Seed script fails | Create schema first (Step 2) |

---

## What's Done ✅

- All 12 API route files converted to Supabase
- All services and utilities updated
- PostgreSQL schema created with RLS policies
- Complete setup and migration documentation
- Test data seed script ready

## What You Need to Do ⏳

1. Create Supabase project (or use existing)
2. Get API credentials
3. Update `.env` file
4. Create schema in Supabase
5. Start backend server

**Time to full functionality: ~15 minutes**

---

**Questions?** See `SETUP_GUIDE.md` for detailed explanations

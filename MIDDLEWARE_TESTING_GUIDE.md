# Testing the Admin Middleware Protection

## Prerequisites

1. **middleware.ts** is in project root (done)
2. Running locally or deployed to Vercel
3. Supabase has admin users in the `admins` table
4. Environment variables set (.env.local for local, Vercel env for production)

---

## How the Middleware Works

```
Request to /admin/* or /api/admin/* 
    ↓
middleware.ts intercepts
    ↓
Check: Is user logged in? (Supabase session)
    ↓ No → Redirect /admin/* to /login, return 401 for /api/admin/*
    ↓ Yes
Check: Does user's email exist in admins table with is_active=true?
    ↓ No → Redirect /admin/* to /login, return 401 for /api/admin/*
    ↓ Yes
✅ Allow request through
```

---

## Test 1: curl - Test API Route Protection

### Setup: Create a test API route
Create `app/api/admin/test/route.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  return Response.json({
    message: 'You are an admin!',
    adminEmail: session?.user?.email,
  })
}
```

### Test 1A: Unauthenticated curl (expect 401)
```bash
curl -v http://localhost:3000/api/admin/test

# Expected:
# HTTP/1.1 401 Unauthorized
# {"error":"Unauthorized","message":"You must be logged in as an admin..."}
```

### Test 1B: Authenticated curl with session cookie
```bash
# 1. First, get a valid session token
#    (Log in via browser or use Supabase auth endpoint)

# 2. Copy the auth token from browser DevTools:
#    Application → Cookies → auth-token (get the value)

# 3. Replace YOUR_AUTH_TOKEN below with actual token:
curl -v \
  -H "Cookie: sb-auth-token=YOUR_AUTH_TOKEN" \
  http://localhost:3000/api/admin/test

# Expected if NOT admin:
# HTTP/1.1 401 Unauthorized
# {"error":"Unauthorized","message":"User X is not an active admin"}

# Expected if IS admin:
# HTTP/1.1 200 OK
# {"message":"You are an admin!","adminEmail":"admin@example.com"}
```

---

## Test 2: Browser - Test Page Route Protection

### Setup: Create a test admin page
Create `app/admin/test/page.tsx`:

```typescript
export default function AdminTestPage() {
  return (
    <div>
      <h1>Admin Protected Page</h1>
      <p>If you see this, you're an admin!</p>
    </div>
  )
}
```

### Test 2A: Access without login
1. Open browser (fresh session)
2. Go to: `http://localhost:3000/admin/test`
3. **Expected:** Redirected to `/login?redirectTo=/admin/test`

### Test 2B: Access as logged-in non-admin user
1. Create a test account (non-admin) in Supabase Auth
2. Log in at your `/login` page
3. Go to: `http://localhost:3000/admin/test`
4. **Expected:** Redirected to `/login?redirectTo=/admin/test`

### Test 2C: Access as logged-in admin user
1. Create admin user: Insert into `admins` table directly in Supabase
   ```sql
   INSERT INTO admins (email, password_hash, role, is_active)
   VALUES ('admin@example.com', '[any hash]', 'ADMIN', true);
   ```

2. Log in with that email at your `/login` page
3. Go to: `http://localhost:3000/admin/test`
4. **Expected:** ✅ Page loads, sees "If you see this, you're an admin!"

---

## Test 3: Integration Test with Supabase

### Create multiple test admins
```sql
-- Run in Supabase SQL Editor

-- Insert two test admins
INSERT INTO admins (email, password_hash, role, is_active)
VALUES 
  ('alice@admin.local', 'dummy_hash_1', 'ADMIN', true),
  ('bob@admin.local', 'dummy_hash_2', 'ADMIN', true);

-- Insert one inactive admin (should be blocked)
INSERT INTO admins (email, password_hash, role, is_active)
VALUES 
  ('charlie@admin.local', 'dummy_hash_3', 'ADMIN', false);

-- Verify they exist
SELECT email, is_active FROM admins WHERE email LIKE '%@admin.local';
```

### Test each user
1. **alice@admin.local (active)** → Access `/admin/test` → ✅ Allowed
2. **bob@admin.local (active)** → Access `/admin/test` → ✅ Allowed
3. **charlie@admin.local (inactive)** → Access `/admin/test` → ❌ Blocked

---

## Test 4: Check Server Logs

When middleware runs, it logs authorization failures:

### Check Next.js Dev Server Logs
```bash
npm run dev

# Output when unauthorized access is attempted:
# [Admin Auth Failed] User alice@example.com is not an active admin | Path: /api/admin/test
```

### Check Vercel Production Logs
1. Go to **Vercel Dashboard** → Project → **Logs**
2. Look for `[Admin Auth Failed]` messages
3. If you see them, middleware is working (users are being blocked)

---

## Test 5: Complete End-to-End Flow

### Scenario: Admin logs in and accesses admin dashboard

**Step 1: Admin logs in**
```bash
# Via your /login page or API
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "password"
}
# Response: Sets auth-token cookie
```

**Step 2: Request admin page**
```bash
GET /admin/dashboard
# Middleware intercepts:
#   ✅ Session exists? Yes
#   ✅ Email in admins table? Yes
#   ✅ is_active=true? Yes
# Result: Page loads ✅
```

**Step 3: Request admin API**
```bash
GET /api/admin/users
# Middleware intercepts:
#   ✅ Session exists? Yes
#   ✅ Email in admins table? Yes
#   ✅ is_active=true? Yes
# Result: Returns 200 with admin data ✅
```

---

## Test 6: Edge Cases

### Edge Case 1: Admin is deleted from admins table
```sql
DELETE FROM admins WHERE email = 'admin@example.com';
```
**Test:** Try accessing `/admin/test` while logged in
**Expected:** Middleware blocks (not in table) → Redirects to `/login`

### Edge Case 2: Admin is set to is_active=false
```sql
UPDATE admins SET is_active = false WHERE email = 'admin@example.com';
```
**Test:** Try accessing `/admin/test` while logged in
**Expected:** Middleware blocks (not active) → Redirects to `/login`

### Edge Case 3: Session expires
**Test:** Let session cookie expire, try accessing `/admin/test`
**Expected:** No session exists → Redirects to `/login`

### Edge Case 4: Wrong environment variables
**Test:** Set `SUPABASE_SERVICE_ROLE_KEY` to wrong value
**Expected:** Database query fails → Returns 401

---

## Verification Checklist

Run these tests step by step:

- [ ] **Test 1A:** curl to `/api/admin/test` without auth → 401 ✅
- [ ] **Test 1B:** curl with fake token → 401 ✅
- [ ] **Test 1B:** curl with real token but non-admin → 401 ✅
- [ ] **Test 1B:** curl with real token and admin email → 200 ✅
- [ ] **Test 2A:** Browser to `/admin/test` without login → Redirect to /login ✅
- [ ] **Test 2B:** Browser to `/admin/test` as non-admin → Redirect to /login ✅
- [ ] **Test 2C:** Browser to `/admin/test` as admin → Page loads ✅
- [ ] **Test 4:** See `[Admin Auth Failed]` in console logs ✅
- [ ] **Test 5:** Complete flow works end-to-end ✅
- [ ] **Test 6:** Edge cases blocked appropriately ✅

---

## Debugging Checklist

If middleware isn't working:

1. **Middleware not running?**
   - Verify `middleware.ts` exists in project root (NOT in `src/`)
   - Restart Next.js dev server
   - Check console for middleware errors

2. **Always redirecting?**
   - Verify session cookie is set (DevTools → Application → Cookies)
   - Verify Supabase auth is working (test with simple login page)
   - Verify user email matches exactly in admins table (case-sensitive!)

3. **Database query failing?**
   - Ensure `admins` table exists in Supabase
   - Ensure `SUPABASE_SERVICE_ROLE_KEY` env var is set correctly
   - Run this query in Supabase SQL Editor:
     ```sql
     SELECT email, is_active FROM admins LIMIT 10;
     ```

4. **CORS or cookie issues?**
   - Ensure cookies are being passed through middleware
   - Check browser DevTools → Network → check cookies in request headers
   - Verify same-site cookie settings in Supabase

5. **Middleware timeout?**
   - Database lookups can take 100-500ms
   - If timeout, increase Vercel timeout or optimize DB query
   - Check Supabase query performance in dashboard

---

## How to Push to Production (Vercel)

1. Commit middleware.ts to git
   ```bash
   git add middleware.ts
   git commit -m "Add admin route protection middleware"
   git push origin main
   ```

2. Vercel automatically detects and deploys
3. Verify environment variables are set on Vercel (SUPABASE_SERVICE_ROLE_KEY etc.)
4. Test in production preview URL
5. Run same tests with production URLs

---

## Important Notes

⚠️ **Security:**
- Middleware runs on EVERY request - it's performant
- Service role key is never exposed to client
- Admin check is done server-side, not client-side
- No way to bypass via manipulating client code

✅ **Best Practices:**
- Keep admin table in sync with your actual admins
- Rotate keys periodically in Supabase
- Monitor `/admin` and `/api/admin` access in logs
- Use `is_active` flag for soft-deleting admin privileges

🔄 **Redeployment:**
- Changes to middleware.ts require redeploy
- Changes to env vars require redeploy (use Vercel "Redeploy" button)
- Database changes (admins table) take effect immediately

# Vercel Environment Variables Configuration

## Required Variables for Next.js 14 + Supabase + Resend Stack

### Supabase Public Keys (Client-side safe)
| Key | Scope | Server-only? | Value Source | Example |
|-----|-------|---------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development | ❌ Public (client-side OK) | Supabase Dashboard → Settings → API | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development | ❌ Public (client-side OK) | Supabase Dashboard → Settings → API → Project API keys → Anon | `eyJ0eXAi...` |

### Supabase Service Role (Server-only secret)
| Key | Scope | Server-only? | Value Source | Example |
|-----|-------|---------|-------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview, Development | ✅ Server-only (critical!) | Supabase Dashboard → Settings → API → Project API keys → Service role | `eyJ0eXAi...` (long secret) |

### Resend Email Service
| Key | Scope | Server-only? | Value Source | Example |
|-----|-------|---------|-------|---------|
| `RESEND_API_KEY` | Production, Preview, Development | ✅ Server-only (API secret) | Resend Dashboard → API Keys | `re_xxxxxxxxxxxx` |

### NextAuth / Auth Secret (if using NextAuth)
| Key | Scope | Server-only? | Value Source | Example |
|-----|-------|---------|-------|---------|
| `NEXTAUTH_SECRET` | Production, Preview, Development | ✅ Server-only | Generate: `openssl rand -base64 32` | `abc123def456...` |
| `NEXTAUTH_URL` | Production, Preview, Development | ❌ Can be public | Your app URL | `https://yourdomain.com` (prod) or `undefined` (preview auto) |

### Optional: Monitoring & Analytics
| Key | Scope | Server-only? | Value Source | Example |
|-----|-------|---------|-------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | Production, Preview, Development | ❌ Public (client-side OK) | Sentry Dashboard (if using) | `https://xxx@xxx.ingest.sentry.io/123` |

---

## Step-by-Step Setup Instructions

### 1. Get Your Supabase Credentials
1. Go to **Supabase Dashboard** → Your project
2. Click **Settings** (⚙️ icon)
3. Click **API**
4. Copy:
   - **Project URL** → put in `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon public key** (under "Project API keys") → put in `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service role key** (marked "secret", under "Project API keys") → put in `SUPABASE_SERVICE_ROLE_KEY`

### 2. Get Your Resend API Key
1. Go to **Resend Dashboard** (https://resend.com)
2. Click **API Keys**
3. Copy the API key → put in `RESEND_API_KEY`

### 3. Generate NEXTAUTH_SECRET (if using NextAuth)
Run in terminal:
```bash
openssl rand -base64 32
```
Copy output → put in `NEXTAUTH_SECRET`

### 4. Add Variables to Vercel
1. Go to **Vercel Dashboard** → Your project
2. Click **Settings**
3. Click **Environment Variables**
4. Add these **exactly** as shown:

#### Add Public Variables (client-side safe):
```
NEXT_PUBLIC_SUPABASE_URL        [your value]      ☑️ Production  ☑️ Preview  ☑️ Development
NEXT_PUBLIC_SUPABASE_ANON_KEY   [your value]      ☑️ Production  ☑️ Preview  ☑️ Development
NEXTAUTH_URL                    [your value]      ☑️ Production  ☑️ Preview  ☑️ Development
```

#### Add Secret Variables (server-only):
```
SUPABASE_SERVICE_ROLE_KEY       [your value]      ☑️ Production  ☑️ Preview  ☑️ Development
RESEND_API_KEY                  [your value]      ☑️ Production  ☑️ Preview  ☑️ Development
NEXTAUTH_SECRET                 [your value]      ☑️ Production  ☑️ Preview  ☑️ Development
```

---

## Verification Checklist

After adding all variables:

✅ All 6 variables added to Vercel
✅ Public variables (`NEXT_PUBLIC_*`) visible in browser DevTools → Application → Environment
✅ Secret variables NOT visible in client-side code
✅ Each variable set for Production + Preview + Development scopes

---

## Triggering Redeployment

After saving environment variables, you have **TWO options**:

### Option A: Automatic Redeployment (Recommended)
1. Go to **Vercel Dashboard** → Your project → **Deployments**
2. Find the latest deployment
3. Click the **three dots** (⋯) menu
4. Click **Redeploy**
5. Vercel will redeploy with new variables

### Option B: Manual Git Push
```bash
git commit --allow-empty -m "trigger redeploy with new env vars"
git push origin main
```

### Option C: Verify via Vercel CLI
```bash
vercel env ls
```
This lists all variables (secrets shown as masked)

---

## Testing Environment Variables Are Loaded

After redeployment, test in your Next.js app:

### In a Server Component (safe to log):
```typescript
// app/debug/page.tsx
export default function DebugPage() {
  return (
    <div>
      <p>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
      <p>Anon Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20)}...</p>
      {/* Service role key never logged - server-only */}
    </div>
  )
}
```

### In a Server Action:
```typescript
// app/actions.ts
'use server'

export async function checkEnv() {
  return {
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY, // ✅ exists on server
    resendKey: !!process.env.RESEND_API_KEY,                      // ✅ exists on server
  }
}
```

---

## Important Security Notes

⚠️ **DO NOT:**
- Commit `.env.local` to git
- Log `SUPABASE_SERVICE_ROLE_KEY` anywhere
- Put `RESEND_API_KEY` in client components
- Expose `NEXTAUTH_SECRET` to frontend

✅ **DO:**
- Use `NEXT_PUBLIC_*` for client-side Supabase operations
- Use `SUPABASE_SERVICE_ROLE_KEY` only in server actions/API routes
- Store secrets in Vercel Environment Variables, not `.env` files
- Rotate keys periodically in Supabase/Resend dashboards

---

## Summary Table

| Variable | Public? | Where It's Used | Must Set? |
|----------|---------|-----------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Client browser, middleware | ✅ Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Client browser | ✅ Required |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ No | Server actions, API routes | ✅ Required |
| `RESEND_API_KEY` | ❌ No | API route for emails | ✅ Required |
| `NEXTAUTH_SECRET` | ❌ No | NextAuth session signing | ⚠️ If using NextAuth |
| `NEXTAUTH_URL` | ✅ Yes | NextAuth redirect | ⚠️ If using NextAuth |

**All public variables must be prefixed with `NEXT_PUBLIC_`**
**All secrets should NOT have this prefix**

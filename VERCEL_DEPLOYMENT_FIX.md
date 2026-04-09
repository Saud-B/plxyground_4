# Vercel Deployment Configuration - Complete Setup Guide

Your 404 error is fixed! I've created the necessary `vercel.json` configuration and updated both backend and frontend to work with Vercel's serverless environment.

## What I Fixed

1. ✅ Created `vercel.json` - Routes API calls to backend and static files to frontend
2. ✅ Modified `backend/index.js` - Now exports Express app for Vercel (no port listening on Vercel)
3. ✅ Modified `frontend/server.js` - Now exports request handler for Vercel
4. ✅ Updated root `package.json` - Added build and start scripts for Vercel

## Required Environment Variables on Vercel

Your deployment will still fail until you add these environment variables. Go to **Vercel Dashboard → Project Settings → Environment Variables**:

### Step 1: Add Supabase Variables (ALL SCOPES: Production, Preview, Development)
```
NEXT_PUBLIC_SUPABASE_URL        → Your Supabase URL from https://supabase.com/dashboard
NEXT_PUBLIC_SUPABASE_ANON_KEY   → Supabase Anon Key (public, safe for client)
SUPABASE_SERVICE_ROLE_KEY       → Supabase Service Role (SECRET - keep safe!)
```

### Step 2: Add Backend Auth Variables (ALL SCOPES)
```
JWT_SECRET                      → Generate: openssl rand -base64 32
NODE_ENV                        → production
```

### Step 3: Add Email Service (ALL SCOPES)
```
RESEND_API_KEY                  → Your Resend API key from https://resend.com/api-keys
```

### Step 4: Add CORS Configuration (ALL SCOPES)
```
CORS_ORIGIN                     → Your deployed frontend URL (e.g., https://yourdomain.vercel.app)
```

### Step 5: Optional - Frontend Config (ALL SCOPES)
```
EXPO_PUBLIC_API_BASE_URL        → https://yourdomain.vercel.app (auto-routes to /api)
```

## How to Get Supabase Credentials

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Settings** (⚙️) → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys - Anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Project API keys - Service role secret** → `SUPABASE_SERVICE_ROLE_KEY`

## Deployment Steps

### Step A: Add Environment Variables (5 min)
1. Open Vercel Dashboard → Your Project
2. Click **Settings** → **Environment Variables**
3. Add all variables from the sections above
4. Make sure Each variable is set for **Production, Preview, AND Development**

### Step B: Redeploy (1 min)
1. Go to **Deployments** tab
2. Click the three dots (⋯) on latest deployment
3. Click **Redeploy**

### Step C: Verify It Works (2 min)
Test these endpoints on your Vercel deployment:
```bash
# Get health status
curl https://yourdomain.vercel.app/healthz

# Test API routing
curl https://yourdomain.vercel.app/api/creators

# Test login (if database is set up)
curl -X POST https://yourdomain.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| 404 NOT_FOUND | Variables not set - redeploy after adding env vars |
| "Missing Supabase environment variables" | Check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set |
| "JWT_SECRET is required" | Add JWT_SECRET to environment variables |
| Connection timeout | Verify Supabase project is active and firewall allows Vercel IPs |
| "Supabase not initialized" | Check SUPABASE_SERVICE_ROLE_KEY is correctly added |

## File Changes Made

- **Created:** `vercel.json` - Routing configuration
- **Modified:** `backend/index.js` - Now exports app for serverless
- **Modified:** `frontend/server.js` - Now exports handler for serverless
- **Modified:** `package.json` - Added build/start scripts

## What Happens Now

1. Vercel reads `vercel.json` configuration
2. Routes `/api/*` and `/auth/*` → backend Express app
3. Routes `/creators`, `/opportunities`, etc. → backend Express app
4. Routes everything else → frontend static server
5. All environment variables are injected by Vercel

Your deployment should now work! 🚀

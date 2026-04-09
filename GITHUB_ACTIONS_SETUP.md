# GitHub Actions - Vercel Auto-Deployment Setup

Your project now has automated deployment! Here's how to enable it.

## Step 1: Get Vercel Secrets

Go to **Vercel Dashboard** and get these three values:

### 1a. VERCEL_TOKEN (API Token)
1. Go to Vercel Dashboard → **Settings** → **Tokens**
2. Click **Create** (use type "Full Access" or "Read/Write")
3. Copy the token
4. Note: Keep this PRIVATE - it's your API key

### 1b. VERCEL_ORG_ID (Organization ID)
1. Go to Vercel Dashboard → **Settings** → **General**
2. Look for **Team ID** or **Organization ID**
3. Copy it

### 1c. VERCEL_PROJECT_ID (Project ID)
1. Go to Vercel Dashboard → **Project Settings**
2. Look for **Project ID** at the bottom
3. Copy it

## Step 2: Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Security** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add these THREE secrets:

   - Name: `VERCEL_TOKEN` → Paste your Vercel token
   - Name: `VERCEL_ORG_ID` → Paste your Organization ID
   - Name: `VERCEL_PROJECT_ID` → Paste your Project ID

4. Click **Add secret** for each one

## Step 3: Verify Environment Variables in Vercel

Make sure ALL these are still set in Vercel project settings:
```
NEXT_PUBLIC_SUPABASE_URL          ✓
NEXT_PUBLIC_SUPABASE_ANON_KEY     ✓
SUPABASE_SERVICE_ROLE_KEY         ✓
JWT_SECRET                        ✓
NODE_ENV                          = production
CORS_ORIGIN                       = https://yourdomain.vercel.app
RESEND_API_KEY                    ✓
```

## Step 4: Test the Workflow

1. Make a small change to your code (e.g., update README.md)
2. Commit and push to `main` branch:
   ```bash
   git add .
   git commit -m "Test deployment workflow"
   git push origin main
   ```
3. Go to GitHub → Your repo → **Actions** tab
4. Watch the workflow run
5. When it succeeds, your app will auto-deploy to Vercel!

## What the Workflow Does

✅ Triggers on: Push to `main` branch or manual trigger (workflow_dispatch)
✅ Installs: Node dependencies for root, backend, and frontend
✅ Verifies: Project structure (routes, public files)
✅ Deploys: To Vercel production using your secrets
✅ Reports: Deployment status

## Manual Trigger (Optional)

You can also manually trigger deployment without pushing:
1. Go to GitHub → **Actions** tab
2. Click **Deploy to Vercel** workflow on the left
3. Click **Run workflow** → **Run workflow**

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Deployment fails with 404 | Make sure all Vercel env vars are set |
| "VERCEL_TOKEN not found" | Check GitHub Secrets are added correctly |
| "Build failed" | Check logs in GitHub Actions tab → click failed job |
| Deployment successful but still seeing old site | Hard refresh: Ctrl+Shift+R |

## File Created

- `.github/workflows/deploy.yml` - Auto-deployment workflow

Now every time you push to `main`, your changes will automatically deploy to Vercel! 🚀

# Testing Resend Email Integration

## Files Created

1. **lib/email.server.ts** - Server-side Resend client and email functions
2. **app/api/test-email/route.ts** - API endpoint to test email sending

## Prerequisites

1. **Resend Account** - Sign up at https://resend.com
2. **API Key** - Get from Resend Dashboard → API Keys
3. **Environment Variable Set** - `RESEND_API_KEY` in `.env.local` (local) or Vercel (production)
4. **Next.js Server Running** - `npm run dev`

---

## Test 1: GET Request - Check Configuration

### Test endpoint documentation is available

```bash
curl http://localhost:3000/api/test-email
```

**Expected Response (200 OK):**
```json
{
  "endpoint": "/api/test-email",
  "methods": {
    "GET": "Returns this documentation",
    "POST": "Sends a test email"
  },
  "configuration": {
    "resendKeyConfigured": true,
    "supabaseConfigured": true
  },
  "postRequestBody": {
    "to": "email@example.com (required)",
    "subject": "Test email (optional)",
    "html": "<p>HTML content</p> (optional)"
  },
  "postResponseOnSuccess": {
    "success": true,
    "messageId": "string (Resend ID)",
    "message": "string (confirmation message)",
    "timestampUtc": "string (ISO timestamp)"
  }
}
```

If `resendKeyConfigured: false`, you need to set `RESEND_API_KEY` environment variable.

---

## Test 2: POST Request - Send Test Email (Default)

### Send to default email (saudb8961@gmail.com) with default subject and template

```bash
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "messageId": "1234567890abcdef",
  "message": "Email sent successfully to saudb8961@gmail.com",
  "timestampUtc": "2024-03-30T12:34:56.789Z"
}
```

### Verify in Inbox
- **Recipient:** saudb8961@gmail.com
- **Subject:** "Test email"
- **Content:** Beautiful HTML template with test details

---

## Test 3: POST Request - Custom Email Address

### Send to your own email with custom subject

```bash
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "subject": "Custom Test Subject"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "messageId": "xyz789abc123",
  "message": "Email sent successfully to your-email@example.com",
  "timestampUtc": "2024-03-30T12:35:00.000Z"
}
```

### Verify in Inbox
- Check for email from "noreply@yourdomain.com" (customize in lib/email.server.ts)
- Subject should match what you sent

---

## Test 4: POST Request - Custom HTML Email

### Send with custom HTML content

```bash
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "saudb8961@gmail.com",
    "subject": "Welcome to My App",
    "html": "<h1>Welcome!</h1><p>This is a custom HTML email.</p><p><a href=\"https://example.com\">Click here</a></p>"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "messageId": "msg_abc123xyz789",
  "message": "Email sent successfully to saudb8961@gmail.com",
  "timestampUtc": "2024-03-30T12:36:00.000Z"
}
```

---

## Test 5: POST Request - Error Cases

### Invalid email address
```bash
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "not-an-email"}'

# Expected Response (400 Bad Request):
# {"success": false, "error": "Invalid email address: not-an-email"}
```

### Missing RESEND_API_KEY environment variable
```bash
# Unset the key first:
# In .env.local, comment out: RESEND_API_KEY=...
# Or delete from Vercel environment variables

curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "saudb8961@gmail.com"}'

# Expected Response (500 Error):
# {"success": false, "error": "RESEND_API_KEY is not configured in environment variables"}
```

### Invalid Resend API key
```bash
# Set RESEND_API_KEY to invalid value in .env.local:
# RESEND_API_KEY=invalid_key_123

curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "saudb8961@gmail.com"}'

# Expected Response (500 Error):
# {"success": false, "error": "Unauthorized"}
```

---

## Test 6: JavaScript/TypeScript Client Test

Create a test file: `test-email.mjs`

```javascript
// Run with: node test-email.mjs

async function testEmail() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'

  console.log(`Testing Resend email integration at ${baseUrl}`)
  console.log('---')

  // Test 1: Check configuration
  console.log('\n[Test 1] GET /api/test-email (check config)')
  const configRes = await fetch(`${baseUrl}/api/test-email`)
  const config = await configRes.json()
  console.log('✓ Configuration:', config.configuration)

  // Test 2: Send default email
  console.log('\n[Test 2] POST /api/test-email (default)')
  const sendRes = await fetch(`${baseUrl}/api/test-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const result = await sendRes.json()
  if (result.success) {
    console.log('✓ Email sent!')
    console.log(`  Message ID: ${result.messageId}`)
    console.log(`  Recipient: saudb8961@gmail.com`)
  } else {
    console.log('✗ Failed:', result.error)
  }

  // Test 3: Send custom email
  console.log('\n[Test 3] POST /api/test-email (custom)')
  const customRes = await fetch(`${baseUrl}/api/test-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: 'saudb8961@gmail.com',
      subject: 'JavaScript Test Email',
      html: '<h1>Test from JavaScript</h1><p>This email was sent via Node.js</p>',
    }),
  })
  const customResult = await customRes.json()
  if (customResult.success) {
    console.log('✓ Custom email sent!')
    console.log(`  Message ID: ${customResult.messageId}`)
  } else {
    console.log('✗ Failed:', customResult.error)
  }

  console.log('\n---')
  console.log('Check your inbox for test emails!')
}

testEmail().catch(console.error)
```

Run it:
```bash
node test-email.mjs

# Or for production URL:
BASE_URL=https://yourdomain.vercel.app node test-email.mjs
```

---

## Test 7: Inside Next.js Server Component/Action

### Test in a Server Action

Create `app/actions/test-email.ts`:

```typescript
'use server'

import { sendEmail, sendWelcomeEmail } from '@/lib/email.server'

export async function testSendEmail(email: string) {
  const result = await sendEmail({
    to: email,
    subject: 'Server Action Test',
    html: '<h1>Test from Server Action</h1><p>This proves Resend works!</p>',
  })
  return result
}

export async function testWelcomeEmail(email: string, name: string) {
  const result = await sendWelcomeEmail(email, name)
  return result
}
```

Create a test page `app/test-email-page/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { testSendEmail, testWelcomeEmail } from '@/app/actions/test-email'

export default function TestEmailPage() {
  const [email, setEmail] = useState('saudb8961@gmail.com')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleSendEmail = async () => {
    setLoading(true)
    try {
      const res = await testSendEmail(email)
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  const handleSendWelcome = async () => {
    setLoading(true)
    try {
      const res = await testWelcomeEmail(email, 'Test User')
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Resend Email Test</h1>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter email"
        style={{ padding: '8px', width: '300px' }}
      />
      <div style={{ marginTop: '10px' }}>
        <button onClick={handleSendEmail} disabled={loading}>
          Send Test Email
        </button>
        <button onClick={handleSendWelcome} disabled={loading} style={{ marginLeft: '10px' }}>
          Send Welcome Email
        </button>
      </div>
      {result && (
        <pre style={{ marginTop: '20px', background: '#f0f0f0', padding: '10px' }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}
```

Visit: `http://localhost:3000/test-email-page`

---

## Test 8: Monitor Email in Resend Dashboard

1. Go to **Resend Dashboard** → https://resend.com
2. Click **Emails** tab
3. See all sent emails with:
   - Recipient email
   - Subject line
   - Timestamp
   - Status (Sent, Delivered, Opened, etc.)
   - Message ID

---

## Verification Checklist

- [ ] **Test 1:** GET returns configuration with `resendKeyConfigured: true`
- [ ] **Test 2:** Email arrives at saudb8961@gmail.com with default template
- [ ] **Test 3:** Custom recipient receives email successfully
- [ ] **Test 4:** Custom HTML renders correctly in inbox
- [ ] **Test 5:** Invalid email returns 400 error
- [ ] **Test 5:** Missing API key returns 500 error
- [ ] **Test 6:** Node.js script sends emails successfully
- [ ] **Test 7:** Server action sends email from browser
- [ ] **Test 8:** All emails visible in Resend Dashboard
- [ ] **Resend Dashboard:** Shows delivery status and opens

---

## Important Notes

### Email From Address
The default "from" address in `lib/email.server.ts` is:
```typescript
from: payload.from || 'noreply@yourdomain.com'
```

**Update `yourdomain.com` to your actual domain** to avoid:
- Emails going to spam
- Authentication failures
- Sender verification errors

### To Verify Your Domain:
1. In Resend Dashboard → Domains
2. Add your domain
3. Follow verification instructions (DNS records)
4. Once verified, update `from` address in `lib/email.server.ts`

### Production Deployment
1. Set `RESEND_API_KEY` in Vercel environment variables
2. Redeploy: `git push` or click Vercel "Redeploy" button
3. Test in production URL: `https://yourdomain.vercel.app/api/test-email`
4. Same curl commands work, just change `http://localhost:3000`

### Security
- `RESEND_API_KEY` is server-only (never in client code)
- `lib/email.server.ts` file is server-only
- Client components can call API route with POST
- No email logic exposed to the browser

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "RESEND_API_KEY not configured" | Check `.env.local` has correct key |
| Email goes to spam | Verify domain in Resend, update sender |
| 401/403 error | Wrong Resend API key, regenerate in Resend Dashboard |
| Email doesn't arrive | Check spam folder, verify recipient email |
| No message ID returned | Check Resend API status at status.resend.com |
| Timeout error | Check network, Resend API might be slow |

---

## Example Use Cases

### 1. Send Welcome Email After Sign-up
```typescript
import { sendWelcomeEmail } from '@/lib/email.server'

export async function registerUser(email: string, name: string) {
  // Create user in Supabase...
  
  // Send welcome email
  const emailResult = await sendWelcomeEmail(email, name)
  return emailResult.success
}
```

### 2. Send Password Reset Link
```typescript
import { sendPasswordResetEmail } from '@/lib/email.server'

export async function requestPasswordReset(email: string) {
  const resetToken = generateToken()
  const resetLink = `https://yourapp.com/reset-password?token=${resetToken}`
  
  await sendPasswordResetEmail(email, resetLink)
  return { success: true }
}
```

### 3. Notify Admin of Important Event
```typescript
import { sendAdminNotification } from '@/lib/email.server'

export async function contentReported(contentId: string, reason: string) {
  await sendAdminNotification(
    'admin@yourapp.com',
    'Content Reported',
    `Content #${contentId} reported for: ${reason}`
  )
}
```

---

## Next Steps

1. ✅ **Files created** - `lib/email.server.ts` and `app/api/test-email/route.ts`
2. ✅ **Test locally** - Run all tests above
3. ✅ **Verify configuration** - Check Resend Dashboard
4. ✅ **Deploy to Vercel** - Push to main branch
5. ✅ **Test production** - Use same curl commands with Vercel URL
6. ⏳ **Integrate emails** - Add sendEmail calls to your auth, form, and notification flows

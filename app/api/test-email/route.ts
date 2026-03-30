import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email.server'

/**
 * POST /api/test-email
 * Test endpoint for Resend email integration
 *
 * Request body:
 * {
 *   "to": "email@example.com",
 *   "subject": "Test message (optional, defaults to 'Test email')",
 *   "html": "<p>HTML content (optional, defaults to simple template)</p>"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()

    // Extract parameters with defaults
    const to = body.to || 'saudb8961@gmail.com' // Default test email
    const subject = body.subject || 'Test email'
    const html =
      body.html ||
      `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #0066cc; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .footer { color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Test Email from PLXYGROUND</h1>
            </div>
            <div class="content">
              <p>Hello!</p>
              <p>This is a test email to verify Resend integration is working correctly.</p>
              <p><strong>Test Details:</strong></p>
              <ul>
                <li>Recipient: ${to}</li>
                <li>Timestamp: ${new Date().toISOString()}</li>
                <li>Service: Resend</li>
              </ul>
              <p>If you received this email, Resend is properly configured! ✅</p>
            </div>
            <div class="footer">
              <p>This was a test email. No action required.</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Validate email address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid email address: ${to}`,
        },
        { status: 400 }
      )
    }

    // Send the email
    const result = await sendEmail({
      to,
      subject,
      html,
    })

    // Return response
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        messageId: result.id,
        message: `Email sent successfully to ${to}`,
        timestampUtc: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Test email route error:', errorMessage)
    return NextResponse.json(
      {
        success: false,
        error: `Internal server error: ${errorMessage}`,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/test-email
 * Returns API documentation and current configuration status
 */
export async function GET(request: NextRequest) {
  const hasResendKey = !!process.env.RESEND_API_KEY

  return NextResponse.json(
    {
      endpoint: '/api/test-email',
      methods: {
        GET: 'Returns this documentation',
        POST: 'Sends a test email',
      },
      configuration: {
        resendKeyConfigured: hasResendKey,
        supabaseConfigured:
          !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
          !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      postRequestBody: {
        to: 'email@example.com (required)',
        subject: 'Test email (optional)',
        html: '<p>HTML content</p> (optional)',
      },
      postResponseOnSuccess: {
        success: true,
        messageId: 'string (Resend ID)',
        message: 'string (confirmation message)',
        timestampUtc: 'string (ISO timestamp)',
      },
      postResponseOnError: {
        success: false,
        error: 'string (error description)',
      },
      examples: {
        curlLocalhost: `curl -X POST http://localhost:3000/api/test-email \\
  -H "Content-Type: application/json" \\
  -d '{"to":"saudb8961@gmail.com","subject":"Test email"}'`,
        jsClient: `const res = await fetch('/api/test-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: 'user@example.com' })
});
const data = await res.json();
console.log(data);`,
      },
    },
    { status: 200 }
  )
}

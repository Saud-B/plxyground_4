import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email.server';

export async function GET(request: NextRequest) {
  const resendConfigured = !!process.env.RESEND_API_KEY;
  const supabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return NextResponse.json({
    endpoint: '/api/test-email',
    methods: ['GET', 'POST'],
    description: 'Test endpoint for email integration. GET returns this documentation, POST sends a test email.',
    configuration: {
      resendKeyConfigured,
      supabaseConfigured,
    },
    requestBody: {
      to: 'test@example.com (optional, defaults to saudb8961@gmail.com)',
      subject: 'Test Subject (optional, defaults to "Test email")',
      html: 'HTML content (optional, defaults to beautiful template)',
    },
    successResponse: {
      success: true,
      messageId: 'uuid-string',
      message: 'Email sent successfully to email@example.com',
      timestampUtc: '2024-03-30T14:00:00Z',
    },
    errorResponse: {
      success: false,
      error: 'error description',
    },
    examples: {
      curl_get: 'curl http://localhost:3000/api/test-email',
      curl_post_default: `curl -X POST http://localhost:3000/api/test-email`,
      curl_post_custom: `curl -X POST http://localhost:3000/api/test-email -d '{"to":"user@example.com","subject":"Custom","html":"<p>Test</p>"}' -H 'Content-Type: application/json'`,
      javascript: `
        const response = await fetch('/api/test-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: 'user@example.com' })
        });
        const data = await response.json();
        console.log(data);
      `,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    const to = body.to || 'saudb8961@gmail.com';
    const subject = body.subject || 'Test email';
    const html = body.html || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1>Test Email from PLXYGROUND</h1>
        <p>This is a test email to verify Resend integration is working correctly.</p>
        <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Test Information:</strong></p>
          <p>Timestamp: ${new Date().toISOString()}</p>
          <p>Environment: ${process.env.NODE_ENV || 'development'}</p>
        </div>
        <p>If you received this email, Resend is working correctly!</p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated test email. Please do not reply.
        </p>
      </div>
    `;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { success: false, error: `Invalid email format: ${to}` },
        { status: 400 }
      );
    }

    // Send email
    const result = await sendEmail({
      to: [to],
      subject,
      html,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.id,
      message: `Email sent successfully to ${to}`,
      timestampUtc: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

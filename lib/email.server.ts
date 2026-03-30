import { Resend } from 'resend'

/**
 * Initialize Resend client with API key from environment variables
 * This is server-side only - never imported in client components
 */
const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
  text?: string
}

export interface EmailResponse {
  success: boolean
  id?: string
  error?: string
}

/**
 * Send email using Resend
 * All parameters are strictly typed for safety
 *
 * @example
 * const result = await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 *   html: '<h1>Hello</h1>'
 * })
 * if (result.success) {
 *   console.log('Email sent:', result.id)
 * } else {
 *   console.error('Email failed:', result.error)
 * }
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResponse> {
  try {
    // Validate inputs
    if (!payload.to || !payload.subject || !payload.html) {
      return {
        success: false,
        error: 'Missing required fields: to, subject, html',
      }
    }

    // Validate email format (basic check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to]
    for (const recipient of recipients) {
      if (!emailRegex.test(recipient)) {
        return {
          success: false,
          error: `Invalid email address: ${recipient}`,
        }
      }
    }

    // Check if API key is configured
    if (!process.env.RESEND_API_KEY) {
      return {
        success: false,
        error: 'RESEND_API_KEY is not configured in environment variables',
      }
    }

    // Send email via Resend
    const response = await resend.emails.send({
      from: payload.from || 'noreply@yourdomain.com', // Change to your domain
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      ...(payload.replyTo && { reply_to: payload.replyTo }),
      ...(payload.text && { text: payload.text }),
    })

    // Handle response
    if (response.error) {
      console.error('Resend API error:', response.error)
      return {
        success: false,
        error: response.error.message || 'Failed to send email',
      }
    }

    if (!response.data?.id) {
      return {
        success: false,
        error: 'No message ID returned from Resend',
      }
    }

    // Success
    console.log(`Email sent successfully [ID: ${response.data.id}] to ${payload.to}`)
    return {
      success: true,
      id: response.data.id,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Email sending error:', errorMessage)
    return {
      success: false,
      error: `Error sending email: ${errorMessage}`,
    }
  }
}

/**
 * Helper: Send welcome email to new user
 */
export async function sendWelcomeEmail(
  email: string,
  userName: string
): Promise<EmailResponse> {
  return sendEmail({
    to: email,
    subject: `Welcome, ${userName}!`,
    html: `
      <h1>Welcome to PLXYGROUND</h1>
      <p>Hi ${userName},</p>
      <p>Thanks for joining us! We're excited to have you.</p>
      <p><a href="https://yourapp.com/dashboard">Go to Dashboard</a></p>
    `,
  })
}

/**
 * Helper: Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetLink: string
): Promise<EmailResponse> {
  return sendEmail({
    to: email,
    subject: 'Reset your password',
    html: `
      <h1>Password Reset</h1>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetLink}">Reset Password</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, ignore this email.</p>
    `,
  })
}

/**
 * Helper: Send admin notification
 */
export async function sendAdminNotification(
  adminEmail: string,
  title: string,
  message: string
): Promise<EmailResponse> {
  return sendEmail({
    to: adminEmail,
    subject: `[Admin Alert] ${title}`,
    html: `
      <h2>${title}</h2>
      <p>${message}</p>
      <p><a href="https://yourapp.com/admin">Go to Admin Panel</a></p>
    `,
  })
}

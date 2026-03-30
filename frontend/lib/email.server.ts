'use server';

import { Resend } from 'resend';

export interface EmailPayload {
  to: string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  text?: string;
}

export interface EmailResponse {
  success: boolean;
  id?: string;
  error?: string;
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(payload: EmailPayload): Promise<EmailResponse> {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!payload.to || !Array.isArray(payload.to) || payload.to.length === 0) {
    return { success: false, error: 'valid recipient email required' };
  }

  for (const email of payload.to) {
    if (!emailRegex.test(email)) {
      return { success: false, error: `invalid email format: ${email}` };
    }
  }

  if (!payload.subject || !payload.html) {
    return { success: false, error: 'subject and html required' };
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const result = await resend.emails.send({
      from: payload.from || 'noreply@plxyground.com',
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      replyTo: payload.replyTo,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return {
      success: true,
      id: result.data?.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

export async function sendWelcomeEmail(email: string, name: string): Promise<EmailResponse> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Welcome to PLXYGROUND, ${name}!</h1>
      <p>We're thrilled to have you join our creator community.</p>
      <p>You can now:</p>
      <ul>
        <li>Upload and share your content</li>
        <li>Connect with other creators</li>
        <li>Discover new opportunities</li>
      </ul>
      <p>Get started: <a href="https://plxyground.com/dashboard">Go to Dashboard</a></p>
      <p>Questions? Contact us at support@plxyground.com</p>
    </div>
  `;

  return sendEmail({
    to: [email],
    subject: 'Welcome to PLXYGROUND',
    html,
  });
}

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<EmailResponse> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Password Reset Request</h1>
      <p>You requested a password reset for your PLXYGROUND account.</p>
      <p><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
      <p>This link expires in 24 hours.</p>
      <p>If you didn't request this, ignore this email.</p>
    </div>
  `;

  return sendEmail({
    to: [email],
    subject: 'Reset Your PLXYGROUND Password',
    html,
  });
}

export async function sendAdminNotification(
  email: string,
  title: string,
  message: string
): Promise<EmailResponse> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${title}</h2>
      <p>${message}</p>
      <p>View in admin panel: <a href="https://plxyground.com/admin">Admin Dashboard</a></p>
    </div>
  `;

  return sendEmail({
    to: [email],
    subject: `[Admin] ${title}`,
    html,
  });
}

const express = require('express');
const { sendEmail } = require('../services/email');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Test email endpoint
router.post('/test', verifyToken, async (req, res, next) => {
  try {
    const to = req.body.to || 'saudb8961@gmail.com';
    const subject = req.body.subject || 'Test email';
    const html = req.body.html || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1>Test Email from PLXYGROUND</h1>
        <p>This is a test email to verify email integration is working correctly.</p>
        <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Test Information:</strong></p>
          <p>Timestamp: ${new Date().toISOString()}</p>
          <p>Environment: ${process.env.NODE_ENV || 'development'}</p>
          <p>Provider: ${process.env.EMAIL_PROVIDER || 'resend'}</p>
        </div>
        <p>If you received this email, email integration is working correctly!</p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated test email. Please do not reply.
        </p>
      </div>
    `;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ success: false, error: `Invalid email format: ${to}` });
    }

    // Send email
    const result = await sendEmail({ to, subject, html });

    return res.json({
      success: true,
      message: `Email sent to ${to}`,
      to,
      subject,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

async function sendEmail({ to, subject, html, text }) {
  const localStub = String(process.env.LOCAL_STUB_EMAIL || 'true').toLowerCase() === 'true';
  if (localStub) {
    console.log(`[LOCAL_STUB_EMAIL] to=${to} subject="${subject}" text="${text || ''}"`);
    return { stub: true };
  }

  const provider = String(process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
  if (provider !== 'resend') {
    throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error('RESEND_API_KEY and EMAIL_FROM are required when LOCAL_STUB_EMAIL=false');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Email send failed (${response.status}): ${body}`);
  }
  return { stub: false };
}

module.exports = {
  sendEmail,
};

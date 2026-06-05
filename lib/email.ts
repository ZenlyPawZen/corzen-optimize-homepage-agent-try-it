import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.RESEND_FROM ?? 'CorZen <no-reply@corzenhub.com>';

export async function sendMagicLink(email: string, sessionId: string): Promise<void> {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const link = `${appUrl}/activate?s=${sessionId}`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: 'Your Homepage Audit demo is ready',
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#FAF5EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF5EE;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#0F172A;padding:28px 40px;text-align:center;">
            <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">CorZen</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0F172A;line-height:1.3;">
              Your demo is ready
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              Click the button below to start your Homepage Audit session.
              This link is personal to <strong>${email}</strong> and expires in 48 hours.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:12px;background:#1B56D6;">
                  <a href="${link}"
                     style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">
                    Start My Audit →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:28px 0 0;font-size:13px;color:#6B7280;line-height:1.6;">
              Button not working? Paste this URL into your browser:<br />
              <a href="${link}" style="color:#1B56D6;word-break:break-all;">${link}</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #F1F5F9;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">
              If you didn&rsquo;t request this, you can safely ignore this email.
              &copy; CorZen &mdash; Zenly
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim(),
  });
}

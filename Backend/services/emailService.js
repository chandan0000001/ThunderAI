import nodemailer from 'nodemailer';

/**
 * Creates and returns the nodemailer transporter using configured SMTP (defaults to Gmail).
 */
const getTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    return null;
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: user.trim(),
      pass: pass.trim().replace(/\s+/g, ''), // Strip spaces from Google App Password
    },
    // VULN-05: Strict TLS verification enabled (MITM protection)
    tls: {
      rejectUnauthorized: true,
    },
    // Fast 5-second timeouts so Render firewall drops don't freeze the process for 2 minutes
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });
};

/**
 * Sends OTP email via Resend HTTP REST API (over HTTPS Port 443, never blocked by Render).
 */
const sendViaResend = async (email, otp, name = 'User') => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const senderEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const senderName = process.env.RESEND_FROM_NAME || 'Thunder AI';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${senderName} <${senderEmail}>`,
      to: [email],
      subject: `⚡ Your Thunder AI Verification Code is ${otp}`,
      html: getEmailHtml(otp, name),
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Resend API error status ${response.status}`);
  }

  console.log(`✅ [EmailService] Verification OTP successfully sent to ${email} via Resend API (ID: ${data.id})`);
  return true;
};

/**
 * Verifies email service configuration during server startup and logs diagnostic info.
 */
export const verifyEmailConfiguration = async () => {
  if (process.env.RESEND_API_KEY) {
    console.log('✅ [EmailService] Resend API configured (HTTPS Port 443 - Fully supported on Render Free Tier)');
    return true;
  }

  const transporter = getTransporter();

  if (!transporter) {
    console.warn('\n⚠️  [EmailService] Neither RESEND_API_KEY nor Gmail credentials configured in Environment.');
    console.warn('👉 On Render Free tier, outbound SMTP (465/587) is blocked by firewall.');
    console.warn('👉 Add RESEND_API_KEY in Render Environment for 100% free delivery over HTTPS (port 443).\n');
    return false;
  }

  try {
    await transporter.verify();
    console.log(`✅ [EmailService] Gmail SMTP successfully connected as: ${process.env.EMAIL_USER}`);
    return true;
  } catch (err) {
    console.warn(`\n⚠️  [EmailService] Gmail SMTP connection failed:`, err.message);
    console.warn(`💡 Reason: Render Free Tier firewall blocks outbound SMTP ports (25, 465, 587).`);
    console.warn(`👉 Solution: Set RESEND_API_KEY in Render Environment. Resend sends via HTTPS (port 443) which is never blocked.\n`);
    return false;
  }
};

/**
 * Generates an attractive Thunder AI HTML email with the verification OTP.
 */
const getEmailHtml = (otp, name = 'Agent') => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your Thunder AI Account</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #090a0f;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e4e4e7;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #090a0f;
      padding-top: 40px;
      padding-bottom: 40px;
    }
    .main {
      background-color: #121318;
      margin: 0 auto;
      max-width: 520px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .logo-container {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo-badge {
      display: inline-block;
      font-weight: 800;
      font-size: 20px;
      letter-spacing: 2px;
      color: #ffffff;
      text-transform: uppercase;
    }
    .logo-icon {
      color: #eab308;
      font-size: 24px;
      margin-right: 6px;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      text-align: center;
      margin: 0 0 12px 0;
      letter-spacing: -0.5px;
    }
    .subtitle {
      font-size: 14px;
      color: #a1a1aa;
      text-align: center;
      line-height: 1.5;
      margin-bottom: 28px;
    }
    .otp-card {
      background: linear-gradient(180deg, rgba(234, 179, 8, 0.08) 0%, rgba(234, 179, 8, 0.02) 100%);
      border: 1px solid rgba(234, 179, 8, 0.3);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 10px;
      color: #facc15;
      margin: 0;
      text-shadow: 0 0 20px rgba(250, 204, 21, 0.4);
    }
    .otp-expiry {
      font-size: 12px;
      color: #71717a;
      margin-top: 10px;
      font-family: monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .instructions {
      font-size: 13px;
      color: #a1a1aa;
      line-height: 1.6;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 20px;
      margin-top: 24px;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #52525b;
      margin-top: 28px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div class="logo-container">
            <span class="logo-badge"><span class="logo-icon">&#9889;</span>THUNDER AI</span>
          </div>

          <h1 class="title">Verify Your Email Address</h1>
          <p class="subtitle">
            Hello <strong>${name}</strong>,<br>
            Use the 6-digit verification code below to verify your account and activate neural telemetry access.
          </p>

          <div class="otp-card">
            <p class="otp-code">${otp}</p>
            <p class="otp-expiry">&#9200; Valid for 10 minutes</p>
          </div>

          <div class="instructions">
            Enter this code on the verification screen to complete your registration. If you did not sign up for Thunder AI, you can safely ignore this email.
          </div>

          <div class="footer">
            &copy; ${new Date().getFullYear()} Thunder AI Intelligence Platform &bull; Automated Security Telemetry
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `;
};

/**
 * Sends a 6-digit OTP verification email.
 *
 * @param {string} email - Recipient email address
 * @param {string} otp - 6-digit numeric OTP code
 * @param {string} name - User's name
 * @returns {Promise<boolean>}
 */
export const sendVerificationOTP = async (email, otp, name = 'User') => {
  // Option 1: Resend HTTP REST API (Bypasses Render's egress SMTP firewall on Port 443)
  if (process.env.RESEND_API_KEY) {
    try {
      return await sendViaResend(email, otp, name);
    } catch (err) {
      console.error(`❌ [EmailService] Resend API failed:`, err.message);
      // Fall through to try Gmail SMTP if configured
    }
  }

  // Option 2: Gmail SMTP (Fast 5s timeout)
  const transporter = getTransporter();

  if (transporter) {
    const mailOptions = {
      from: `"Thunder AI" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `⚡ Your Thunder AI Verification Code is ${otp}`,
      text: `Hello ${name},\n\nYour Thunder AI verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this, please ignore this message.`,
      html: getEmailHtml(otp, name),
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ [EmailService] Verification OTP successfully sent to ${email} (Message ID: ${info.messageId})`);
      return true;
    } catch (error) {
      console.error(`❌ [EmailService] SMTP delivery failed to send to ${email}:`, error.message);
      // VULN-09: Never leak OTP in console or logs in production environments
      if (process.env.NODE_ENV !== 'production') {
        console.log(`\n======================================================`);
        console.log(`⚡ [DEV ONLY OTP LOG BACKUP]`);
        console.log(`✉️  User: ${email}`);
        console.log(`🔑  OTP Code: ${otp}`);
        console.log(`======================================================\n`);
      }
      throw error;
    }
  }

  // If neither service is active
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n======================================================`);
    console.log(`⚡ [DEV ONLY OTP LOG BACKUP]`);
    console.log(`✉️  User: ${email}`);
    console.log(`🔑  OTP Code: ${otp}`);
    console.log(`======================================================\n`);
  }
  throw new Error('Email service unavailable. Please configure RESEND_API_KEY or valid SMTP credentials.');
};

/**
 * Generates an attractive Thunder AI HTML email with the password reset link.
 */
const getResetPasswordHtml = (resetUrl, name = 'Operator') => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'admin@thunder.ai';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Thunder AI Password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #090a0f;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e4e4e7;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #090a0f;
      padding-top: 40px;
      padding-bottom: 40px;
    }
    .main {
      background-color: #121318;
      margin: 0 auto;
      max-width: 520px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .logo-container {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo-badge {
      display: inline-block;
      font-weight: 800;
      font-size: 20px;
      letter-spacing: 2px;
      color: #ffffff;
      text-transform: uppercase;
    }
    .logo-icon {
      color: #eab308;
      font-size: 24px;
      margin-right: 6px;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      text-align: center;
      margin: 0 0 12px 0;
      letter-spacing: -0.5px;
    }
    .subtitle {
      font-size: 14px;
      color: #a1a1aa;
      text-align: center;
      line-height: 1.5;
      margin-bottom: 28px;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
      color: #000000 !important;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 1px;
      text-transform: uppercase;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(234, 179, 8, 0.4);
    }
    .expiry {
      font-size: 12px;
      color: #71717a;
      text-align: center;
      font-family: monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 10px;
    }
    .fallback-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 12px;
      word-break: break-all;
      font-size: 11px;
      color: #a1a1aa;
      font-family: monospace;
      margin-top: 20px;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #52525b;
      margin-top: 28px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div class="logo-container">
            <span class="logo-badge"><span class="logo-icon">&#9889;</span>THUNDER AI</span>
          </div>

          <h1 class="title">Reset Your Password</h1>
          <p class="subtitle">
            Hello <strong>${name}</strong>,<br>
            A request was received to reset the password for your Thunder AI operator account. Click the button below to choose a new password.
          </p>

          <div class="btn-container">
            <a href="${resetUrl}" class="btn" target="_blank">Reset Password</a>
            <p class="expiry">&#9200; Valid for 15 minutes</p>
          </div>

          <div class="fallback-box">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #facc15; text-decoration: underline;">${resetUrl}</a>
          </div>

          <p style="font-size: 12px; color: #71717a; margin-top: 20px; text-align: center;">
            If you did not initiate this request, you can safely disregard this email. Your password will remain unchanged.
          </p>

          <div class="footer">
            &copy; ${new Date().getFullYear()} Thunder AI Intelligence Platform &bull; Security Administration (${adminEmail})
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `;
};

/**
 * Sends a password reset email from the admin email configured in environment.
 *
 * @param {string} email - Recipient email address
 * @param {string} resetUrl - Complete password reset URL
 * @param {string} name - User's name
 * @returns {Promise<boolean>}
 */
export const sendPasswordResetEmail = async (email, resetUrl, name = 'Operator') => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'admin@thunder.ai';

  // Option 1: Resend HTTP REST API
  if (process.env.RESEND_API_KEY) {
    try {
      const apiKey = process.env.RESEND_API_KEY.trim();
      const senderEmail = process.env.RESEND_FROM_EMAIL || adminEmail;
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Thunder AI Security <${senderEmail}>`,
          to: [email],
          subject: '⚡ Reset Your Thunder AI Password',
          html: getResetPasswordHtml(resetUrl, name),
        }),
      });

      if (response.ok) {
        console.log(`✅ [EmailService] Password reset link sent to ${email} via Resend`);
        return true;
      }
    } catch (err) {
      console.warn(`Resend failed for reset email:`, err.message);
    }
  }

  // Option 2: Gmail SMTP (from admin email configured in env)
  const transporter = getTransporter();
  if (transporter) {
    const mailOptions = {
      from: `"Thunder AI Security" <${adminEmail}>`,
      to: email,
      subject: '⚡ Reset Your Thunder AI Password',
      text: `Hello ${name},\n\nYou requested a password reset for your Thunder AI account.\nPlease use the link below to reset your password (valid for 15 minutes):\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
      html: getResetPasswordHtml(resetUrl, name),
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ [EmailService] Password reset email sent to ${email} via SMTP (${info.messageId})`);
      return true;
    } catch (err) {
      console.error(`❌ [EmailService] SMTP error sending password reset to ${email}:`, err.message);
      // VULN-09: Never leak password reset link in production logs
      if (process.env.NODE_ENV !== 'production') {
        console.log(`\n======================================================`);
        console.log(`⚡ [DEV ONLY RESET LINK BACKUP]`);
        console.log(`✉️  User: ${email}`);
        console.log(`🔗  Link: ${resetUrl}`);
        console.log(`======================================================\n`);
      }
      throw err;
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n======================================================`);
    console.log(`⚡ [DEV ONLY RESET LINK BACKUP]`);
    console.log(`✉️  User: ${email}`);
    console.log(`🔗  Link: ${resetUrl}`);
    console.log(`======================================================\n`);
  }
  throw new Error('Email service unavailable. Please configure RESEND_API_KEY or valid SMTP credentials.');
};

/**
 * VULN-15 Remediation: Dedicated Admin Invitation Email Dispatch
 * Sends a clean invitation notice without misrepresenting passwords as 6-digit OTP codes.
 */
export const sendAdminInviteEmail = async (email, tempPassword, name = 'Operator') => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'admin@thunder.ai';
  const loginUrl = (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',')[0].trim() : 'https://thunder-ai.pages.dev') + '/';

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>You have been invited to Thunder AI</title>
</head>
<body style="margin:0;padding:0;background-color:#090a0f;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#e4e4e7;">
  <div style="max-width:600px;margin:40px auto;background:#10141f;border:1px solid #1e293b;border-radius:16px;padding:36px;">
    <div style="font-size:20px;font-weight:700;color:#38bdf8;margin-bottom:18px;">⚡ THUNDER AI // INVITATION</div>
    <p style="font-size:15px;color:#cbd5e1;line-height:1.6;">Hello ${name},</p>
    <p style="font-size:15px;color:#cbd5e1;line-height:1.6;">An administrator has provisioned an account for you on the Thunder AI Intelligence Platform.</p>
    <div style="background:#090a0f;border:1px solid #334155;border-radius:12px;padding:20px;margin:24px 0;">
      <div style="font-size:12px;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Temporary Credentials</div>
      <div style="font-size:14px;color:#cbd5e1;margin-bottom:6px;"><strong>Email:</strong> ${email}</div>
      <div style="font-size:14px;color:#38bdf8;font-family:monospace;letter-spacing:1px;"><strong>Temporary Password:</strong> ${tempPassword}</div>
    </div>
    <p style="font-size:13px;color:#f59e0b;margin-bottom:24px;">⚠️ For security, you are required to change your password immediately upon your first login.</p>
    <a href="${loginUrl}" style="display:inline-block;padding:12px 28px;background:#0284c7;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Sign In to Thunder AI</a>
  </div>
</body>
</html>
  `;

  // Option 1: Resend HTTP REST API
  if (process.env.RESEND_API_KEY) {
    try {
      const apiKey = process.env.RESEND_API_KEY.trim();
      const senderEmail = process.env.RESEND_FROM_EMAIL || adminEmail;
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Thunder AI Administration <${senderEmail}>`,
          to: [email],
          subject: '⚡ Your Thunder AI Invitation & Temporary Access Credentials',
          html: htmlContent,
        }),
      });

      if (response.ok) {
        console.log(`✅ [EmailService] Admin invite email sent to ${email} via Resend`);
        return true;
      }
    } catch (err) {
      console.warn(`Resend failed for invite email:`, err.message);
    }
  }

  // Option 2: SMTP
  const transporter = getTransporter();
  if (transporter) {
    const mailOptions = {
      from: `"Thunder AI Administration" <${adminEmail}>`,
      to: email,
      subject: '⚡ Your Thunder AI Invitation & Temporary Access Credentials',
      text: `Hello ${name},\n\nYou have been invited to Thunder AI.\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease sign in at ${loginUrl} and change your password immediately.`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [EmailService] Admin invite sent to ${email} via SMTP (${info.messageId})`);
    return true;
  }

  throw new Error('Email service unavailable for dispatching admin invite.');
};

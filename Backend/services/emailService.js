import nodemailer from 'nodemailer';

/**
 * Creates and returns the nodemailer transporter using Gmail SMTP.
 */
const getTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn(
      '⚠️ [EmailService] EMAIL_USER or EMAIL_PASS not configured in .env. OTP will be printed to console.'
    );
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user.trim(),
      pass: pass.trim().replace(/\s+/g, ''), // Google app passwords often contain spaces
    },
  });
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
  const transporter = getTransporter();

  // If email credentials are not set yet, print to console for development convenience
  if (!transporter) {
    console.log('\n======================================================');
    console.log(`⚡ [THUNDER AI VERIFICATION OTP]`);
    console.log(`✉️  Recipient: ${email}`);
    console.log(`🔑  OTP Code:  ${otp}`);
    console.log(`⏰  Valid for: 10 minutes`);
    console.log('======================================================\n');
    return true;
  }

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
    console.error(`❌ [EmailService] Failed to send email to ${email}:`, error.message);
    // Print fallback OTP in console so user is never locked out during local development
    console.log(`⚡ [FALLBACK CONSOLE OTP] For ${email}: ${otp}`);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};

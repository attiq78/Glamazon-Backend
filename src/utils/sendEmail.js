const nodemailer = require('nodemailer');

// Create transporter with debug logging
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  debug: true, // Enable debug logging
  logger: true  // Log to console
});

// Verify transporter configuration on startup
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP Configuration Error:', error);
    if (!process.env.EMAIL_USER) {
      console.error('EMAIL_USER is not set in environment variables');
    }
    if (!process.env.EMAIL_PASSWORD) {
      console.error('EMAIL_PASSWORD is not set in environment variables');
    }
  } else {
    console.log('SMTP server is ready to send emails');
  }
});

const sendEmail = async (to, subject, html) => {
  try {
    // Log email configuration (without password)
    console.log('Email Configuration:', {
      host: transporter.options.host,
      port: transporter.options.port,
      secure: transporter.options.secure,
      user: process.env.EMAIL_USER,
      hasPassword: !!process.env.EMAIL_PASSWORD
    });

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error('Email configuration missing. Please check EMAIL_USER and EMAIL_PASSWORD in .env file');
    }

    const mailOptions = {
      from: `"Glamazon AI" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    };

    console.log('Attempting to send email to:', to);
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', to);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    if (error.code === 'EAUTH') {
      console.error('Gmail authentication failed. Please check your credentials and make sure you have:');
      console.error('1. Enabled 2-Step Verification');
      console.error('2. Generated an App Password');
      console.error('3. Used the App Password in your .env file');
    }
    throw error;
  }
};

const sendOtpEmail = async (email, otp) => {
  const subject = 'Email Verification OTP - Glamazon Salon';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333; text-align: center;">Email Verification</h1>
      <div style="background-color: #f8f8f8; padding: 20px; border-radius: 5px;">
        <p style="font-size: 16px;">Your OTP for email verification is:</p>
        <h2 style="color: #4CAF50; text-align: center; font-size: 32px; letter-spacing: 5px;">${otp}</h2>
        <p style="color: #666;">This OTP will expire in 5 minutes.</p>
        <p style="color: #666;">If you didn't request this verification, please ignore this email.</p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #888;">
        <p>This is an automated message from Glamazon Salon. Please do not reply.</p>
      </div>
    </div>
  `;

  return sendEmail(email, subject, html);
};

const sendPasswordChangeEmail = async (email, name) => {
  const subject = 'Password Changed - Glamazon Salon';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333; text-align: center;">Password Changed Successfully</h1>
      <div style="background-color: #f8f8f8; padding: 20px; border-radius: 5px;">
        <p style="font-size: 16px;">Dear ${name},</p>
        <p style="font-size: 16px;">Your password has been successfully changed.</p>
        <p style="font-size: 16px;">If you did not make this change, please contact us immediately.</p>
        <div style="text-align: center; margin-top: 20px;">
          <a href="http://localhost:5174/login" 
             style="background-color: #7B1FA2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Login to Your Account
          </a>
        </div>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #888;">
        <p>For security reasons, please do not share your login credentials with anyone.</p>
        <p>This is an automated message from Glamazon Salon. Please do not reply.</p>
      </div>
    </div>
  `;

  return sendEmail(email, subject, html);
};

const sendPasswordResetEmail = async (email, name, resetToken) => {
  const resetLink = `http://localhost:5174/reset-password?token=${encodeURIComponent(resetToken)}`;
  const subject = 'Password Reset Request - Glamazon Salon';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333; text-align: center;">Password Reset Request</h1>
      <div style="background-color: #f8f8f8; padding: 20px; border-radius: 5px;">
        <p style="font-size: 16px;">Dear ${name},</p>
        <p style="font-size: 16px;">We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #7B1FA2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 14px; margin-top: 20px;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="font-size: 14px; word-break: break-all; background-color: #eee; padding: 10px; border-radius: 4px;">${resetLink}</p>
        <p style="font-size: 16px;">This link will expire in 1 hour for security reasons.</p>
        <p style="font-size: 16px;">If you didn't request this password reset, please ignore this email or contact us if you have concerns.</p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #888;">
        <p>For security reasons, please do not share this link with anyone.</p>
        <p>This is an automated message from Glamazon Salon. Please do not reply.</p>
      </div>
    </div>
  `;

  return sendEmail(email, subject, html);
};

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendPasswordChangeEmail,
  sendPasswordResetEmail
}; 
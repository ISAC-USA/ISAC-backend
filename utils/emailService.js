const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter for SMTP2GO
const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'mail.smtp2go.com',
    port: 2525, // Primary SMTP2GO port
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP2GO_USERNAME,
      pass: process.env.SMTP2GO_PASSWORD,
    },
  });
};

// Send webinar registration confirmation email
const sendWebinarConfirmationEmail = async (userDetails, webinarDetails) => {
  try {
    const transporter = createTransporter();

    const emailTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Webinar Registration Confirmation</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #9333ea 0%, #3b82f6 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
        .content { padding: 40px 30px; }
        .webinar-card { background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #9333ea; }
        .webinar-title { font-size: 22px; font-weight: bold; color: #1e293b; margin-bottom: 8px; }
        .webinar-details { font-size: 16px; color: #64748b; line-height: 1.6; }
        .highlight { background-color: #ddd6fe; padding: 16px; border-radius: 8px; margin: 20px 0; }
        .highlight h3 { margin: 0 0 12px 0; color: #7c3aed; font-size: 18px; }
        .next-steps { background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 24px 0; }
        .next-steps h3 { color: #0369a1; margin: 0 0 16px 0; }
        .next-steps ul { margin: 0; padding-left: 20px; color: #374151; }
        .next-steps li { margin-bottom: 8px; }
        .footer { background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }
        .footer p { margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; }
        .logo { margin-bottom: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo" style="display: flex; align-items: center; justify-content: center;">
                <img src="https://raw.githubusercontent.com/isiddharthsingh/ISAC/main/public/isac_logo.png" 
                     alt="ISAC Logo" 
                     style="height: 40px; width: auto;">
            </div>
            <h1>Registration Confirmed! 🎉</h1>
            <p>Thank you for registering for our educational webinar</p>
        </div>
        
        <div class="content">
            <p style="font-size: 18px; color: #374151; margin-bottom: 24px;">
                Dear <strong>${userDetails.name}</strong>,
            </p>
            
            <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
                Thank you for registering for our webinar! We're excited to have you join us for this educational session.
            </p>

            <div class="webinar-card">
                <div class="webinar-title">${webinarDetails.title}</div>
                <div class="webinar-details">
                    📅 <strong>Date:</strong> ${webinarDetails.date}<br>
                    🕒 <strong>Time:</strong> ${webinarDetails.time}<br>
                    ⏱️ <strong>Duration:</strong> ${webinarDetails.duration}<br>
                    👨‍🏫 <strong>Presenter:</strong> ${webinarDetails.presenter}
                </div>
            </div>

            <div class="highlight">
                <h3>📧 What's Next?</h3>
                <p style="margin: 0; color: #374151;">
                    You will receive the webinar join link and detailed instructions closer to the event date. 
                    Our team will send you all the necessary details to ensure you don't miss this valuable session.
                </p>
            </div>

            <div class="next-steps">
                <h3>📝 Important Notes:</h3>
                <ul>
                    <li><strong>Save the date:</strong> Mark your calendar for ${webinarDetails.date} at ${webinarDetails.time}</li>
                    <li><strong>Check your email:</strong> We'll send you a reminder 24 hours before the webinar</li>
                    <li><strong>Join link:</strong> You'll receive the meeting link 30 minutes before the session starts</li>
                    <li><strong>Preparation:</strong> Come with questions! This will be an interactive session</li>
                    <li><strong>Recording:</strong> Don't worry if you can't attend live - registered participants get access to the recording</li>
                </ul>
            </div>

            <p style="color: #64748b; line-height: 1.6; margin-top: 32px;">
                If you have any questions or need to make changes to your registration, please don't hesitate to reach out to us.
            </p>

            <p style="color: #64748b; line-height: 1.6; margin-top: 24px;">
                Best regards,<br>
                <strong>The ISAC Team</strong><br>
                International Student Advocacy Committee
            </p>
        </div>
        
        <div class="footer">
            <p>
                <strong>ISAC - International Student Advocacy Committee</strong><br>
                Empowering students through education and community<br><br>
                This email was sent to ${userDetails.email}<br>
                If you have any questions, please contact us at support@isac.org
            </p>
        </div>
    </div>
</body>
</html>
    `;

    const mailOptions = {
      from: {
        name: 'ISAC - International Student Advocacy Committee',
        address: process.env.SMTP2GO_FROM_EMAIL || 'noreply@isac.org'
      },
      to: userDetails.email,
      subject: `✅ Registration Confirmed: ${webinarDetails.title}`,
      html: emailTemplate,
      text: `
Dear ${userDetails.name},

Thank you for registering for our webinar: "${webinarDetails.title}"

Event Details:
- Date: ${webinarDetails.date}
- Time: ${webinarDetails.time}
- Duration: ${webinarDetails.duration}
- Presenter: ${webinarDetails.presenter}

What's Next:
You will receive the webinar join link and detailed instructions closer to the event date. Our team will send you all the necessary details to ensure you don't miss this valuable session.

Important Notes:
- Save the date: Mark your calendar for ${webinarDetails.date} at ${webinarDetails.time}
- Check your email: We'll send you a reminder 24 hours before the webinar
- Join link: You'll receive the meeting link 30 minutes before the session starts
- Preparation: Come with questions! This will be an interactive session
- Recording: Don't worry if you can't attend live - registered participants get access to the recording

If you have any questions or need to make changes to your registration, please don't hesitate to reach out to us.

Best regards,
The ISAC Team
International Student Advocacy Committee

This email was sent to ${userDetails.email}
If you have any questions, please contact us at support@isac.org
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Webinar confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('Error sending webinar confirmation email:', error);
    throw new Error('Failed to send confirmation email');
  }
};

// Test email configuration
const testEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ SMTP2GO connection verified successfully');
    return true;
  } catch (error) {
    console.error('❌ SMTP2GO connection failed:', error);
    return false;
  }
};

// Send WhatsApp group verification email
const sendVerificationEmail = async ({ email, university, verificationToken, universityShortName }) => {
  try {
    const transporter = createTransporter();

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/whatsapp-groups/verify/${verificationToken}`;

    const emailTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your University Email</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #16a34a 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
        .content { padding: 40px 30px; }
        .university-card { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #16a34a; }
        .university-title { font-size: 22px; font-weight: bold; color: #15803d; margin-bottom: 8px; }
        .university-details { font-size: 16px; color: #166534; line-height: 1.6; }
        .verify-button { background-color: #16a34a; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; margin: 24px 0; }
        .verify-button:hover { background-color: #15803d; }
        .warning { background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0; }
        .warning h3 { color: #b45309; margin: 0 0 12px 0; }
        .warning p { color: #92400e; margin: 0; }
        .footer { background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }
        .footer p { margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; }
        .logo { margin-bottom: 16px; }
        .backup-link { background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; font-family: monospace; word-break: break-all; font-size: 12px; margin-top: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo" style="display: flex; align-items: center; justify-content: center;">
                <img src="https://raw.githubusercontent.com/isiddharthsingh/ISAC/main/public/isac_logo.png" 
                     alt="ISAC Logo" 
                     style="height: 40px; width: auto;">
            </div>
            <h1>Verify Your University Email 📧</h1>
            <p>Join your ${universityShortName} WhatsApp community</p>
        </div>
        
        <div class="content">
            <p style="font-size: 18px; color: #374151; margin-bottom: 24px;">
                Hello!
            </p>
            
            <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
                Thank you for joining the ${university} WhatsApp community! To complete your registration and gain access to your university's WhatsApp groups, please verify your email address.
            </p>

            <div class="university-card">
                <div class="university-title">${university}</div>
                <div class="university-details">
                    🎓 Join verified students from your university<br>
                    💬 Connect with fellow students and alumni<br>
                    🤝 Get academic help and share resources<br>
                    🏠 Find housing and roommate opportunities
                </div>
            </div>

            <div style="text-align: center; margin: 32px 0;">
                <a href="${verificationUrl}" class="verify-button">
                    ✅ Verify My Email Address
                </a>
            </div>

            <div class="warning">
                <h3>⏰ Important!</h3>
                <p>This verification link will expire in 24 hours. If you didn't request this verification, you can safely ignore this email.</p>
            </div>

            <p style="color: #64748b; line-height: 1.6; margin-top: 32px;">
                If the button above doesn't work, you can copy and paste this link into your browser:
            </p>
            
            <div class="backup-link">
                ${verificationUrl}
            </div>

            <p style="color: #64748b; line-height: 1.6; margin-top: 32px;">
                Having trouble? Reply to this email and our support team will help you out.
            </p>

            <p style="color: #64748b; line-height: 1.6; margin-top: 24px;">
                Best regards,<br>
                <strong>The ISAC Team</strong><br>
                International Student Advocacy Committee
            </p>
        </div>
        
        <div class="footer">
            <p>
                <strong>ISAC - International Student Advocacy Committee</strong><br>
                Connecting students worldwide<br><br>
                This email was sent to ${email}<br>
                If you have any questions, please contact us at support@isac.org
            </p>
        </div>
    </div>
</body>
</html>
    `;

    const mailOptions = {
      from: {
        name: 'ISAC - WhatsApp Groups',
        address: process.env.SMTP2GO_FROM_EMAIL || 'noreply@isac.org'
      },
      to: email,
      subject: `🎓 Verify your ${universityShortName} email to join WhatsApp groups`,
      html: emailTemplate,
      text: `
Hello!

Thank you for joining the ${university} WhatsApp community! To complete your registration and gain access to your university's WhatsApp groups, please verify your email address.

Click this link to verify your email:
${verificationUrl}

University: ${university}
Benefits:
- Join verified students from your university
- Connect with fellow students and alumni  
- Get academic help and share resources
- Find housing and roommate opportunities

IMPORTANT: This verification link will expire in 24 hours. If you didn't request this verification, you can safely ignore this email.

Having trouble? Reply to this email and our support team will help you out.

Best regards,
The ISAC Team
International Student Advocacy Committee

This email was sent to ${email}
If you have any questions, please contact us at support@isac.org
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('WhatsApp verification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('Error sending WhatsApp verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

// Send WhatsApp document manual approval email
const sendWhatsAppApprovalEmail = async ({ email, university, universityShortName, phoneNumber }) => {
  try {
    const transporter = createTransporter();

    const emailTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Group Access Approved</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #16a34a 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
        .content { padding: 40px 30px; }
        .university-card { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #16a34a; }
        .university-title { font-size: 22px; font-weight: bold; color: #15803d; margin-bottom: 8px; }
        .university-details { font-size: 16px; color: #166534; line-height: 1.6; }
        .success { background-color: #d1fae5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center; }
        .footer { background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }
        .footer p { margin: 0; color: #64748b; font-size: 14px; line-height: 1.6; }
        .logo { margin-bottom: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo" style="display: flex; align-items: center; justify-content: center;">
                <img src="https://raw.githubusercontent.com/isiddharthsingh/ISAC/main/public/isac_logo.png" 
                     alt="ISAC Logo" 
                     style="height: 40px; width: auto;">
            </div>
            <h1>WhatsApp Group Access Approved ✅</h1>
            <p>Welcome to the ${universityShortName} WhatsApp community</p>
        </div>
        <div class="content">
            <div class="success">
                <h2 style="color: #15803d; margin-bottom: 12px;">Congratulations!</h2>
                <p style="color: #166534; font-size: 18px;">Your document has been manually reviewed and your verification is <strong>approved</strong>.</p>
            </div>
            <div class="university-card">
                <div class="university-title">${university}</div>
                <div class="university-details">
                    🎓 You can now access exclusive WhatsApp groups for your university.<br>
                    💬 Connect with fellow students and alumni<br>
                    🤝 Get academic help and share resources<br>
                    🏠 Find housing and roommate opportunities
                </div>
            </div>
            <p style="color: #374151; font-size: 16px; margin-top: 24px;">
                <strong>How to access WhatsApp groups:</strong>
            </p>
            <ul style="color: #166534; font-size: 15px; margin-bottom: 24px;">
                <li>Go to the WhatsApp Groups portal</li>
                <li>Use the <strong>same email</strong> (<span style="color:#2563eb">${email}</span>) and <strong>phone number</strong> (<span style="color:#2563eb">${phoneNumber}</span>) you used for verification</li>
                <li>If prompted, upload the same document again</li>
                <li>You will be granted access instantly</li>
            </ul>
            <p style="color: #64748b; line-height: 1.6; margin-top: 24px;">
                If you have any trouble accessing the groups, reply to this email or contact our support team at <a href="mailto:support@isac.org" style="color:#2563eb;">support@isac.org</a>.
            </p>
            <p style="color: #64748b; line-height: 1.6; margin-top: 24px;">
                Best regards,<br>
                <strong>The ISAC Team</strong><br>
                International Student Advocacy Committee
            </p>
        </div>
        <div class="footer">
            <p>
                <strong>ISAC - International Student Advocacy Committee</strong><br>
                Connecting students worldwide<br><br>
                This email was sent to ${email}<br>
                If you have any questions, please contact us at support@isac.org
            </p>
        </div>
    </div>
</body>
</html>
    `;

    const mailOptions = {
      from: {
        name: 'ISAC - WhatsApp Groups',
        address: process.env.SMTP2GO_FROM_EMAIL || 'noreply@isac.org'
      },
      to: email,
      subject: `✅ WhatsApp Group Access Approved`,
      html: emailTemplate,
      text: `
Congratulations!

Your document has been manually reviewed and your verification is approved.

University: ${university}
Email: ${email}
Phone: ${phoneNumber}

How to access WhatsApp groups:
- Go to the WhatsApp Groups portal
- Use the same email and phone number you used for verification
- If prompted, upload the same document again
- You will be granted access instantly

If you have any trouble accessing the groups, reply to this email or contact our support team at support@isac.org.

Best regards,
The ISAC Team
International Student Advocacy Committee

This email was sent to ${email}
If you have any questions, please contact us at support@isac.org
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('WhatsApp manual approval email sent:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('Error sending WhatsApp manual approval email:', error);
    throw new Error('Failed to send WhatsApp manual approval email');
  }
};

module.exports = {
  sendWebinarConfirmationEmail,
  sendVerificationEmail,
  testEmailConnection,
  sendWhatsAppApprovalEmail
}; 
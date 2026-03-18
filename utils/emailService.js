const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendAttendanceAlert = async (studentEmail, studentName, className, percentage) => {
  try {
    await transporter.sendMail({
      from: `"Smart Attendance" <${process.env.EMAIL_USER}>`,
      to: studentEmail,
      subject: `⚠️ Low Attendance Alert - ${className}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Smart Attendance</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333;">Low Attendance Warning</h2>
            <p style="color: #666;">Dear <strong>${studentName}</strong>,</p>
            <p style="color: #666;">Your attendance in <strong>${className}</strong> has fallen to <strong style="color: #e53e3e;">${percentage}%</strong>.</p>
            <p style="color: #666;">Please ensure you attend upcoming classes to maintain the required attendance percentage.</p>
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <strong>Required: 75% minimum attendance</strong>
            </div>
            <p style="color: #999; font-size: 12px;">This is an automated message from Smart Attendance System.</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('Email send error:', error);
  }
};

const sendWelcomeEmail = async (email, name, role) => {
  try {
    await transporter.sendMail({
      from: `"Smart Attendance" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎉 Welcome to Smart Attendance System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome, ${name}!</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px;">
            <p>Your account has been created as a <strong>${role}</strong>.</p>
            <p>Log in to get started with Smart Attendance.</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('Email send error:', error);
  }
};

module.exports = { sendAttendanceAlert, sendWelcomeEmail };

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.titan.email',
      port: 465,
      secure: true, 
      auth: {
        user: process.env.EMAIL_USER || 'support@ghettoco.com',
        pass: process.env.EMAIL_PASSWORD || '', // Пароль от почты
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  async sendVerificationCode(email, code) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER || 'support@ghettoco.com',
        to: email,
        subject: 'Код подтверждения для регистрации',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; text-align: center;">Подтверждение регистрации</h2>
            <p style="font-size: 16px; color: #666;">
              Здравствуйте! Для завершения регистрации введите следующий код подтверждения:
            </p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${code}</h1>
            </div>
            <p style="font-size: 14px; color: #999;">
              Код действителен в течение 10 минут. Если вы не запрашивали этот код, проигнорируйте это письмо.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              Это автоматическое сообщение, не отвечайте на него.
            </p>
          </div>
        `,
        text: `Код подтверждения: ${code}. Код действителен в течение 10 минут.`
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetCode(email, code) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER || 'support@ghettoco.com',
        to: email,
        subject: 'Код для сброса пароля',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; text-align: center;">Сброс пароля</h2>
            <p style="font-size: 16px; color: #666;">
              Вы запросили сброс пароля. Для продолжения введите следующий код:
            </p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #dc3545; font-size: 32px; margin: 0; letter-spacing: 5px;">${code}</h1>
            </div>
            <p style="font-size: 14px; color: #999;">
              Код действителен в течение 10 минут. Если вы не запрашивали сброс пароля, проигнорируйте это письмо.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              Это автоматическое сообщение, не отвечайте на него.
            </p>
          </div>
        `,
        text: `Код для сброса пароля: ${code}. Код действителен в течение 10 минут.`
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Password reset email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  // Метод для тестирования подключения
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('Email service is ready to send messages');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

module.exports = new EmailService();

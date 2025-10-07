require('dotenv').config();
const emailService = require('./src/services/emailService');

async function testEmailService() {
  console.log('Testing email service connection...');
  
  // Проверяем подключение
  const isConnected = await emailService.verifyConnection();
  
  if (!isConnected) {
    console.error('❌ Email service connection failed');
    console.log('Please check your email configuration in .env file:');
    console.log('- EMAIL_USER=support@ghettoco.com');
    console.log('- EMAIL_PASSWORD=your_email_password');
    return;
  }
  
  console.log('✅ Email service connection successful');
  
  // Тестируем отправку email
  console.log('Sending test email...');
  
  const testEmail = 'test@example.com'; // Замените на реальный email для тестирования
  const testCode = '123456';
  
  const result = await emailService.sendVerificationCode(testEmail, testCode);
  
  if (result.success) {
    console.log('✅ Test email sent successfully');
    console.log('Message ID:', result.messageId);
  } else {
    console.error('❌ Failed to send test email:', result.error);
  }
}

// Запускаем тест
testEmailService().catch(console.error);

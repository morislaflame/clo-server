const { EmailVerification } = require('../models/models');
const emailService = require('./emailService');

class VerificationService {
  // Генерация случайного кода
  generateCode(length = 6) {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return code;
  }

  // Отправка кода подтверждения для регистрации
  async sendRegistrationCode(email) {
    try {
      // Удаляем старые неиспользованные коды для этого email
      await EmailVerification.destroy({
        where: {
          email,
          type: 'REGISTRATION',
          isUsed: false
        }
      });

      // Генерируем новый код
      const code = this.generateCode();
      
      // Создаем запись в базе данных
      const verification = await EmailVerification.create({
        email,
        code,
        type: 'REGISTRATION',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 минут
      });

      // Отправляем email
      const emailResult = await emailService.sendVerificationCode(email, code);
      
      if (!emailResult.success) {
        // Если email не отправился, удаляем запись из БД
        await verification.destroy();
        throw new Error(`Failed to send email: ${emailResult.error}`);
      }

      return {
        success: true,
        verificationId: verification.id,
        expiresAt: verification.expiresAt
      };
    } catch (error) {
      console.error('Error sending registration code:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Отправка кода для сброса пароля
  async sendPasswordResetCode(email) {
    try {
      // Проверяем, существует ли пользователь с таким email
      const { User } = require('../models/models');
      const user = await User.findOne({ where: { email } });
      
      if (!user) {
        return {
          success: false,
          error: 'User with this email not found'
        };
      }

      // Удаляем старые неиспользованные коды для этого email
      await EmailVerification.destroy({
        where: {
          email,
          type: 'PASSWORD_RESET',
          isUsed: false
        }
      });

      // Генерируем новый код
      const code = this.generateCode();
      
      // Создаем запись в базе данных
      const verification = await EmailVerification.create({
        email,
        code,
        type: 'PASSWORD_RESET',
        userId: user.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 минут
      });

      // Отправляем email
      const emailResult = await emailService.sendPasswordResetCode(email, code);
      
      if (!emailResult.success) {
        // Если email не отправился, удаляем запись из БД
        await verification.destroy();
        throw new Error(`Failed to send email: ${emailResult.error}`);
      }

      return {
        success: true,
        verificationId: verification.id,
        expiresAt: verification.expiresAt
      };
    } catch (error) {
      console.error('Error sending password reset code:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Проверка кода подтверждения
  async verifyCode(email, code, type = 'REGISTRATION') {
    try {
      const verification = await EmailVerification.findOne({
        where: {
          email,
          code,
          type,
          isUsed: false
        }
      });

      if (!verification) {
        return {
          success: false,
          error: 'Invalid or expired verification code'
        };
      }

      // Проверяем, не истек ли код
      if (new Date() > verification.expiresAt) {
        await verification.destroy();
        return {
          success: false,
          error: 'Verification code has expired'
        };
      }

      // Помечаем код как использованный
      await verification.update({ isUsed: true });

      return {
        success: true,
        verification
      };
    } catch (error) {
      console.error('Error verifying code:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Очистка истекших кодов (можно вызывать периодически)
  async cleanupExpiredCodes() {
    try {
      const deletedCount = await EmailVerification.destroy({
        where: {
          expiresAt: {
            [require('sequelize').Op.lt]: new Date()
          }
        }
      });
      
      console.log(`Cleaned up ${deletedCount} expired verification codes`);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up expired codes:', error);
      return 0;
    }
  }
}

module.exports = new VerificationService();

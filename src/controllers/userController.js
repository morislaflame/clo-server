const ApiError = require("../errors/ApiError");
const sequelize = require("../db");
const {
  User,
} = require("../models/models");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const verificationService = require("../services/verificationService");

const generateJwt = (user) => {
  const payload = {
    id: user.id,
    role: user.role,
  };

  if (user.email) {
    payload.email = user.email;
  }

  if (user.username) {
    payload.username = user.username;
  }

  return jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: "24h" });
};

class UserController {
  // async registration(req, res, next) {
  //   const transaction = await sequelize.transaction();

  //   try {
  //     const { email, password } = req.body;

  //     if (!email || !password) {
  //       await transaction.rollback();
  //       return next(ApiError.badRequest("Incorrect email or password"));
  //     }

  //     const candidate = await User.findOne({ where: { email }, transaction });

  //     if (candidate) {
  //       await transaction.rollback();
  //       return next(ApiError.badRequest("User with this email already exists"));
  //     }

  //     const hashPassword = await bcrypt.hash(password, 5);

  //     // Create the user
  //     const user = await User.create(
  //       {
  //         email,
  //         password: hashPassword,
  //         role: "USER",
  //         dailyRewardAvailable: true,
  //       },
  //       { transaction }
  //     );

  //     await transaction.commit();

  //     const token = generateJwt(user);

  //     return res.json({ token });
  //   } catch (e) {
  //     await transaction.rollback();

  //     console.error("Error during registration:", e);
  //     next(ApiError.internal(e.message));
  //   }
  // }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return next(ApiError.badRequest("Email and password are required"));
      }

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return next(ApiError.notFound("User not found"));
      }

      let comparePassword = bcrypt.compareSync(password, user.password);
      if (!comparePassword) {
        return next(ApiError.badRequest("Incorrect password"));
      }

      const token = generateJwt(user);

      return res.json({ token });
    } catch (e) {
      console.error("Error during login:", e);
      next(ApiError.internal(e.message));
    }
  }

  async auth(req, res, next) {
    try {
      // Опционально: загрузить пользователя из базы данных для получения актуальных данных
      const user = await User.findOne({ where: { id: req.user.id } });

      if (!user) {
        return next(ApiError.notFound("User not found"));
      }

      const token = generateJwt(user);

      return res.json({ token });
    } catch (e) {
      next(ApiError.internal(e.message));
    }
  }

  async createGuestUser(req, res, next) {
    const transaction = await sequelize.transaction();
    
    try {
      // Генерируем уникальный ID сессии
      const guestSessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Создаем гостевого пользователя
      const guestUser = await User.create(
        {
          role: "USER",
          isGuest: true,
          guestSessionId: guestSessionId,
        },
        { transaction }
      );

      await transaction.commit();

      const token = generateJwt(guestUser);

      return res.json({ 
        token,
        isGuest: true,
        userId: guestUser.id 
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error creating guest user:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Отправка кода подтверждения для регистрации
  async sendRegistrationCode(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return next(ApiError.badRequest("Email is required"));
      }

      // Проверяем, не существует ли уже пользователь с таким email
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return next(ApiError.badRequest("User with this email already exists"));
      }

      const result = await verificationService.sendRegistrationCode(email);
      
      if (!result.success) {
        return next(ApiError.internal(result.error));
      }

      return res.json({
        message: "Verification code sent to your email",
        expiresAt: result.expiresAt
      });
    } catch (e) {
      console.error("Error sending registration code:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Регистрация с подтверждением кода
  async registerWithVerification(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { email, password, code } = req.body;

      if (!email || !password || !code) {
        await transaction.rollback();
        return next(ApiError.badRequest("Email, password and verification code are required"));
      }

      // Проверяем код подтверждения
      const verificationResult = await verificationService.verifyCode(email, code, 'REGISTRATION');
      
      if (!verificationResult.success) {
        await transaction.rollback();
        return next(ApiError.badRequest(verificationResult.error));
      }

      // Проверяем, не существует ли уже пользователь
      const candidate = await User.findOne({ where: { email }, transaction });
      if (candidate) {
        await transaction.rollback();
        return next(ApiError.badRequest("User with this email already exists"));
      }

      // Хешируем пароль
      const hashPassword = await bcrypt.hash(password, 5);

      // Создаем пользователя
      const user = await User.create(
        {
          email,
          password: hashPassword,
          role: "USER",
          dailyRewardAvailable: true,
        },
        { transaction }
      );

      await transaction.commit();

      const token = generateJwt(user);

      return res.json({ 
        token,
        message: "Registration successful"
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error during registration with verification:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Отправка кода для сброса пароля
  async sendPasswordResetCode(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return next(ApiError.badRequest("Email is required"));
      }

      const result = await verificationService.sendPasswordResetCode(email);
      
      if (!result.success) {
        return next(ApiError.badRequest(result.error));
      }

      return res.json({
        message: "Password reset code sent to your email",
        expiresAt: result.expiresAt
      });
    } catch (e) {
      console.error("Error sending password reset code:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Сброс пароля с подтверждением кода
  async resetPasswordWithVerification(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { email, newPassword, code } = req.body;

      if (!email || !newPassword || !code) {
        await transaction.rollback();
        return next(ApiError.badRequest("Email, new password and verification code are required"));
      }

      // Проверяем код подтверждения
      const verificationResult = await verificationService.verifyCode(email, code, 'PASSWORD_RESET');
      
      if (!verificationResult.success) {
        await transaction.rollback();
        return next(ApiError.badRequest(verificationResult.error));
      }

      // Находим пользователя
      const user = await User.findOne({ where: { email }, transaction });
      if (!user) {
        await transaction.rollback();
        return next(ApiError.notFound("User not found"));
      }

      // Хешируем новый пароль
      const hashPassword = await bcrypt.hash(newPassword, 5);

      // Обновляем пароль
      await user.update({ password: hashPassword }, { transaction });

      await transaction.commit();

      return res.json({
        message: "Password reset successful"
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error during password reset:", e);
      next(ApiError.internal(e.message));
    }
  }
}

module.exports = new UserController();
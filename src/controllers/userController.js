const ApiError = require("../errors/ApiError");
const sequelize = require("../db");
const {
  User,
} = require("../models/models");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

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
  async registration(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { email, password } = req.body;

      if (!email || !password) {
        await transaction.rollback();
        return next(ApiError.badRequest("Incorrect email or password"));
      }

      const candidate = await User.findOne({ where: { email }, transaction });

      if (candidate) {
        await transaction.rollback();
        return next(ApiError.badRequest("User with this email already exists"));
      }

      const hashPassword = await bcrypt.hash(password, 5);

      // Create the user
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

      return res.json({ token });
    } catch (e) {
      await transaction.rollback();

      console.error("Error during registration:", e);
      next(ApiError.internal(e.message));
    }
  }

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
}

module.exports = new UserController();
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    dialect: "postgres",
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    logging: false,
    pool: {
      max: 30,
      min: 5,
      acquire: 30000,
      idle: 5000,
    },
    retry: {
      max: 3,
    },
  }
);

module.exports = sequelize;

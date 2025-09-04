const jwt = require("jsonwebtoken");
const ApiError = require("../errors/ApiError");

module.exports = function (requiredRoles) {
  return function (req, res, next) {
    if (req.method === "OPTIONS") {
      return next();
    }

    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return next(ApiError.unauthorized("Authorization header missing"));
      }

      const tokenParts = authHeader.split(" ");

      if (tokenParts[0] !== "Bearer" || !tokenParts[1]) {
        return next(ApiError.unauthorized("Invalid authorization format"));
      }

      const token = tokenParts[1];

      const decoded = jwt.verify(token, process.env.SECRET_KEY);

      if (!requiredRoles.includes(decoded.role)) {
        return next(ApiError.forbidden("Access denied"));
      }

      req.user = decoded;
      next();
    } catch (error) {
      console.error("Error verifying token:", error);
      next(ApiError.unauthorized("Invalid or expired token"));
    }
  };
};

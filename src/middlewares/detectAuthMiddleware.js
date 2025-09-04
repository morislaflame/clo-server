const jwt = require("jsonwebtoken");

// Middleware to check for JWT without blocking public access
const detectAuth = (req, res, next) => {
  const token = req.header("Authorization");

  if (token) {
    try {
      const decoded = jwt.verify(
        token.replace("Bearer ", ""),
        process.env.JWT_SECRET
      );
      req.user = decoded; // Attach user data to the request
    } catch (err) {
      // Token invalid, treat as guest
    }
  }
  next();
};

module.exports = detectAuth;

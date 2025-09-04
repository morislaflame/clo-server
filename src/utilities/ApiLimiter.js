const rateLimit = require("express-rate-limit");

const guestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Limit for guests (unauthenticated)
  message: "Too many requests from this IP. Please try again later.",
});

const authUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // Higher limit for authenticated users
  message: "Too many requests. Please wait a while.",
});

// Dynamic limiter based on authentication status
const dynamicPublicLimiter = (req, res, next) => {
  const isAuthenticated = req.user ? true : false;

  if (isAuthenticated) {
    return authUserLimiter(req, res, next);
  } else {
    return guestLimiter(req, res, next);
  }
};

const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Rate limit exceeded. Please try again later.",
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Admin request rate exceeded. Please wait a moment.",
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "You're performing too many modifications. Please wait a while.",
});

module.exports = {
  dynamicPublicLimiter,
  userLimiter,
  adminLimiter,
  writeLimiter,
};

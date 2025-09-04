const Router = require("express");
const router = new Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/checkRoleMiddleware");
const detectAuth = require("../middlewares/detectAuthMiddleware");
const {
  userLimiter,
  adminLimiter,
  dynamicPublicLimiter,
} = require("../utilities/ApiLimiter");

router.post(
    "/registration",
    detectAuth,
    dynamicPublicLimiter,
    userController.registration
);

router.post("/login", detectAuth, dynamicPublicLimiter, userController.login);

router.get("/auth", authMiddleware, userLimiter, userController.auth);


module.exports = router;
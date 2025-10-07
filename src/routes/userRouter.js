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

// router.post(
//     "/registration",
//     detectAuth,
//     dynamicPublicLimiter,
//     userController.registration
// );

router.post("/login", detectAuth, dynamicPublicLimiter, userController.login);

router.get("/auth", authMiddleware, userLimiter, userController.auth);

// Создание гостевого пользователя
router.post("/guest", dynamicPublicLimiter, userController.createGuestUser);

// Email аутентификация
router.post("/send-registration-code", dynamicPublicLimiter, userController.sendRegistrationCode);
router.post("/register-with-verification", dynamicPublicLimiter, userController.registerWithVerification);
router.post("/send-password-reset-code", dynamicPublicLimiter, userController.sendPasswordResetCode);
router.post("/reset-password-with-verification", dynamicPublicLimiter, userController.resetPasswordWithVerification);

module.exports = router;
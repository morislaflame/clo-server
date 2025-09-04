const Router = require("express");
const router = new Router();
const colorController = require("../controllers/colorController");
const authMiddleware = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/checkRoleMiddleware");
const {
  adminLimiter,
  userLimiter,
} = require("../utilities/ApiLimiter");

// Публичные маршруты
router.get("/", userLimiter, colorController.getAll);

// Админские маршруты
router.post("/", authMiddleware, checkRole("ADMIN"), adminLimiter, colorController.create);
router.post("/create-defaults", authMiddleware, checkRole("ADMIN"), adminLimiter, colorController.createDefaultColors);
router.put("/:id", authMiddleware, checkRole("ADMIN"), adminLimiter, colorController.update);
router.delete("/:id", authMiddleware, checkRole("ADMIN"), adminLimiter, colorController.delete);

// Управление цветами продуктов
router.post("/product/:productId", authMiddleware, checkRole("ADMIN"), adminLimiter, colorController.addToProduct);
router.delete("/product/:productId/color/:colorId", authMiddleware, checkRole("ADMIN"), adminLimiter, colorController.removeFromProduct);

module.exports = router;

const Router = require("express");
const router = new Router();
const sizeController = require("../controllers/sizeController");
const authMiddleware = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/checkRoleMiddleware");
const {
  adminLimiter,
  userLimiter,
} = require("../utilities/ApiLimiter");

// Публичные маршруты
router.get("/", userLimiter, sizeController.getAll);

// Админские маршруты
router.post("/", authMiddleware, checkRole("ADMIN"), adminLimiter, sizeController.create);
router.post("/create-defaults", authMiddleware, checkRole("ADMIN"), adminLimiter, sizeController.createDefaultSizes);
router.delete("/:id", authMiddleware, checkRole("ADMIN"), adminLimiter, sizeController.delete);

// Управление размерами продуктов
router.post("/product/:productId", authMiddleware, checkRole("ADMIN"), adminLimiter, sizeController.addToProduct);
router.delete("/product/:productId/size/:sizeId", authMiddleware, checkRole("ADMIN"), adminLimiter, sizeController.removeFromProduct);

module.exports = router;

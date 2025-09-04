const Router = require("express");
const router = new Router();
const clothingTypeController = require("../controllers/clothingTypeController");
const authMiddleware = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/checkRoleMiddleware");
const {
  adminLimiter,
  userLimiter,
} = require("../utilities/ApiLimiter");

// Публичные маршруты
router.get("/", userLimiter, clothingTypeController.getAll);
router.get("/statistics", userLimiter, clothingTypeController.getStatistics);
router.get("/:id", userLimiter, clothingTypeController.getOne);

// Админские маршруты
router.post("/", authMiddleware, checkRole("ADMIN"), adminLimiter, clothingTypeController.create);
router.post("/create-defaults", authMiddleware, checkRole("ADMIN"), adminLimiter, clothingTypeController.createDefaultTypes);
router.put("/:id", authMiddleware, checkRole("ADMIN"), adminLimiter, clothingTypeController.update);
router.delete("/:id", authMiddleware, checkRole("ADMIN"), adminLimiter, clothingTypeController.delete);

module.exports = router;

const Router = require("express");
const router = new Router();
const tagController = require("../controllers/tagController");
const authMiddleware = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/checkRoleMiddleware");
const {
  adminLimiter,
  userLimiter,
} = require("../utilities/ApiLimiter");

// Публичные маршруты (получение тегов)
router.get("/", userLimiter, tagController.getAll);
router.get("/counts", userLimiter, tagController.getWithCounts);
router.get("/:id", userLimiter, tagController.getOne);

// Маршруты для админов (создание, обновление, удаление)
router.post(
  "/",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  tagController.create
);

router.put(
  "/:id",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  tagController.update
);

router.delete(
  "/:id",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  tagController.delete
);

module.exports = router;

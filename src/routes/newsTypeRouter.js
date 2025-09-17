const Router = require("express");
const router = new Router();
const newsTypeController = require("../controllers/newsTypeController");
const authMiddleware = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/checkRoleMiddleware");
const {
  adminLimiter,
  userLimiter,
} = require("../utilities/ApiLimiter");

// Публичные маршруты (получение типов новостей)
router.get("/", userLimiter, newsTypeController.getAll);
router.get("/counts", userLimiter, newsTypeController.getWithCounts);
router.get("/:id", userLimiter, newsTypeController.getOne);

// Маршруты для админов (создание, обновление, удаление)
router.post(
  "/",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  newsTypeController.create
);

router.put(
  "/:id",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  newsTypeController.update
);

router.delete(
  "/:id",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  newsTypeController.delete
);

module.exports = router;

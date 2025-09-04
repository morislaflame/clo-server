const Router = require("express");
const router = new Router();
const productController = require("../controllers/productController");
const authMiddleware = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/checkRoleMiddleware");
const uploadMiddleware = require("../middlewares/uploadMiddleware");
const {
  adminLimiter,
  userLimiter,
} = require("../utilities/ApiLimiter");

// Конфигурация для загрузки медиафайлов продуктов
const productUploadConfig = {
  fields: [
    {
      name: "media",
      maxCount: 10, // Максимум 10 файлов за раз
    },
  ],
  filterCriteria: [
    {
      mediaType: "IMAGE",
      maxSize: 10 * 1024 * 1024, // 10MB для изображений
    },
    {
      mediaType: "VIDEO",
      maxSize: 100 * 1024 * 1024, // 100MB для видео
    },
  ],
};

// Публичные маршруты (получение продуктов)
router.get("/", userLimiter, productController.getAll);
router.get("/:id", userLimiter, productController.getOne);

// Маршруты для админов (создание, обновление, удаление)
router.post(
  "/",
  authMiddleware,
  checkRole("ADMIN"),
  uploadMiddleware(productUploadConfig),
  adminLimiter,
  productController.create
);

router.put(
  "/:id",
  authMiddleware,
  checkRole("ADMIN"),
  uploadMiddleware(productUploadConfig),
  adminLimiter,
  productController.update
);

router.delete(
  "/:id",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  productController.delete
);

// Удаление медиафайла продукта
router.delete(
  "/:productId/media/:mediaId",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  productController.deleteMedia
);

module.exports = router;
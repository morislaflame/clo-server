const Router = require("express");
const router = new Router();
const collectionController = require("../controllers/collectionController");
const authMiddleware = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/checkRoleMiddleware");
const uploadMiddleware = require("../middlewares/uploadMiddleware");
const {
  adminLimiter,
  userLimiter,
} = require("../utilities/ApiLimiter");

// Конфигурация для загрузки медиафайлов коллекций
const collectionUploadConfig = {
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

// Публичные маршруты (получение коллекций)
router.get("/", userLimiter, collectionController.getAll);
router.get("/:id", userLimiter, collectionController.getOne);
router.get("/:id/products", userLimiter, collectionController.getProducts);

// Маршруты для админов (создание, обновление, удаление)
router.post(
  "/",
  authMiddleware,
  checkRole("ADMIN"),
  uploadMiddleware(collectionUploadConfig),
  adminLimiter,
  collectionController.create
);

router.put(
  "/:id",
  authMiddleware,
  checkRole("ADMIN"),
  uploadMiddleware(collectionUploadConfig),
  adminLimiter,
  collectionController.update
);

router.delete(
  "/:id",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  collectionController.delete
);

// Удаление медиафайла коллекции
router.delete(
  "/:collectionId/media/:mediaId",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  collectionController.deleteMedia
);

// Управление продуктами в коллекции
router.post(
  "/:collectionId/products/:productId",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  collectionController.addProduct
);

router.delete(
  "/:collectionId/products/:productId",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  collectionController.removeProduct
);

module.exports = router;

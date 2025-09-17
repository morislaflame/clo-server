const Router = require("express");
const router = new Router();
const newsController = require("../controllers/newsController");
const authMiddleware = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/checkRoleMiddleware");
const uploadMiddleware = require("../middlewares/uploadMiddleware");
const {
  adminLimiter,
  userLimiter,
} = require("../utilities/ApiLimiter");

// Конфигурация для загрузки медиафайлов новостей
const newsUploadConfig = {
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

// Публичные маршруты (получение новостей)
router.get("/", userLimiter, newsController.getAll);
router.get("/:id", userLimiter, newsController.getOne);

// Маршруты для админов (создание, обновление, удаление)
router.post(
  "/",
  authMiddleware,
  checkRole("ADMIN"),
  uploadMiddleware(newsUploadConfig),
  adminLimiter,
  newsController.create
);

router.put(
  "/:id",
  authMiddleware,
  checkRole("ADMIN"),
  uploadMiddleware(newsUploadConfig),
  adminLimiter,
  newsController.update
);

router.delete(
  "/:id",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  newsController.delete
);

// Удаление медиафайла новости
router.delete(
  "/:newsId/media/:mediaId",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  newsController.deleteMedia
);

module.exports = router;

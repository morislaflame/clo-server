const Router = require("express");
const router = new Router();
const mainBannerController = require("../controllers/mainBannerController");
const authMiddleware = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/checkRoleMiddleware");
const uploadMiddleware = require("../middlewares/uploadMiddleware");
const {
  adminLimiter,
  userLimiter,
} = require("../utilities/ApiLimiter");

// Конфигурация для загрузки медиафайлов главного баннера
const mainBannerUploadConfig = {
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
  ],
};

// Публичные маршруты (получение активного главного баннера)
router.get("/active", userLimiter, mainBannerController.getActive);

// Маршруты для админов (создание, обновление, удаление)
router.post(
  "/",
  authMiddleware,
  checkRole("ADMIN"),
  uploadMiddleware(mainBannerUploadConfig),
  adminLimiter,
  mainBannerController.create
);

router.get(
  "/",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  mainBannerController.getAll
);

router.get(
  "/:id",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  mainBannerController.getOne
);

router.put(
  "/:id",
  authMiddleware,
  checkRole("ADMIN"),
  uploadMiddleware(mainBannerUploadConfig),
  adminLimiter,
  mainBannerController.update
);

router.delete(
  "/:id",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  mainBannerController.delete
);

// Удаление медиафайла главного баннера
router.delete(
  "/:mainBannerId/media/:mediaId",
  authMiddleware,
  checkRole("ADMIN"),
  adminLimiter,
  mainBannerController.deleteMedia
);

module.exports = router;

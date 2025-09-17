const Router = require("express");
const router = new Router();
const basketController = require("../controllers/basketController");
const authMiddleware = require("../middlewares/authMiddleware");
const { userLimiter } = require("../utilities/ApiLimiter");

// Все маршруты корзины требуют аутентификации
router.use(authMiddleware);

// Получение корзины пользователя
router.get("/", userLimiter, basketController.getBasket);

// Получение количества товаров в корзине
router.get("/count", userLimiter, basketController.getBasketCount);

// Проверка, находится ли товар в корзине
router.get("/check/:productId", userLimiter, basketController.checkInBasket);

// Добавление товара в корзину
router.post("/add", userLimiter, basketController.addToBasket);

// Удаление товара из корзины
router.delete("/remove/:basketItemId", userLimiter, basketController.removeFromBasket);

// Обновление количества товара в корзине
router.patch("/update-quantity/:basketItemId", userLimiter, basketController.updateQuantity);

// Очистка всей корзины
router.delete("/clear", userLimiter, basketController.clearBasket);

module.exports = router;
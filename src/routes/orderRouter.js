const Router = require("express");
const router = new Router();
const orderController = require("../controllers/orderController");
const authMiddleware = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/checkRoleMiddleware");
const {
  adminLimiter,
  userLimiter,
} = require("../utilities/ApiLimiter");

// Все маршруты заказов требуют аутентификации
router.use(authMiddleware);

// === ПОЛЬЗОВАТЕЛЬСКИЕ МАРШРУТЫ ===

// Создание гостевого заказа (товары передаются в запросе)
router.post("/guest", userLimiter, orderController.createGuestOrder);

// Создание заказа из корзины
router.post("/create", userLimiter, orderController.createOrder);

// Получение заказов пользователя
router.get("/my-orders", userLimiter, orderController.getUserOrders);

// Получение одного заказа пользователя
router.get("/my-orders/:orderId", userLimiter, orderController.getUserOrder);

// Отмена заказа пользователем
router.patch("/my-orders/:orderId/cancel", userLimiter, orderController.cancelOrder);

// === АДМИНСКИЕ МАРШРУТЫ ===

// Получение всех заказов (только для админов)
router.get("/", checkRole("ADMIN"), adminLimiter, orderController.getAllOrders);

// Получение одного заказа (только для админов)
router.get("/:orderId", checkRole("ADMIN"), adminLimiter, orderController.getOrder);

// Обновление статуса заказа (только для админов)
router.patch("/:orderId/status", checkRole("ADMIN"), adminLimiter, orderController.updateOrderStatus);

// Получение статистики заказов (только для админов)
router.get("/stats/overview", checkRole("ADMIN"), adminLimiter, orderController.getOrderStats);

module.exports = router;

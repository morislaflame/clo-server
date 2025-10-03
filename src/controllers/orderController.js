const ApiError = require("../errors/ApiError");
const sequelize = require("../db");
const { Op } = require("sequelize");
const {
  Order,
  OrderItem,
  Product,
  MediaFile,
  ClothingType,
  Collection,
  Size,
  Color,
  BasketItem,
  User,
} = require("../models/models");

class OrderController {
  // Создание гостевого заказа (без корзины, товары передаются в запросе)
  async createGuestOrder(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const userId = req.user.id;
      const { 
        recipientName, 
        recipientAddress,
        recipientPhone,
        recipientEmail,
        paymentMethod, 
        notes,
        items // Массив товаров из локальной корзины
      } = req.body;

      // Валидация обязательных полей
      if (!recipientName || !recipientAddress || !paymentMethod || !items || items.length === 0) {
        await transaction.rollback();
        return next(ApiError.badRequest("Recipient name, address, payment method and items are required"));
      }

      // Подсчитываем общую стоимость и проверяем товары
      let totalKZT = 0;
      let totalUSD = 0;

      for (const item of items) {
        const product = await Product.findByPk(item.productId, { transaction });
        
        if (!product) {
          await transaction.rollback();
          return next(ApiError.notFound(`Product ${item.productId} not found`));
        }

        if (product.status !== "AVAILABLE") {
          await transaction.rollback();
          return next(ApiError.badRequest(`Product ${product.name} is not available`));
        }

        totalKZT += product.priceKZT * item.quantity;
        totalUSD += product.priceUSD * item.quantity;
      }

      // Создаем заказ
      const order = await Order.create(
        {
          userId,
          recipientName,
          recipientAddress,
          recipientPhone,
          recipientEmail,
          paymentMethod,
          totalKZT,
          totalUSD,
          notes: notes || null,
          status: "CREATED",
        },
        { transaction }
      );

      // Создаем элементы заказа
      for (const item of items) {
        const product = await Product.findByPk(item.productId, { transaction });
        
        await OrderItem.create(
          {
            orderId: order.id,
            productId: item.productId,
            selectedColorId: item.selectedColorId || null,
            selectedSizeId: item.selectedSizeId || null,
            quantity: item.quantity,
            priceKZT: product.priceKZT,
            priceUSD: product.priceUSD,
          },
          { transaction }
        );
      }

      await transaction.commit();

      // Получаем созданный заказ с полной информацией
      const createdOrder = await Order.findByPk(order.id, {
        include: [
          {
            model: OrderItem,
            as: "orderItems",
            include: [
              {
                model: Product,
                as: "product",
                include: [
                  {
                    model: MediaFile,
                    as: "mediaFiles",
                    where: { entityType: "product" },
                    required: false,
                  },
                  {
                    model: ClothingType,
                    as: "clothingType",
                    required: false,
                  },
                  {
                    model: Collection,
                    as: "collection",
                    required: false,
                  },
                ],
              },
              {
                model: Color,
                as: "selectedColor",
                required: false,
              },
              {
                model: Size,
                as: "selectedSize",
                required: false,
              },
            ],
          },
        ],
      });

      return res.json({
        message: "Order created successfully",
        order: createdOrder,
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error creating guest order:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Создание заказа из корзины
  async createOrder(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const userId = req.user.id;
      const { 
        recipientName, 
        recipientAddress, 
        paymentMethod, 
        notes 
      } = req.body;

      // Валидация обязательных полей
      if (!recipientName || !recipientAddress || !paymentMethod) {
        await transaction.rollback();
        return next(ApiError.badRequest("Recipient name, address and payment method are required"));
      }

      // Получаем все товары из корзины пользователя
      const basketItems = await BasketItem.findAll({
        where: { userId },
        include: [
          {
            model: Product,
            as: "product",
            include: [
              {
                model: MediaFile,
                as: "mediaFiles",
                where: { entityType: "product" },
                required: false,
              },
              {
                model: ClothingType,
                as: "clothingType",
                required: false,
              },
              {
                model: Collection,
                as: "collection",
                required: false,
              },
            ],
          },
          {
            model: Color,
            as: "selectedColor",
            required: false,
          },
          {
            model: Size,
            as: "selectedSize",
            required: false,
          },
        ],
        transaction,
      });

      if (basketItems.length === 0) {
        await transaction.rollback();
        return next(ApiError.badRequest("Basket is empty"));
      }

      // Подсчитываем общую стоимость
      let totalKZT = 0;
      let totalUSD = 0;

      basketItems.forEach(item => {
        if (item.product) {
          totalKZT += item.product.priceKZT * item.quantity;
          totalUSD += item.product.priceUSD * item.quantity;
        }
      });

      // Создаем заказ
      const order = await Order.create(
        {
          userId,
          recipientName,
          recipientAddress,
          paymentMethod,
          totalKZT,
          totalUSD,
          notes: notes || null,
          status: "CREATED",
        },
        { transaction }
      );

      // Создаем элементы заказа
      for (const basketItem of basketItems) {
        await OrderItem.create(
          {
            orderId: order.id,
            productId: basketItem.productId,
            selectedColorId: basketItem.selectedColorId,
            selectedSizeId: basketItem.selectedSizeId,
            quantity: basketItem.quantity,
            priceKZT: basketItem.product.priceKZT,
            priceUSD: basketItem.product.priceUSD,
          },
          { transaction }
        );
      }

      // Очищаем корзину после создания заказа
      await BasketItem.destroy({
        where: { userId },
        transaction,
      });

      await transaction.commit();

      // Получаем созданный заказ с полной информацией
      const createdOrder = await Order.findByPk(order.id, {
        include: [
          {
            model: OrderItem,
            as: "orderItems",
            include: [
              {
                model: Product,
                as: "product",
                include: [
                  {
                    model: MediaFile,
                    as: "mediaFiles",
                    where: { entityType: "product" },
                    required: false,
                  },
                  {
                    model: ClothingType,
                    as: "clothingType",
                    required: false,
                  },
                  {
                    model: Collection,
                    as: "collection",
                    required: false,
                  },
                ],
              },
              {
                model: Color,
                as: "selectedColor",
                required: false,
              },
              {
                model: Size,
                as: "selectedSize",
                required: false,
              },
            ],
          },
        ],
      });

      return res.json({
        message: "Order created successfully",
        order: createdOrder,
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error creating order:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение заказов пользователя
  async getUserOrders(req, res, next) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10, status } = req.query;

      const offset = (page - 1) * limit;
      const where = { userId };

      if (status) {
        where.status = status;
      }

      const { count, rows: orders } = await Order.findAndCountAll({
        where,
        distinct: true,
        col: 'id',
        include: [
          {
            model: OrderItem,
            as: "orderItems",
            include: [
              {
                model: Product,
                as: "product",
                include: [
                  {
                    model: MediaFile,
                    as: "mediaFiles",
                    where: { entityType: "product" },
                    required: false,
                  },
                  {
                    model: ClothingType,
                    as: "clothingType",
                    required: false,
                  },
                  {
                    model: Collection,
                    as: "collection",
                    required: false,
                  },
                ],
              },
              {
                model: Color,
                as: "selectedColor",
                required: false,
              },
              {
                model: Size,
                as: "selectedSize",
                required: false,
              },
            ],
          },
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["createdAt", "DESC"]],
      });

      return res.json({
        orders,
        totalCount: count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
      });
    } catch (e) {
      console.error("Error getting user orders:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение одного заказа пользователя
  async getUserOrder(req, res, next) {
    try {
      const userId = req.user.id;
      const { orderId } = req.params;

      const order = await Order.findOne({
        where: { id: orderId, userId },
        include: [
          {
            model: OrderItem,
            as: "orderItems",
            include: [
              {
                model: Product,
                as: "product",
                include: [
                  {
                    model: MediaFile,
                    as: "mediaFiles",
                    where: { entityType: "product" },
                    required: false,
                  },
                  {
                    model: ClothingType,
                    as: "clothingType",
                    required: false,
                  },
                  {
                    model: Collection,
                    as: "collection",
                    required: false,
                  },
                ],
              },
              {
                model: Color,
                as: "selectedColor",
                required: false,
              },
              {
                model: Size,
                as: "selectedSize",
                required: false,
              },
            ],
          },
        ],
      });

      if (!order) {
        return next(ApiError.notFound("Order not found"));
      }

      return res.json(order);
    } catch (e) {
      console.error("Error getting user order:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Отмена заказа пользователем (только если статус CREATED)
  async cancelOrder(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const userId = req.user.id;
      const { orderId } = req.params;

      const order = await Order.findOne({
        where: { id: orderId, userId },
        transaction,
      });

      if (!order) {
        await transaction.rollback();
        return next(ApiError.notFound("Order not found"));
      }

      if (order.status !== "CREATED") {
        await transaction.rollback();
        return next(ApiError.badRequest("Only orders with CREATED status can be cancelled"));
      }

      await order.update({ status: "CANCELLED" }, { transaction });
      await transaction.commit();

      return res.json({
        message: "Order cancelled successfully",
        order,
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error cancelling order:", e);
      next(ApiError.internal(e.message));
    }
  }

  // === АДМИНСКИЕ МЕТОДЫ ===

  // Получение всех заказов (для админов)
  async getAllOrders(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        status, 
        userId,
        paymentMethod,
        startDate,
        endDate 
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {};

      if (status) where.status = status;
      if (userId) where.userId = userId;
      if (paymentMethod) where.paymentMethod = paymentMethod;

      // Фильтр по дате
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
      }

      const { count, rows: orders } = await Order.findAndCountAll({
        where,
        distinct: true,
        col: 'id',
        include: [
          {
            model: OrderItem,
            as: "orderItems",
            include: [
              {
                model: Product,
                as: "product",
                include: [
                  {
                    model: MediaFile,
                    as: "mediaFiles",
                    where: { entityType: "product" },
                    required: false,
                  },
                  {
                    model: ClothingType,
                    as: "clothingType",
                    required: false,
                  },
                  {
                    model: Collection,
                    as: "collection",
                    required: false,
                  },
                ],
              },
              {
                model: Color,
                as: "selectedColor",
                required: false,
              },
              {
                model: Size,
                as: "selectedSize",
                required: false,
              },
            ],
          },
          {
            model: User,
            as: "user",
            attributes: ["id", "email", "isGuest"],
          },
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["createdAt", "DESC"]],
      });

      return res.json({
        orders,
        totalCount: count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
      });
    } catch (e) {
      console.error("Error getting all orders:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение одного заказа (для админов)
  async getOrder(req, res, next) {
    try {
      const { orderId } = req.params;

      const order = await Order.findByPk(orderId, {
        include: [
          {
            model: OrderItem,
            as: "orderItems",
            include: [
              {
                model: Product,
                as: "product",
                include: [
                  {
                    model: MediaFile,
                    as: "mediaFiles",
                    where: { entityType: "product" },
                    required: false,
                  },
                  {
                    model: ClothingType,
                    as: "clothingType",
                    required: false,
                  },
                  {
                    model: Collection,
                    as: "collection",
                    required: false,
                  },
                ],
              },
              {
                model: Color,
                as: "selectedColor",
                required: false,
              },
              {
                model: Size,
                as: "selectedSize",
                required: false,
              },
            ],
          },
          {
            model: User,
            as: "user",
            attributes: ["id", "email"],
          },
        ],
      });

      if (!order) {
        return next(ApiError.notFound("Order not found"));
      }

      return res.json(order);
    } catch (e) {
      console.error("Error getting order:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Обновление статуса заказа (для админов)
  async updateOrderStatus(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { orderId } = req.params;
      const { status, notes } = req.body;

      if (!status) {
        await transaction.rollback();
        return next(ApiError.badRequest("Status is required"));
      }

      const validStatuses = ["CREATED", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];
      if (!validStatuses.includes(status)) {
        await transaction.rollback();
        return next(ApiError.badRequest("Invalid status"));
      }

      const order = await Order.findByPk(orderId, { transaction });

      if (!order) {
        await transaction.rollback();
        return next(ApiError.notFound("Order not found"));
      }

      const updateData = { status };
      if (notes !== undefined) updateData.notes = notes;

      await order.update(updateData, { transaction });
      await transaction.commit();

      // Получаем обновленный заказ с полной информацией
      const updatedOrder = await Order.findByPk(orderId, {
        include: [
          {
            model: OrderItem,
            as: "orderItems",
            include: [
              {
                model: Product,
                as: "product",
                include: [
                  {
                    model: MediaFile,
                    as: "mediaFiles",
                    where: { entityType: "product" },
                    required: false,
                  },
                  {
                    model: ClothingType,
                    as: "clothingType",
                    required: false,
                  },
                  {
                    model: Collection,
                    as: "collection",
                    required: false,
                  },
                ],
              },
              {
                model: Color,
                as: "selectedColor",
                required: false,
              },
              {
                model: Size,
                as: "selectedSize",
                required: false,
              },
            ],
          },
          {
            model: User,
            as: "user",
            attributes: ["id", "email", "isGuest"],
          },
        ],
      });

      return res.json({
        message: "Order status updated successfully",
        order: updatedOrder,
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error updating order status:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение статистики заказов (для админов)
  async getOrderStats(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      const where = {};
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
      }

      // Общее количество заказов
      const totalOrders = await Order.count({ where });

      // Заказы по статусам
      const ordersByStatus = await Order.findAll({
        where,
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true,
      });

      // Общая сумма заказов
      const totalRevenue = await Order.findAll({
        where,
        attributes: [
          [sequelize.fn('SUM', sequelize.col('totalKZT')), 'totalKZT'],
          [sequelize.fn('SUM', sequelize.col('totalUSD')), 'totalUSD']
        ],
        raw: true,
      });

      // Заказы по способам оплаты
      const ordersByPayment = await Order.findAll({
        where,
        attributes: [
          'paymentMethod',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['paymentMethod'],
        raw: true,
      });

      return res.json({
        totalOrders,
        ordersByStatus,
        totalRevenue: totalRevenue[0] || { totalKZT: 0, totalUSD: 0 },
        ordersByPayment,
      });
    } catch (e) {
      console.error("Error getting order stats:", e);
      next(ApiError.internal(e.message));
    }
  }
}

module.exports = new OrderController();

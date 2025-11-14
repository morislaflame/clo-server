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
const tipTopPayService = require("../services/tipTopPayService");

class OrderController {
  // Создание гостевого заказа (без корзины, товары передаются в запросе)
  async createGuestOrder(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const userId = req.user?.id || null;
      const { 
        recipientName, 
        recipientAddress,
        recipientPhone,
        recipientEmail,
        notes,
        items // Массив товаров из локальной корзины
      } = req.body;

      // Валидация обязательных полей
      if (!recipientName || !recipientAddress || !items || items.length === 0) {
        await transaction.rollback();
        return next(ApiError.badRequest("Recipient name, address and items are required"));
      }

       // Для гостевых заказов обязательны email и телефон
    if (!userId && (!recipientPhone || !recipientEmail)) {
      await transaction.rollback();
      return next(ApiError.badRequest("Phone and email are required for guest orders"));
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
          paymentMethod: "TIPTOP_PAY",
          totalKZT,
          totalUSD,
          notes: notes || null,
          status: "CREATED",
          paymentStatus: "PENDING",
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

      // Возвращаем данные для виджета TipTopPay
      return res.json({
        message: "Order created successfully",
        order: createdOrder,
        paymentData: {
          publicId: tipTopPayService.publicId,
          orderId: order.id,
          amount: totalKZT, // Сумма в тенге
          currency: "KZT",
          description: `Оплата заказа #${order.id}`,
        },
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
        notes 
      } = req.body;

      // Валидация обязательных полей
      if (!recipientName || !recipientAddress) {
        await transaction.rollback();
        return next(ApiError.badRequest("Recipient name and address are required"));
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
          paymentMethod: "TIPTOP_PAY",
          totalKZT,
          totalUSD,
          notes: notes || null,
          status: "CREATED",
          paymentStatus: "PENDING",
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

      // Возвращаем данные для виджета TipTopPay
      return res.json({
        message: "Order created successfully",
        order: createdOrder,
        paymentData: {
          publicId: tipTopPayService.publicId,
          orderId: order.id,
          amount: totalKZT, // Сумма в тенге
          currency: "KZT",
          description: `Оплата заказа #${order.id}`,
        },
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

  // Обработка webhook от TipTopPay
  async handleTipTopPayWebhook(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      // Логируем входящий webhook для отладки
      console.log('=== TipTopPay Webhook Received ===');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Body type:', typeof req.body);
      console.log('Body:', req.body);
      console.log('Raw body:', JSON.stringify(req.body, null, 2));
      
      // TipTopPay отправляет данные в формате form-urlencoded
      // Express автоматически парсит их в объект
      const notificationData = req.body;
      
      // Подпись приходит в заголовках content-hmac или x-content-hmac
      const signature = req.headers['x-content-hmac'] || req.headers['content-hmac'] || req.headers['x-signature'] || req.headers['signature'];

      console.log('Signature from headers:', signature);

      // Проверяем, что данные пришли
      if (!notificationData || Object.keys(notificationData).length === 0) {
        await transaction.rollback();
        console.error('Empty notification data received');
        return res.status(400).json({ error: 'Empty notification data' });
      }

      // Временно логируем проверку подписи (для отладки)
      if (signature) {
        const isValid = tipTopPayService.verifyNotificationSignature(notificationData, signature);
        console.log('Signature validation result:', isValid);
        console.log('Received signature:', signature);
        
        if (!isValid) {
          const calculatedSignature = tipTopPayService.generateSignature(notificationData);
          console.log('Calculated signature:', calculatedSignature);
          console.log('Notification data keys:', Object.keys(notificationData).sort());
          console.log('Notification data values:', Object.values(notificationData));
        }
      } else {
        console.warn('No signature header found');
      }

      // ВРЕМЕННО: Отключаем проверку подписи для отладки
      // Раскомментируйте после того, как убедитесь, что webhook работает
      // if (!signature || !tipTopPayService.verifyNotificationSignature(notificationData, signature)) {
      //   await transaction.rollback();
      //   console.error('Invalid webhook signature');
      //   return res.status(401).json({ error: 'Invalid signature' });
      // }

      // TipTopPay отправляет данные в формате:
      // InvoiceId - это externalId (ID заказа в нашей системе)
      // OperationType - тип операции (Payment, Refund и т.д.)
      // Status - статус операции (Completed, Failed и т.д.)
      // TransactionId - ID транзакции в TipTopPay
      const operationType = notificationData.OperationType || notificationData.operationType || notificationData.type || notificationData.Type;
      const transactionId = notificationData.TransactionId || notificationData.transactionId;
      // InvoiceId - это старое название externalId в TipTopPay
      const externalId = notificationData.InvoiceId || notificationData.invoiceId || notificationData.externalId || notificationData.ExternalId || notificationData.external_id;
      const status = notificationData.Status || notificationData.status;
      const amount = notificationData.Amount || notificationData.amount || notificationData.PaymentAmount || notificationData.paymentAmount;
      
      console.log('Webhook parsed data:', { operationType, transactionId, externalId, status, amount });
      console.log('All notification keys:', Object.keys(notificationData));

      if (!externalId) {
        await transaction.rollback();
        console.error('No InvoiceId/externalId in webhook data. Available keys:', Object.keys(notificationData));
        console.error('Full notification data:', notificationData);
        return res.status(400).json({ error: 'InvoiceId/externalId is required' });
      }

      // Находим заказ по externalId (который мы передали при создании платежа)
      const orderId = parseInt(externalId);
      const order = await Order.findByPk(orderId, { transaction });

      if (!order) {
        await transaction.rollback();
        console.error(`Order ${orderId} not found for webhook`);
        return res.status(404).json({ error: 'Order not found' });
      }

      console.log(`Found order ${order.id} with current status: ${order.status}, paymentStatus: ${order.paymentStatus}`);

      // Обновляем данные о платеже
      const updateData = {
        tipTopPayTransactionId: transactionId,
      };

      // Обрабатываем разные типы операций и статусы
      // OperationType может быть: Payment, Refund, Cancel и т.д.
      // Status может быть: Completed, Failed, Cancelled и т.д.
      if (operationType === 'Payment' || operationType === 'payment') {
        if (status === 'Completed' || status === 'completed' || status === 'success' || status === 'Success') {
          updateData.paymentStatus = 'SUCCESS';
          updateData.status = 'PAID';
          console.log('Payment completed successfully, updating order to PAID');
        } else if (status === 'Failed' || status === 'failed') {
          updateData.paymentStatus = 'FAILED';
          console.log('Payment failed');
        } else if (status === 'Cancelled' || status === 'cancelled') {
          updateData.paymentStatus = 'CANCELLED';
          console.log('Payment cancelled');
        }
      } else if (operationType === 'Refund' || operationType === 'refund') {
        if (status === 'Completed' || status === 'completed' || status === 'success' || status === 'Success') {
          updateData.paymentStatus = 'CANCELLED';
          console.log('Refund completed successfully');
        }
      } else if (operationType === 'Cancel' || operationType === 'cancel') {
        updateData.paymentStatus = 'CANCELLED';
        console.log('Payment cancelled');
      } else {
        // Для обратной совместимости с другими форматами уведомлений
        if (status === 'Completed' || status === 'completed' || status === 'success' || status === 'Success') {
          updateData.paymentStatus = 'SUCCESS';
          updateData.status = 'PAID';
          console.log(`Operation ${operationType} completed, updating order to PAID`);
        } else if (status === 'Failed' || status === 'failed') {
          updateData.paymentStatus = 'FAILED';
          console.log(`Operation ${operationType} failed`);
        }
      }

      console.log('Update data:', updateData);
      
      // Обновляем заказ
      const [updatedRowsCount] = await order.update(updateData, { transaction });

      if (updatedRowsCount === 0) {
        await transaction.rollback();
        console.error(`Failed to update order ${orderId}`);
        return res.status(500).json({ success: false, error: 'Failed to update order' });
      }

      await transaction.commit();

      // Проверяем обновленный заказ
      const updatedOrder = await Order.findByPk(orderId);
      if (updatedOrder) {
        console.log(`Order ${order.id} updated successfully. New status: ${updatedOrder.status}, paymentStatus: ${updatedOrder.paymentStatus}`);
      } else {
        console.warn(`Could not fetch updated order ${orderId} for verification`);
      }

      // Возвращаем успешный ответ TipTopPay
      // Важно: HTTP 200 означает успешную обработку уведомления
      return res.status(200).json({ success: true });
    } catch (e) {
      await transaction.rollback();
      console.error("Error handling TipTopPay webhook:", e);
      console.error("Stack:", e.stack);
      // Возвращаем ошибку, чтобы TipTopPay знал о проблеме
      return res.status(500).json({ success: false, error: e.message });
    }
  }
}

module.exports = new OrderController();

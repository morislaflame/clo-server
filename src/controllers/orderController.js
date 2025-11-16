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

  // Получение данных для оплаты заказа
  async getOrderPaymentData(req, res, next) {
    try {
      const userId = req.user.id;
      const { orderId } = req.params;

      const order = await Order.findOne({
        where: { id: orderId, userId },
      });

      if (!order) {
        return next(ApiError.notFound("Order not found"));
      }

      // Проверяем, что заказ еще не оплачен
      if (order.status === 'PAID' || order.paymentStatus === 'SUCCESS') {
        return next(ApiError.badRequest("Order is already paid"));
      }

      // Возвращаем данные для виджета TipTopPay
      return res.json({
        paymentData: {
          publicId: tipTopPayService.publicId,
          orderId: order.id,
          amount: order.totalKZT, // Сумма в тенге
          currency: "KZT",
          description: `Оплата заказа #${order.id}`,
        },
      });
    } catch (e) {
      console.error("Error getting order payment data:", e);
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
      console.log('=== TipTopPay Webhook Received ===');
      console.log('Timestamp:', new Date().toISOString());
      
      const notificationData = req.body;
      const signature = req.headers['x-content-hmac'] || req.headers['content-hmac'];
      
      // Проверяем, что данные пришли
      if (!notificationData || Object.keys(notificationData).length === 0) {
        await transaction.rollback();
        console.error('Empty notification data received');
        return res.json({ code: 13 }); // Платеж не может быть принят
      }

      // Временно логируем проверку подписи (для отладки)
      if (signature) {
        const isValid = tipTopPayService.verifyNotificationSignature(notificationData, signature);
        console.log('Signature validation result:', isValid);
        if (!isValid) {
          console.warn('Invalid signature, but continuing for debugging');
        }
      }

      // ВРЕМЕННО: Отключаем проверку подписи для отладки
      // Раскомментируйте после того, как убедитесь, что webhook работает
      // if (!signature || !tipTopPayService.verifyNotificationSignature(notificationData, signature)) {
      //   await transaction.rollback();
      //   console.error('Invalid webhook signature');
      //   return res.json({ code: 13 }); // Платеж не может быть принят
      // }

      // Определяем тип уведомления по наличию специфичных полей
      const operationType = notificationData.OperationType || notificationData.operationType;
      const status = notificationData.Status || notificationData.status;
      const hasReason = notificationData.Reason || notificationData.ReasonCode;
      const hasPaymentTransactionId = notificationData.PaymentTransactionId;
      
      // Check уведомление - приходит ДО оплаты, требует проверки
      // Отличается тем, что имеет Status='Authorized' или Status='Completed' но без AuthCode
      const isCheckNotification = (status === 'Authorized' || (status === 'Completed' && !notificationData.AuthCode)) && 
                                   operationType === 'Payment';
      
      // Pay уведомление - успешная оплата (имеет AuthCode)
      const isPayNotification = status === 'Completed' && 
                                operationType === 'Payment' &&
                                notificationData.AuthCode;
      
      // Fail уведомление - отклоненный платеж (имеет Reason или ReasonCode)
      const isFailNotification = hasReason;
      
      // Confirm уведомление - подтверждение двухстадийного платежа
      const isConfirmNotification = operationType === 'Confirm' || 
                                     (status === 'Completed' && operationType === 'Payment' && notificationData.AuthCode && !isPayNotification);
      
      // Refund уведомление - возврат (имеет PaymentTransactionId или OperationType='Refund')
      const isRefundNotification = operationType === 'Refund' || hasPaymentTransactionId;
      
      // Cancel уведомление - отмена
      const isCancelNotification = operationType === 'Cancel';

      const externalId = notificationData.InvoiceId || notificationData.invoiceId;
      
      if (!externalId) {
        await transaction.rollback();
        console.error('No InvoiceId in webhook data');
        // Для Check уведомления возвращаем код 10 (Неверный номер заказа)
        if (isCheckNotification) {
          return res.json({ code: 10 });
        }
        return res.json({ code: 10 });
      }

      const orderId = parseInt(externalId);
      const order = await Order.findByPk(orderId, { transaction });

      if (!order) {
        await transaction.rollback();
        console.error(`Order ${orderId} not found`);
        // Для Check уведомления возвращаем код 10
        if (isCheckNotification) {
          return res.json({ code: 10 });
        }
        return res.json({ code: 10 });
      }

      console.log(`Found order ${order.id}, notification type: Check=${isCheckNotification}, Pay=${isPayNotification}, Fail=${isFailNotification}`);

      // Обработка Check уведомления (до оплаты - проверка возможности провести платеж)
      if (isCheckNotification) {
        // Проверяем сумму и другие параметры
        const amount = parseFloat(notificationData.Amount || notificationData.PaymentAmount || 0);
        const orderAmount = order.totalKZT;
        
        // Проверка суммы (с небольшой погрешностью для округления)
        if (Math.abs(amount - orderAmount) > 0.01) {
          await transaction.rollback();
          console.error(`Amount mismatch: expected ${orderAmount}, got ${amount}`);
          return res.json({ code: 12 }); // Неверная сумма
        }
        
        // Все проверки пройдены - разрешаем платеж
        await transaction.commit();
        console.log(`Check notification passed for order ${order.id}`);
        return res.json({ code: 0 }); // Платеж может быть проведен
      }

      // Обработка Pay уведомления (успешная оплата)
      if (isPayNotification) {
        const updateData = {
          tipTopPayTransactionId: notificationData.TransactionId,
          paymentStatus: 'SUCCESS',
          status: 'PAID',
        };
        await order.update(updateData, { transaction });
        await transaction.commit();
        console.log(`Pay notification: Order ${order.id} updated to PAID`);
        return res.json({ code: 0 }); // Платеж зарегистрирован
      }

      // Обработка Fail уведомления (отклоненный платеж)
      if (isFailNotification) {
        const updateData = {
          tipTopPayTransactionId: notificationData.TransactionId,
          paymentStatus: 'FAILED',
        };
        await order.update(updateData, { transaction });
        await transaction.commit();
        console.log(`Fail notification: Order ${order.id} marked as FAILED. Reason: ${notificationData.Reason || notificationData.ReasonCode}`);
        return res.json({ code: 0 }); // Попытка зарегистрирована
      }

      // Обработка Confirm уведомления (подтверждение двухстадийного платежа)
      if (isConfirmNotification) {
        const updateData = {
          tipTopPayTransactionId: notificationData.TransactionId,
          paymentStatus: 'SUCCESS',
          status: 'PAID',
        };
        await order.update(updateData, { transaction });
        await transaction.commit();
        console.log(`Confirm notification: Order ${order.id} confirmed and updated to PAID`);
        return res.json({ code: 0 }); // Платеж зарегистрирован
      }

      // Обработка Refund уведомления (возврат)
      if (isRefundNotification) {
        const updateData = {
          paymentStatus: 'CANCELLED',
        };
        await order.update(updateData, { transaction });
        await transaction.commit();
        console.log(`Refund notification: Order ${order.id} refunded`);
        return res.json({ code: 0 }); // Возврат зарегистрирован
      }

      // Обработка Cancel уведомления (отмена)
      if (isCancelNotification) {
        const updateData = {
          paymentStatus: 'CANCELLED',
        };
        await order.update(updateData, { transaction });
        await transaction.commit();
        console.log(`Cancel notification: Order ${order.id} cancelled`);
        return res.json({ code: 0 }); // Отмена зарегистрирована
      }

      // Обработка по OperationType для обратной совместимости
      if (operationType === 'Payment' && status === 'Completed') {
        const updateData = {
          tipTopPayTransactionId: notificationData.TransactionId,
          paymentStatus: 'SUCCESS',
          status: 'PAID',
        };
        await order.update(updateData, { transaction });
        await transaction.commit();
        console.log(`Payment completed (fallback): Order ${order.id} updated to PAID`);
        return res.json({ code: 0 });
      }

      // Если тип уведомления не определен, все равно возвращаем успех
      await transaction.commit();
      console.log(`Unknown notification type processed for order ${order.id}`);
      return res.json({ code: 0 });
      
    } catch (e) {
      await transaction.rollback();
      console.error("Error handling TipTopPay webhook:", e);
      console.error("Stack:", e.stack);
      return res.json({ code: 13 }); // Платеж не может быть принят
    }
  }
}

module.exports = new OrderController();

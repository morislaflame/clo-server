const ApiError = require("../errors/ApiError");
const sequelize = require("../db");
const {
  BasketItem,
  Product,
  MediaFile,
  ClothingType,
  Collection,
  Size,
  Color,
} = require("../models/models");

class BasketController {
  // Получение всех товаров в корзине пользователя
  async getBasket(req, res, next) {
    try {
      const userId = req.user.id;

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
              {
                model: Size,
                as: "sizes",
                through: { attributes: [] },
                required: false,
              },
              {
                model: Color,
                as: "colors",
                through: { attributes: [] },
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
        order: [["createdAt", "DESC"]],
      });

      // Подсчитываем общую стоимость
      let totalKZT = 0;
      let totalUSD = 0;
      let itemsCount = 0;

      basketItems.forEach(item => {
        if (item.product) {
          totalKZT += item.product.priceKZT * item.quantity;
          totalUSD += item.product.priceUSD * item.quantity;
          itemsCount += item.quantity;
        }
      });

      return res.json({
        items: basketItems,
        summary: {
          itemsCount,
          totalKZT,
          totalUSD,
        },
      });
    } catch (e) {
      console.error("Error getting basket:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Добавление товара в корзину
  async addToBasket(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const userId = req.user.id;
      const { productId, selectedColorId, selectedSizeId } = req.body;

      if (!productId) {
        await transaction.rollback();
        return next(ApiError.badRequest("Product ID is required"));
      }

      // Проверяем, существует ли товар
      const product = await Product.findByPk(productId, { transaction });
      if (!product) {
        await transaction.rollback();
        return next(ApiError.notFound("Product not found"));
      }

      // Проверяем, доступен ли товар для покупки
      if (product.status !== "AVAILABLE") {
        await transaction.rollback();
        return next(ApiError.badRequest("Product is not available for purchase"));
      }

      // Валидация выбранного цвета
      if (selectedColorId) {
        const color = await Color.findByPk(selectedColorId, { transaction });
        if (!color) {
          await transaction.rollback();
          return next(ApiError.badRequest("Selected color not found"));
        }
        
        // Проверяем, что цвет доступен для этого товара
        const productColor = await product.getColors({ 
          where: { id: selectedColorId },
          transaction 
        });
        if (productColor.length === 0) {
          await transaction.rollback();
          return next(ApiError.badRequest("Selected color is not available for this product"));
        }
      }

      // Валидация выбранного размера
      if (selectedSizeId) {
        const size = await Size.findByPk(selectedSizeId, { transaction });
        if (!size) {
          await transaction.rollback();
          return next(ApiError.badRequest("Selected size not found"));
        }
        
        // Проверяем, что размер доступен для этого товара
        const productSize = await product.getSizes({ 
          where: { id: selectedSizeId },
          transaction 
        });
        if (productSize.length === 0) {
          await transaction.rollback();
          return next(ApiError.badRequest("Selected size is not available for this product"));
        }
      }

      // Проверяем, не добавлен ли уже этот товар с такими же характеристиками в корзину
      const existingItem = await BasketItem.findOne({
        where: { 
          userId, 
          productId, 
          selectedColorId: selectedColorId || null,
          selectedSizeId: selectedSizeId || null
        },
        transaction,
      });

      let basketItem;

      if (existingItem) {
        // Если товар уже есть, увеличиваем количество
        await existingItem.update(
          { quantity: existingItem.quantity + 1 },
          { transaction }
        );
        basketItem = existingItem;
      } else {
        // Если товара нет, создаем новую запись
        basketItem = await BasketItem.create(
          {
            userId,
            productId,
            selectedColorId: selectedColorId || null,
            selectedSizeId: selectedSizeId || null,
            quantity: 1,
          },
          { transaction }
        );
      }

      await transaction.commit();

      // Получаем созданный элемент корзины с информацией о товаре
      const createdItem = await BasketItem.findByPk(basketItem.id, {
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
              {
                model: Size,
                as: "sizes",
                through: { attributes: [] },
                required: false,
              },
              {
                model: Color,
                as: "colors",
                through: { attributes: [] },
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
      });

      return res.json({
        message: "Product added to basket successfully",
        item: createdItem,
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error adding to basket:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Удаление товара из корзины
  async removeFromBasket(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const userId = req.user.id;
      const { basketItemId } = req.params;

      if (!basketItemId) {
        await transaction.rollback();
        return next(ApiError.badRequest("Basket item ID is required"));
      }

      // Находим элемент корзины
      const basketItem = await BasketItem.findOne({
        where: { id: basketItemId, userId },
        transaction,
      });

      if (!basketItem) {
        await transaction.rollback();
        return next(ApiError.notFound("Basket item not found"));
      }

      // Удаляем элемент из корзины
      await basketItem.destroy({ transaction });

      await transaction.commit();

      return res.json({
        message: "Product removed from basket successfully",
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error removing from basket:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Обновление количества товара в корзине
  async updateQuantity(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const userId = req.user.id;
      const { basketItemId } = req.params;
      const { quantity } = req.body;

      if (!basketItemId) {
        await transaction.rollback();
        return next(ApiError.badRequest("Basket item ID is required"));
      }

      if (!quantity || quantity < 1) {
        await transaction.rollback();
        return next(ApiError.badRequest("Quantity must be at least 1"));
      }

      // Находим элемент корзины
      const basketItem = await BasketItem.findOne({
        where: { id: basketItemId, userId },
        transaction,
      });

      if (!basketItem) {
        await transaction.rollback();
        return next(ApiError.notFound("Basket item not found"));
      }

      // Обновляем количество
      await basketItem.update({ quantity }, { transaction });

      await transaction.commit();

      // Получаем обновленный элемент с информацией о товаре
      const updatedItem = await BasketItem.findByPk(basketItem.id, {
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
      });

      return res.json({
        message: "Quantity updated successfully",
        item: updatedItem,
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error updating quantity:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Очистка всей корзины
  async clearBasket(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const userId = req.user.id;

      // Удаляем все элементы корзины пользователя
      const deletedCount = await BasketItem.destroy({
        where: { userId },
        transaction,
      });

      await transaction.commit();

      return res.json({
        message: "Basket cleared successfully",
        deletedItems: deletedCount,
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error clearing basket:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение количества товаров в корзине
  async getBasketCount(req, res, next) {
    try {
      const userId = req.user.id;

      const count = await BasketItem.count({
        where: { userId },
      });

      return res.json({ count });
    } catch (e) {
      console.error("Error getting basket count:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Проверка, находится ли товар в корзине
  async checkInBasket(req, res, next) {
    try {
      const userId = req.user.id;
      const { productId } = req.params;

      if (!productId) {
        return next(ApiError.badRequest("Product ID is required"));
      }

      const basketItem = await BasketItem.findOne({
        where: { userId, productId },
      });

      return res.json({
        inBasket: !!basketItem,
        item: basketItem || null,
      });
    } catch (e) {
      console.error("Error checking basket status:", e);
      next(ApiError.internal(e.message));
    }
  }
}

module.exports = new BasketController();
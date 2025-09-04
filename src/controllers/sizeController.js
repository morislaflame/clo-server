const ApiError = require("../errors/ApiError");
const sequelize = require("../db");
const {
  Size,
  ProductSize,
  Product,
} = require("../models/models");

class SizeController {
  // Получение всех размеров
  async getAll(req, res, next) {
    try {
      const sizes = await Size.findAll({
        order: [['name', 'ASC']],
      });

      return res.json(sizes);
    } catch (e) {
      console.error("Error getting sizes:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Создание размера (только для админов)
  async create(req, res, next) {
    try {
      const { name } = req.body;

      if (!name) {
        return next(ApiError.badRequest("Size name is required"));
      }

      // Проверяем, не существует ли уже такой размер
      const existingSize = await Size.findOne({ where: { name } });
      if (existingSize) {
        return next(ApiError.badRequest("Size with this name already exists"));
      }

      const size = await Size.create({ name });
      return res.json(size);
    } catch (e) {
      console.error("Error creating size:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Создание стандартных размеров
  async createDefaultSizes(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const defaultSizes = ["XS", "S", "M", "L", "XL", "XXL"];
      const createdSizes = [];

      for (const sizeName of defaultSizes) {
        // Проверяем, не существует ли уже такой размер
        const existingSize = await Size.findOne({ 
          where: { name: sizeName },
          transaction 
        });

        if (!existingSize) {
          const size = await Size.create({ name: sizeName }, { transaction });
          createdSizes.push(size);
        }
      }

      await transaction.commit();

      return res.json({
        message: `Created ${createdSizes.length} default sizes`,
        createdSizes
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error creating default sizes:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Добавление размеров к продукту (только для админов)
  async addToProduct(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { productId } = req.params;
      const { sizeIds } = req.body; // массив ID размеров

      if (!sizeIds || !Array.isArray(sizeIds)) {
        await transaction.rollback();
        return next(ApiError.badRequest("sizeIds must be an array"));
      }

      // Проверяем существование продукта
      const product = await Product.findByPk(productId, { transaction });
      if (!product) {
        await transaction.rollback();
        return next(ApiError.notFound("Product not found"));
      }

      // Проверяем существование размеров
      const sizes = await Size.findAll({
        where: { id: sizeIds },
        transaction
      });

      if (sizes.length !== sizeIds.length) {
        await transaction.rollback();
        return next(ApiError.badRequest("Some sizes not found"));
      }

      // Добавляем размеры к продукту (заменяем существующие)
      await product.setSizes(sizes, { transaction });

      await transaction.commit();

      // Получаем обновленный продукт с размерами
      const updatedProduct = await Product.findByPk(productId, {
        include: [
          {
            model: Size,
            as: "sizes",
            through: { attributes: [] } // не включаем атрибуты промежуточной таблицы
          }
        ]
      });

      return res.json(updatedProduct);
    } catch (e) {
      await transaction.rollback();
      console.error("Error adding sizes to product:", e);
      next(ApiError.internal(e.message));
    }
  }


  // Удаление размера из продукта (только для админов)
  async removeFromProduct(req, res, next) {
    try {
      const { productId, sizeId } = req.params;

      // Проверяем существование связи
      const productSize = await ProductSize.findOne({
        where: { productId, sizeId }
      });

      if (!productSize) {
        return next(ApiError.notFound("Product size not found"));
      }

      await productSize.destroy();

      return res.json({ message: "Size removed from product successfully" });
    } catch (e) {
      console.error("Error removing size from product:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Удаление размера (только для админов)
  async delete(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;

      const size = await Size.findByPk(id, { transaction });
      if (!size) {
        await transaction.rollback();
        return next(ApiError.notFound("Size not found"));
      }

      // Проверяем, используется ли размер в продуктах
      const productSizeCount = await ProductSize.count({
        where: { sizeId: id },
        transaction
      });

      if (productSizeCount > 0) {
        await transaction.rollback();
        return next(ApiError.badRequest("Cannot delete size that is used by products. Remove it from all products first."));
      }

      await size.destroy({ transaction });
      await transaction.commit();

      return res.json({ message: "Size deleted successfully" });
    } catch (e) {
      await transaction.rollback();
      console.error("Error deleting size:", e);
      next(ApiError.internal(e.message));
    }
  }
}

module.exports = new SizeController();

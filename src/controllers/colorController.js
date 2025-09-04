const ApiError = require("../errors/ApiError");
const sequelize = require("../db");
const {
  Color,
  ProductColor,
  Product,
} = require("../models/models");

class ColorController {
  // Получение всех цветов
  async getAll(req, res, next) {
    try {
      const colors = await Color.findAll({
        order: [['name', 'ASC']],
      });

      return res.json(colors);
    } catch (e) {
      console.error("Error getting colors:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Создание цвета (только для админов)
  async create(req, res, next) {
    try {
      const { name, hexCode } = req.body;

      if (!name) {
        return next(ApiError.badRequest("Color name is required"));
      }

      // Проверяем, не существует ли уже такой цвет
      const existingColor = await Color.findOne({ where: { name } });
      if (existingColor) {
        return next(ApiError.badRequest("Color with this name already exists"));
      }

      const color = await Color.create({ 
        name,
        hexCode: hexCode || null 
      });
      
      return res.json(color);
    } catch (e) {
      console.error("Error creating color:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Создание стандартных цветов
  async createDefaultColors(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const defaultColors = [
        { name: "Черный", hexCode: "#000000" },
        { name: "Белый", hexCode: "#FFFFFF" },
        { name: "Красный", hexCode: "#FF0000" },
        { name: "Синий", hexCode: "#0000FF" },
        { name: "Зеленый", hexCode: "#008000" },
        { name: "Серый", hexCode: "#808080" },
        { name: "Коричневый", hexCode: "#A52A2A" },
        { name: "Розовый", hexCode: "#FFC0CB" },
        { name: "Желтый", hexCode: "#FFFF00" },
        { name: "Оранжевый", hexCode: "#FFA500" },
        { name: "Фиолетовый", hexCode: "#800080" },
        { name: "Бежевый", hexCode: "#F5F5DC" },
      ];

      const createdColors = [];

      for (const colorData of defaultColors) {
        // Проверяем, не существует ли уже такой цвет
        const existingColor = await Color.findOne({ 
          where: { name: colorData.name },
          transaction 
        });

        if (!existingColor) {
          const color = await Color.create(colorData, { transaction });
          createdColors.push(color);
        }
      }

      await transaction.commit();

      return res.json({
        message: `Created ${createdColors.length} default colors`,
        createdColors
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error creating default colors:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Добавление цветов к продукту (только для админов)
  async addToProduct(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { productId } = req.params;
      const { colorIds } = req.body; // массив ID цветов

      if (!colorIds || !Array.isArray(colorIds)) {
        await transaction.rollback();
        return next(ApiError.badRequest("colorIds must be an array"));
      }

      // Проверяем существование продукта
      const product = await Product.findByPk(productId, { transaction });
      if (!product) {
        await transaction.rollback();
        return next(ApiError.notFound("Product not found"));
      }

      // Проверяем существование цветов
      const colors = await Color.findAll({
        where: { id: colorIds },
        transaction
      });

      if (colors.length !== colorIds.length) {
        await transaction.rollback();
        return next(ApiError.badRequest("Some colors not found"));
      }

      // Добавляем цвета к продукту (заменяем существующие)
      await product.setColors(colors, { transaction });

      await transaction.commit();

      // Получаем обновленный продукт с цветами
      const updatedProduct = await Product.findByPk(productId, {
        include: [
          {
            model: Color,
            as: "colors",
            through: { attributes: [] } // не включаем атрибуты промежуточной таблицы
          }
        ]
      });

      return res.json(updatedProduct);
    } catch (e) {
      await transaction.rollback();
      console.error("Error adding colors to product:", e);
      next(ApiError.internal(e.message));
    }
  }


  // Удаление цвета из продукта (только для админов)
  async removeFromProduct(req, res, next) {
    try {
      const { productId, colorId } = req.params;

      // Проверяем существование связи
      const productColor = await ProductColor.findOne({
        where: { productId, colorId }
      });

      if (!productColor) {
        return next(ApiError.notFound("Product color not found"));
      }

      await productColor.destroy();

      return res.json({ message: "Color removed from product successfully" });
    } catch (e) {
      console.error("Error removing color from product:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Обновление цвета (только для админов)
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, hexCode } = req.body;

      const color = await Color.findByPk(id);
      if (!color) {
        return next(ApiError.notFound("Color not found"));
      }

      // Проверяем уникальность имени, если оно изменяется
      if (name && name !== color.name) {
        const existingColor = await Color.findOne({ where: { name } });
        if (existingColor) {
          return next(ApiError.badRequest("Color with this name already exists"));
        }
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (hexCode !== undefined) updateData.hexCode = hexCode;

      await color.update(updateData);

      return res.json(color);
    } catch (e) {
      console.error("Error updating color:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Удаление цвета (только для админов)
  async delete(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;

      const color = await Color.findByPk(id, { transaction });
      if (!color) {
        await transaction.rollback();
        return next(ApiError.notFound("Color not found"));
      }

      // Проверяем, используется ли цвет в продуктах
      const productColorCount = await ProductColor.count({
        where: { colorId: id },
        transaction
      });

      if (productColorCount > 0) {
        await transaction.rollback();
        return next(ApiError.badRequest("Cannot delete color that is used by products. Remove it from all products first."));
      }

      await color.destroy({ transaction });
      await transaction.commit();

      return res.json({ message: "Color deleted successfully" });
    } catch (e) {
      await transaction.rollback();
      console.error("Error deleting color:", e);
      next(ApiError.internal(e.message));
    }
  }
}

module.exports = new ColorController();

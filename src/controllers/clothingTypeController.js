const ApiError = require("../errors/ApiError");
const sequelize = require("../db");
const {
  ClothingType,
  Product,
} = require("../models/models");

class ClothingTypeController {
  // Получение всех типов одежды
  async getAll(req, res, next) {
    try {
      const clothingTypes = await ClothingType.findAll({
        order: [['name', 'ASC']],
      });

      return res.json(clothingTypes);
    } catch (e) {
      console.error("Error getting clothing types:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение одного типа одежды с продуктами
  async getOne(req, res, next) {
    try {
      const { id } = req.params;

      const clothingType = await ClothingType.findByPk(id, {
        include: [
          {
            model: Product,
            as: "products",
            attributes: ['id', 'name', 'priceKZT', 'priceUSD', 'status'],
            where: { status: 'AVAILABLE' },
            required: false,
          }
        ]
      });

      if (!clothingType) {
        return next(ApiError.notFound("Clothing type not found"));
      }

      return res.json(clothingType);
    } catch (e) {
      console.error("Error getting clothing type:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Создание типа одежды (только для админов)
  async create(req, res, next) {
    try {
      const { name } = req.body;

      if (!name) {
        return next(ApiError.badRequest("Clothing type name is required"));
      }

      // Проверяем, не существует ли уже такой тип одежды
      const existingClothingType = await ClothingType.findOne({ where: { name } });
      if (existingClothingType) {
        return next(ApiError.badRequest("Clothing type with this name already exists"));
      }

      const clothingType = await ClothingType.create({ name });
      
      return res.json(clothingType);
    } catch (e) {
      console.error("Error creating clothing type:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Создание стандартных типов одежды
  async createDefaultTypes(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const defaultTypes = [
        "Футболки",
        "Рубашки", 
        "Поло",
        "Худи",
        "Свитшоты",
        "Свитеры",
        "Кардиганы",
        "Куртки",
        "Пальто",
        "Жилеты",
        "Джинсы",
        "Брюки",
        "Шорты",
        "Юбки",
        "Платья",
        "Сарафаны",
        "Блузки",
        "Топы",
        "Майки",
        "Нижнее белье",
        "Носки",
        "Колготки",
        "Аксессуары",
        "Обувь",
        "Сумки",
        "Головные уборы",
      ];

      const createdTypes = [];

      for (const typeName of defaultTypes) {
        // Проверяем, не существует ли уже такой тип одежды
        const existingType = await ClothingType.findOne({ 
          where: { name: typeName },
          transaction 
        });

        if (!existingType) {
          const clothingType = await ClothingType.create({ name: typeName }, { transaction });
          createdTypes.push(clothingType);
        }
      }

      await transaction.commit();

      return res.json({
        message: `Created ${createdTypes.length} default clothing types`,
        createdTypes
      });
    } catch (e) {
      await transaction.rollback();
      console.error("Error creating default clothing types:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Обновление типа одежды (только для админов)
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!name) {
        return next(ApiError.badRequest("Clothing type name is required"));
      }

      const clothingType = await ClothingType.findByPk(id);
      if (!clothingType) {
        return next(ApiError.notFound("Clothing type not found"));
      }

      // Проверяем уникальность имени, если оно изменяется
      if (name !== clothingType.name) {
        const existingType = await ClothingType.findOne({ where: { name } });
        if (existingType) {
          return next(ApiError.badRequest("Clothing type with this name already exists"));
        }
      }

      await clothingType.update({ name });

      return res.json(clothingType);
    } catch (e) {
      console.error("Error updating clothing type:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Удаление типа одежды (только для админов)
  async delete(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;

      const clothingType = await ClothingType.findByPk(id, { transaction });
      if (!clothingType) {
        await transaction.rollback();
        return next(ApiError.notFound("Clothing type not found"));
      }

      // Проверяем, используется ли тип одежды в продуктах
      const productCount = await Product.count({
        where: { clothingTypeId: id },
        transaction
      });

      if (productCount > 0) {
        await transaction.rollback();
        return next(ApiError.badRequest("Cannot delete clothing type that is used by products. Remove it from all products first."));
      }

      await clothingType.destroy({ transaction });
      await transaction.commit();

      return res.json({ message: "Clothing type deleted successfully" });
    } catch (e) {
      await transaction.rollback();
      console.error("Error deleting clothing type:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение статистики по типам одежды (количество продуктов)
  async getStatistics(req, res, next) {
    try {
      const statistics = await ClothingType.findAll({
        attributes: [
          'id',
          'name',
          [sequelize.fn('COUNT', sequelize.col('products.id')), 'productCount']
        ],
        include: [
          {
            model: Product,
            as: "products",
            attributes: [],
            where: { status: 'AVAILABLE' },
            required: false,
          }
        ],
        group: ['clothing_type.id'],
        order: [['name', 'ASC']]
      });

      return res.json(statistics);
    } catch (e) {
      console.error("Error getting clothing type statistics:", e);
      next(ApiError.internal(e.message));
    }
  }
}

module.exports = new ClothingTypeController();

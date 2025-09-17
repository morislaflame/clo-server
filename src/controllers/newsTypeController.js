const ApiError = require("../errors/ApiError");
const { NewsType, News } = require("../models/models");

class NewsTypeController {
  // Создание типа новости (только для админов)
  async create(req, res, next) {
    try {
      const { name, description } = req.body;

      // Валидация обязательных полей
      if (!name) {
        return next(ApiError.badRequest("Name is required"));
      }

      // Проверяем, не существует ли уже тип с таким именем
      const existingType = await NewsType.findOne({ where: { name } });
      if (existingType) {
        return next(ApiError.badRequest("News type with this name already exists"));
      }

      // Создаем тип новости
      const newsType = await NewsType.create({
        name,
        description,
      });

      return res.json(newsType);
    } catch (e) {
      console.error("Error creating news type:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение всех типов новостей
  async getAll(req, res, next) {
    try {
      const { page = 1, limit = 50, search } = req.query;

      const offset = (page - 1) * limit;
      const where = {};

      // Поиск по имени
      if (search) {
        where.name = {
          [require("sequelize").Op.iLike]: `%${search}%`,
        };
      }

      const { count, rows: newsTypes } = await NewsType.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["name", "ASC"]],
        include: [
          {
            model: News,
            as: "news",
            attributes: ['id', 'title', 'status'],
            required: false,
          },
        ],
      });

      return res.json({
        newsTypes,
        totalCount: count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
      });
    } catch (e) {
      console.error("Error getting news types:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение одного типа новости
  async getOne(req, res, next) {
    try {
      const { id } = req.params;

      const newsType = await NewsType.findByPk(id, {
        include: [
          {
            model: News,
            as: "news",
            attributes: ['id', 'title', 'status', 'createdAt'],
            required: false,
          },
        ],
      });

      if (!newsType) {
        return next(ApiError.notFound("News type not found"));
      }

      return res.json(newsType);
    } catch (e) {
      console.error("Error getting news type:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Обновление типа новости (только для админов)
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const newsType = await NewsType.findByPk(id);

      if (!newsType) {
        return next(ApiError.notFound("News type not found"));
      }

      // Проверяем, не существует ли уже тип с таким именем (если имя изменяется)
      if (name && name !== newsType.name) {
        const existingType = await NewsType.findOne({ where: { name } });
        if (existingType) {
          return next(ApiError.badRequest("News type with this name already exists"));
        }
      }

      // Обновляем только переданные поля
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      await newsType.update(updateData);

      return res.json(newsType);
    } catch (e) {
      console.error("Error updating news type:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Удаление типа новости (только для админов)
  async delete(req, res, next) {
    try {
      const { id } = req.params;

      const newsType = await NewsType.findByPk(id);

      if (!newsType) {
        return next(ApiError.notFound("News type not found"));
      }

      // Проверяем, используется ли тип в новостях
      const newsWithType = await News.count({
        where: { newsTypeId: id }
      });

      if (newsWithType > 0) {
        return next(ApiError.badRequest("Cannot delete news type that is used in news"));
      }

      await newsType.destroy();

      return res.json({ message: "News type deleted successfully" });
    } catch (e) {
      console.error("Error deleting news type:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение типов новостей с количеством новостей
  async getWithCounts(req, res, next) {
    try {
      const newsTypes = await NewsType.findAll({
        attributes: [
          'id',
          'name',
          'description',
          [require("sequelize").fn('COUNT', require("sequelize").col('news.id')), 'newsCount']
        ],
        include: [
          {
            model: News,
            as: "news",
            attributes: [],
            required: false,
          },
        ],
        group: ['news_type.id', 'news_type.name', 'news_type.description'],
        order: [["name", "ASC"]],
      });

      return res.json(newsTypes);
    } catch (e) {
      console.error("Error getting news types with counts:", e);
      next(ApiError.internal(e.message));
    }
  }
}

module.exports = new NewsTypeController();

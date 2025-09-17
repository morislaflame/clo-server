const ApiError = require("../errors/ApiError");
const { Tag, News } = require("../models/models");

class TagController {
  // Создание тега (только для админов)
  async create(req, res, next) {
    try {
      const { name, color } = req.body;

      // Валидация обязательных полей
      if (!name) {
        return next(ApiError.badRequest("Name is required"));
      }

      // Проверяем, не существует ли уже тег с таким именем
      const existingTag = await Tag.findOne({ where: { name } });
      if (existingTag) {
        return next(ApiError.badRequest("Tag with this name already exists"));
      }

      // Создаем тег
      const tag = await Tag.create({
        name,
        color,
      });

      return res.json(tag);
    } catch (e) {
      console.error("Error creating tag:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение всех тегов
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

      const { count, rows: tags } = await Tag.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["name", "ASC"]],
        include: [
          {
            model: News,
            as: "news",
            attributes: ['id', 'title'],
            through: { attributes: [] },
            required: false,
          },
        ],
      });

      return res.json({
        tags,
        totalCount: count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
      });
    } catch (e) {
      console.error("Error getting tags:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение одного тега
  async getOne(req, res, next) {
    try {
      const { id } = req.params;

      const tag = await Tag.findByPk(id, {
        include: [
          {
            model: News,
            as: "news",
            attributes: ['id', 'title', 'status', 'createdAt'],
            through: { attributes: [] },
            required: false,
          },
        ],
      });

      if (!tag) {
        return next(ApiError.notFound("Tag not found"));
      }

      return res.json(tag);
    } catch (e) {
      console.error("Error getting tag:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Обновление тега (только для админов)
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, color } = req.body;

      const tag = await Tag.findByPk(id);

      if (!tag) {
        return next(ApiError.notFound("Tag not found"));
      }

      // Проверяем, не существует ли уже тег с таким именем (если имя изменяется)
      if (name && name !== tag.name) {
        const existingTag = await Tag.findOne({ where: { name } });
        if (existingTag) {
          return next(ApiError.badRequest("Tag with this name already exists"));
        }
      }

      // Обновляем только переданные поля
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (color !== undefined) updateData.color = color;

      await tag.update(updateData);

      return res.json(tag);
    } catch (e) {
      console.error("Error updating tag:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Удаление тега (только для админов)
  async delete(req, res, next) {
    try {
      const { id } = req.params;

      const tag = await Tag.findByPk(id);

      if (!tag) {
        return next(ApiError.notFound("Tag not found"));
      }

      // Проверяем, используется ли тег в новостях
      const newsWithTag = await News.count({
        include: [
          {
            model: Tag,
            as: "tags",
            where: { id },
            through: { attributes: [] },
            required: true,
          },
        ],
      });

      if (newsWithTag > 0) {
        return next(ApiError.badRequest("Cannot delete tag that is used in news"));
      }

      await tag.destroy();

      return res.json({ message: "Tag deleted successfully" });
    } catch (e) {
      console.error("Error deleting tag:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение тегов с количеством новостей
  async getWithCounts(req, res, next) {
    try {
      const tags = await Tag.findAll({
        attributes: [
          'id',
          'name',
          'color',
          [require("sequelize").fn('COUNT', require("sequelize").col('news.id')), 'newsCount']
        ],
        include: [
          {
            model: News,
            as: "news",
            attributes: [],
            through: { attributes: [] },
            required: false,
          },
        ],
        group: ['Tag.id', 'Tag.name', 'Tag.color'],
        order: [["name", "ASC"]],
      });

      return res.json(tags);
    } catch (e) {
      console.error("Error getting tags with counts:", e);
      next(ApiError.internal(e.message));
    }
  }
}

module.exports = new TagController();

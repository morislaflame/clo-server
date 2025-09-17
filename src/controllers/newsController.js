const ApiError = require("../errors/ApiError");
const sequelize = require("../db");
const {
  News,
  NewsType,
  Tag,
  NewsTag,
  MediaFile,
  User,
} = require("../models/models");
const { uploadFile, deleteFile } = require("../services/mediaService");

class NewsController {
  // Создание новости (только для админов)
  async create(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const {
        title,
        description,
        content,
        links,
        status = "DRAFT",
        newsTypeId,
        tagIds, // массив тегов
      } = req.body;

      // Валидация обязательных полей
      if (!title || !content || !newsTypeId) {
        await transaction.rollback();
        return next(ApiError.badRequest("Title, content and newsTypeId are required"));
      }

      // Проверяем существование типа новости
      const newsType = await NewsType.findByPk(newsTypeId, { transaction });
      if (!newsType) {
        await transaction.rollback();
        return next(ApiError.badRequest("News type not found"));
      }

      // Парсим links если это строка
      let parsedLinks = [];
      if (links) {
        if (typeof links === 'string') {
          try {
            parsedLinks = JSON.parse(links);
          } catch {
            parsedLinks = links.split(',').map(link => link.trim()).filter(link => link);
          }
        } else if (Array.isArray(links)) {
          parsedLinks = links;
        }
      }

      // Создаем новость
      const news = await News.create(
        {
          title,
          description,
          content,
          links: parsedLinks,
          status,
          newsTypeId,
          authorId: req.user.id,
          publishedAt: status === "PUBLISHED" ? new Date() : null,
        },
        { transaction }
      );

      // Добавляем теги к новости
      if (tagIds) {
        let parsedTagIds = tagIds;
        
        // Парсим tagIds если это строка
        if (typeof tagIds === 'string') {
          try {
            parsedTagIds = JSON.parse(tagIds);
          } catch {
            parsedTagIds = tagIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
          }
        }
        
        if (Array.isArray(parsedTagIds) && parsedTagIds.length > 0) {
          const tags = await Tag.findAll({
            where: { id: parsedTagIds },
            transaction
          });
          
          if (tags.length > 0) {
            await news.setTags(tags, { transaction });
          }
        }
      }

      // Обработка загруженных файлов
      if (req.files && req.files.media) {
        for (const file of req.files.media) {
          try {
            await uploadFile(file, req.user.id, "news", news.id);
          } catch (uploadError) {
            console.error("Error uploading file:", uploadError);
            await transaction.rollback();
            return next(ApiError.internal("Error uploading media files: " + uploadError.message));
          }
        }
      }

      await transaction.commit();

      // Получаем новость с медиафайлами и связанными данными
      const createdNews = await News.findByPk(news.id, {
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "news" },
            required: false,
          },
          {
            model: NewsType,
            as: "newsType",
            required: false,
          },
          {
            model: User,
            as: "author",
            attributes: ['id', 'email'],
            required: false,
          },
          {
            model: Tag,
            as: "tags",
            through: { attributes: [] },
            required: false,
          },
        ],
      });

      return res.json(createdNews);
    } catch (e) {
      await transaction.rollback();
      console.error("Error creating news:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение всех новостей с фильтрацией
  async getAll(req, res, next) {
    try {
      const {
        status,
        newsTypeId,
        tagId,
        authorId,
        page = 1,
        limit = 20,
        published = true, // по умолчанию показываем только опубликованные
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {};
      const include = [
        {
          model: MediaFile,
          as: "mediaFiles",
          where: { entityType: "news" },
          required: false,
        },
        {
          model: NewsType,
          as: "newsType",
          required: false,
        },
        {
          model: User,
          as: "author",
          attributes: ['id', 'email'],
          required: false,
        },
        {
          model: Tag,
          as: "tags",
          through: { attributes: [] },
          required: false,
        },
      ];

      // Фильтры
      if (status) where.status = status;
      if (newsTypeId) where.newsTypeId = newsTypeId;
      if (authorId) where.authorId = authorId;

      // По умолчанию показываем только опубликованные новости
      if (published === 'true' || published === true) {
        where.status = 'PUBLISHED';
      }

      // Фильтр по тегу
      if (tagId) {
        include.push({
          model: Tag,
          as: "tags",
          where: { id: tagId },
          through: { attributes: [] },
          required: true,
        });
        // Убираем теги из обычного include, чтобы избежать дублирования
        include.splice(3, 1);
      }

      const { count, rows: news } = await News.findAndCountAll({
        where,
        include,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["createdAt", "DESC"]],
        distinct: true,
      });

      return res.json({
        news,
        totalCount: count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
      });
    } catch (e) {
      console.error("Error getting news:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение одной новости
  async getOne(req, res, next) {
    try {
      const { id } = req.params;

      const news = await News.findByPk(id, {
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "news" },
            required: false,
          },
          {
            model: NewsType,
            as: "newsType",
            required: false,
          },
          {
            model: User,
            as: "author",
            attributes: ['id', 'email'],
            required: false,
          },
          {
            model: Tag,
            as: "tags",
            through: { attributes: [] },
            required: false,
          },
        ],
      });

      if (!news) {
        return next(ApiError.notFound("News not found"));
      }

      return res.json(news);
    } catch (e) {
      console.error("Error getting news:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Обновление новости (только для админов)
  async update(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const {
        title,
        description,
        content,
        links,
        status,
        newsTypeId,
        tagIds, // новые теги
        deletedMediaIds, // удаленные медиафайлы
      } = req.body;

      const news = await News.findByPk(id, { transaction });

      if (!news) {
        await transaction.rollback();
        return next(ApiError.notFound("News not found"));
      }

      // Обновляем только переданные поля
      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (content !== undefined) updateData.content = content;
      if (links !== undefined) {
        let parsedLinks = [];
        if (links) {
          if (typeof links === 'string') {
            try {
              parsedLinks = JSON.parse(links);
            } catch {
              parsedLinks = links.split(',').map(link => link.trim()).filter(link => link);
            }
          } else if (Array.isArray(links)) {
            parsedLinks = links;
          }
        }
        updateData.links = parsedLinks;
      }
      if (status !== undefined) {
        updateData.status = status;
        // Если статус меняется на PUBLISHED, устанавливаем дату публикации
        if (status === "PUBLISHED" && news.status !== "PUBLISHED") {
          updateData.publishedAt = new Date();
        }
      }
      if (newsTypeId !== undefined) {
        // Проверяем существование типа новости
        const newsType = await NewsType.findByPk(newsTypeId, { transaction });
        if (!newsType) {
          await transaction.rollback();
          return next(ApiError.badRequest("News type not found"));
        }
        updateData.newsTypeId = newsTypeId;
      }

      await news.update(updateData, { transaction });

      // Обновляем теги, если переданы
      if (tagIds !== undefined) {
        let parsedTagIds = tagIds;
        
        if (typeof tagIds === 'string') {
          try {
            parsedTagIds = JSON.parse(tagIds);
          } catch {
            parsedTagIds = tagIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
          }
        }
        
        if (Array.isArray(parsedTagIds)) {
          const tags = await Tag.findAll({
            where: { id: parsedTagIds },
            transaction
          });
          await news.setTags(tags, { transaction });
        }
      }

      // Удаляем медиафайлы, если переданы
      if (deletedMediaIds !== undefined) {
        let parsedDeletedMediaIds = deletedMediaIds;
        
        if (typeof deletedMediaIds === 'string') {
          try {
            parsedDeletedMediaIds = JSON.parse(deletedMediaIds);
          } catch {
            parsedDeletedMediaIds = deletedMediaIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
          }
        }
        
        if (Array.isArray(parsedDeletedMediaIds) && parsedDeletedMediaIds.length > 0) {
          for (const mediaId of parsedDeletedMediaIds) {
            try {
              await deleteFile(mediaId);
            } catch (deleteError) {
              console.error("Error deleting media file:", deleteError);
            }
          }
        }
      }

      // Обработка новых медиафайлов
      if (req.files && req.files.media) {
        for (const file of req.files.media) {
          try {
            await uploadFile(file, req.user.id, "news", news.id);
          } catch (uploadError) {
            console.error("Error uploading file:", uploadError);
          }
        }
      }

      await transaction.commit();

      // Получаем обновленную новость
      const updatedNews = await News.findByPk(id, {
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "news" },
            required: false,
          },
          {
            model: NewsType,
            as: "newsType",
            required: false,
          },
          {
            model: User,
            as: "author",
            attributes: ['id', 'email'],
            required: false,
          },
          {
            model: Tag,
            as: "tags",
            through: { attributes: [] },
            required: false,
          },
        ],
      });

      return res.json(updatedNews);
    } catch (e) {
      await transaction.rollback();
      console.error("Error updating news:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Удаление новости (только для админов)
  async delete(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;

      const news = await News.findByPk(id, {
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "news" },
            required: false,
          },
        ],
        transaction,
      });

      if (!news) {
        await transaction.rollback();
        return next(ApiError.notFound("News not found"));
      }

      // Удаляем связанные медиафайлы
      if (news.mediaFiles && news.mediaFiles.length > 0) {
        for (const mediaFile of news.mediaFiles) {
          try {
            await deleteFile(mediaFile.id);
          } catch (deleteError) {
            console.error("Error deleting media file:", deleteError);
          }
        }
      }

      // Удаляем новость (каскадно удалятся связанные записи)
      await news.destroy({ transaction });

      await transaction.commit();

      return res.json({ message: "News deleted successfully" });
    } catch (e) {
      await transaction.rollback();
      console.error("Error deleting news:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Удаление медиафайла новости (только для админов)
  async deleteMedia(req, res, next) {
    try {
      const { newsId, mediaId } = req.params;

      // Проверяем, существует ли новость
      const news = await News.findByPk(newsId);
      if (!news) {
        return next(ApiError.notFound("News not found"));
      }

      // Проверяем, принадлежит ли медиафайл этой новости
      const mediaFile = await MediaFile.findOne({
        where: {
          id: mediaId,
          entityType: "news",
          entityId: newsId,
        },
      });

      if (!mediaFile) {
        return next(ApiError.notFound("Media file not found"));
      }

      // Удаляем медиафайл
      await deleteFile(mediaId);

      return res.json({ message: "Media file deleted successfully" });
    } catch (e) {
      console.error("Error deleting media file:", e);
      next(ApiError.internal(e.message));
    }
  }
}

module.exports = new NewsController();

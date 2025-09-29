const ApiError = require("../errors/ApiError");
const sequelize = require("../db");
const {
  MainBanner,
  MediaFile,
} = require("../models/models");
const { uploadFile, deleteFile } = require("../services/mediaService");

class MainBannerController {
  // Создание главного баннера (только для админов)
  async create(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { title } = req.body;

      // Создаем главный баннер
      const mainBanner = await MainBanner.create(
        {
          title,
          isActive: true,
        },
        { transaction }
      );

      await transaction.commit();

      // Обработка загруженных файлов
      if (req.files && req.files.media) {
        for (const file of req.files.media) {
          try {
            await uploadFile(file, req.user.id, "main_banner", mainBanner.id);
          } catch (uploadError) {
            console.error("Error uploading file:", uploadError);
          }
        }
      }

      // Получаем баннер с медиафайлами
      const createdMainBanner = await MainBanner.findByPk(mainBanner.id, {
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "main_banner" },
            required: false,
          },
        ],
      });

      return res.json(createdMainBanner);
    } catch (e) {
      await transaction.rollback();
      console.error("Error creating main banner:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение активного главного баннера (публичный)
  async getActive(req, res, next) {
    try {
      const mainBanner = await MainBanner.findOne({
        where: { isActive: true },
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "main_banner" },
            required: false,
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      if (!mainBanner) {
        return res.json({ message: "No active main banner found" });
      }

      return res.json(mainBanner);
    } catch (e) {
      console.error("Error getting main banner:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение всех баннеров (для админов)
  async getAll(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows: mainBanners } = await MainBanner.findAndCountAll({
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "main_banner" },
            required: false,
          },
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["createdAt", "DESC"]],
        distinct: true,
      });

      return res.json({
        mainBanners,
        totalCount: count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
      });
    } catch (e) {
      console.error("Error getting main banners:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение одного баннера
  async getOne(req, res, next) {
    try {
      const { id } = req.params;

      const mainBanner = await MainBanner.findByPk(id, {
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "main_banner" },
            required: false,
          },
        ],
      });

      if (!mainBanner) {
        return next(ApiError.notFound("Main banner not found"));
      }

      return res.json(mainBanner);
    } catch (e) {
      console.error("Error getting main banner:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Обновление главного баннера (только для админов)
  async update(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const { title, isActive, deletedMediaIds } = req.body;

      const mainBanner = await MainBanner.findByPk(id, { transaction });

      if (!mainBanner) {
        await transaction.rollback();
        return next(ApiError.notFound("Main banner not found"));
      }

      // Обновляем только переданные поля
      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (isActive !== undefined) updateData.isActive = isActive;

      await mainBanner.update(updateData, { transaction });

      // Обработка удаления медиафайлов
      if (deletedMediaIds) {
        let parsedDeletedMediaIds = deletedMediaIds;
        
        // Парсим deletedMediaIds если это строка
        if (typeof deletedMediaIds === 'string') {
          try {
            parsedDeletedMediaIds = JSON.parse(deletedMediaIds);
          } catch {
            console.error("Error parsing deletedMediaIds:", deletedMediaIds);
            parsedDeletedMediaIds = [];
          }
        }
        
        if (Array.isArray(parsedDeletedMediaIds) && parsedDeletedMediaIds.length > 0) {
          for (const mediaId of parsedDeletedMediaIds) {
            try {
              // Проверяем, принадлежит ли медиафайл этому баннеру
              const mediaFile = await MediaFile.findOne({
                where: {
                  id: mediaId,
                  entityType: "main_banner",
                  entityId: mainBanner.id,
                },
                transaction
              });

              if (mediaFile) {
                await deleteFile(mediaId);
                console.log(`Deleted media file ${mediaId} for main banner ${mainBanner.id}`);
              }
            } catch (deleteError) {
              console.error(`Error deleting media file ${mediaId}:`, deleteError);
            }
          }
        }
      }

      // Обработка новых медиафайлов
      if (req.files && req.files.media) {
        for (const file of req.files.media) {
          try {
            await uploadFile(file, req.user.id, "main_banner", mainBanner.id);
          } catch (uploadError) {
            console.error("Error uploading file:", uploadError);
          }
        }
      }

      await transaction.commit();

      // Получаем обновленный баннер
      const updatedMainBanner = await MainBanner.findByPk(id, {
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "main_banner" },
            required: false,
          },
        ],
      });

      return res.json(updatedMainBanner);
    } catch (e) {
      await transaction.rollback();
      console.error("Error updating main banner:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Удаление главного баннера (только для админов)
  async delete(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;

      const mainBanner = await MainBanner.findByPk(id, {
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "main_banner" },
            required: false,
          },
        ],
        transaction,
      });

      if (!mainBanner) {
        await transaction.rollback();
        return next(ApiError.notFound("Main banner not found"));
      }

      // Удаляем связанные медиафайлы
      if (mainBanner.mediaFiles && mainBanner.mediaFiles.length > 0) {
        for (const mediaFile of mainBanner.mediaFiles) {
          try {
            await deleteFile(mediaFile.id);
          } catch (deleteError) {
            console.error("Error deleting media file:", deleteError);
          }
        }
      }

      // Удаляем баннер (каскадно удалятся связанные записи)
      await mainBanner.destroy({ transaction });

      await transaction.commit();

      return res.json({ message: "Main banner deleted successfully" });
    } catch (e) {
      await transaction.rollback();
      console.error("Error deleting main banner:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Удаление медиафайла главного баннера (только для админов)
  async deleteMedia(req, res, next) {
    try {
      const { mainBannerId, mediaId } = req.params;

      // Проверяем, существует ли баннер
      const mainBanner = await MainBanner.findByPk(mainBannerId);
      if (!mainBanner) {
        return next(ApiError.notFound("Main banner not found"));
      }

      // Проверяем, принадлежит ли медиафайл этому баннеру
      const mediaFile = await MediaFile.findOne({
        where: {
          id: mediaId,
          entityType: "main_banner",
          entityId: mainBannerId,
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

module.exports = new MainBannerController();

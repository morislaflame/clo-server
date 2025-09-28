const ApiError = require("../errors/ApiError");
const sequelize = require("../db");
const {
  Collection,
  Product,
  MediaFile,
} = require("../models/models");
const { uploadFile, deleteFile } = require("../services/mediaService");

class CollectionController {
  // Создание коллекции (только для админов)
  async create(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { name, description } = req.body;

      // Валидация обязательных полей
      if (!name) {
        await transaction.rollback();
        return next(ApiError.badRequest("Name is required"));
      }

      // Создаем коллекцию
      const collection = await Collection.create(
        {
          name,
          description,
        },
        { transaction }
      );

      await transaction.commit();

      // Обработка загруженных файлов
      if (req.files && req.files.media) {
        for (const file of req.files.media) {
          try {
            await uploadFile(file, req.user.id, "collection", collection.id);
          } catch (uploadError) {
            console.error("Error uploading file:", uploadError);
          }
        }
      }

      // Получаем коллекцию с медиафайлами
      const createdCollection = await Collection.findByPk(collection.id, {
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "collection" },
            required: false,
          },
          {
            model: Product,
            as: "products",
            required: false,
            include: [
              {
                model: MediaFile,
                as: "mediaFiles",
                where: { entityType: "product" },
                required: false,
              },
            ],
          },
        ],
      });

      return res.json(createdCollection);
    } catch (e) {
      await transaction.rollback();
      console.error("Error creating collection:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение всех коллекций
  async getAll(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows: collections } = await Collection.findAndCountAll({
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "collection" },
            required: false,
          },
          {
            model: Product,
            as: "products",
            required: false,
            include: [
              {
                model: MediaFile,
                as: "mediaFiles",
                where: { entityType: "product" },
                required: false,
              },
            ],
          },
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["createdAt", "DESC"]],
        distinct: true,
      });

      return res.json({
        collections,
        totalCount: count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
      });
    } catch (e) {
      console.error("Error getting collections:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение одной коллекции
  async getOne(req, res, next) {
    try {
      const { id } = req.params;

      const collection = await Collection.findByPk(id, {
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "collection" },
            required: false,
          },
          {
            model: Product,
            as: "products",
            required: false,
            include: [
              {
                model: MediaFile,
                as: "mediaFiles",
                where: { entityType: "product" },
                required: false,
              },
            ],
          },
        ],
      });

      if (!collection) {
        return next(ApiError.notFound("Collection not found"));
      }

      return res.json(collection);
    } catch (e) {
      console.error("Error getting collection:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Обновление коллекции (только для админов)
  async update(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const { name, description, deletedMediaIds } = req.body;

      const collection = await Collection.findByPk(id, { transaction });

      if (!collection) {
        await transaction.rollback();
        return next(ApiError.notFound("Collection not found"));
      }

      // Обновляем только переданные поля
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      await collection.update(updateData, { transaction });

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
              // Проверяем, принадлежит ли медиафайл этой коллекции
              const mediaFile = await MediaFile.findOne({
                where: {
                  id: mediaId,
                  entityType: "collection",
                  entityId: collection.id,
                },
                transaction
              });

              if (mediaFile) {
                await deleteFile(mediaId);
                console.log(`Deleted media file ${mediaId} for collection ${collection.id}`);
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
            await uploadFile(file, req.user.id, "collection", collection.id);
          } catch (uploadError) {
            console.error("Error uploading file:", uploadError);
          }
        }
      }

      await transaction.commit();

      // Получаем обновленную коллекцию
      const updatedCollection = await Collection.findByPk(id, {
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "collection" },
            required: false,
          },
          {
            model: Product,
            as: "products",
            required: false,
            include: [
              {
                model: MediaFile,
                as: "mediaFiles",
                where: { entityType: "product" },
                required: false,
              },
            ],
          },
        ],
      });

      return res.json(updatedCollection);
    } catch (e) {
      await transaction.rollback();
      console.error("Error updating collection:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Удаление коллекции (только для админов)
  async delete(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;

      const collection = await Collection.findByPk(id, {
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "collection" },
            required: false,
          },
        ],
        transaction,
      });

      if (!collection) {
        await transaction.rollback();
        return next(ApiError.notFound("Collection not found"));
      }

      // Удаляем связанные медиафайлы
      if (collection.mediaFiles && collection.mediaFiles.length > 0) {
        for (const mediaFile of collection.mediaFiles) {
          try {
            await deleteFile(mediaFile.id);
          } catch (deleteError) {
            console.error("Error deleting media file:", deleteError);
          }
        }
      }

      // Удаляем коллекцию (каскадно удалятся связанные записи)
      await collection.destroy({ transaction });

      await transaction.commit();

      return res.json({ message: "Collection deleted successfully" });
    } catch (e) {
      await transaction.rollback();
      console.error("Error deleting collection:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Удаление медиафайла коллекции (только для админов)
  async deleteMedia(req, res, next) {
    try {
      const { collectionId, mediaId } = req.params;

      // Проверяем, существует ли коллекция
      const collection = await Collection.findByPk(collectionId);
      if (!collection) {
        return next(ApiError.notFound("Collection not found"));
      }

      // Проверяем, принадлежит ли медиафайл этой коллекции
      const mediaFile = await MediaFile.findOne({
        where: {
          id: mediaId,
          entityType: "collection",
          entityId: collectionId,
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

  // Добавление продукта в коллекцию (только для админов)
  async addProduct(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { collectionId, productId } = req.params;

      // Проверяем, существует ли коллекция
      const collection = await Collection.findByPk(collectionId, { transaction });
      if (!collection) {
        await transaction.rollback();
        return next(ApiError.notFound("Collection not found"));
      }

      // Проверяем, существует ли продукт
      const product = await Product.findByPk(productId, { transaction });
      if (!product) {
        await transaction.rollback();
        return next(ApiError.notFound("Product not found"));
      }

      // Проверяем, не добавлен ли уже продукт в эту коллекцию
      const existingProduct = await Product.findOne({
        where: { id: productId, collectionId: collectionId },
        transaction
      });

      if (existingProduct) {
        await transaction.rollback();
        return next(ApiError.badRequest("Product is already in this collection"));
      }

      // Добавляем продукт в коллекцию
      await product.update({ collectionId }, { transaction });

      await transaction.commit();

      return res.json({ message: "Product added to collection successfully" });
    } catch (e) {
      await transaction.rollback();
      console.error("Error adding product to collection:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Удаление продукта из коллекции (только для админов)
  async removeProduct(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { collectionId, productId } = req.params;

      // Проверяем, существует ли коллекция
      const collection = await Collection.findByPk(collectionId, { transaction });
      if (!collection) {
        await transaction.rollback();
        return next(ApiError.notFound("Collection not found"));
      }

      // Проверяем, существует ли продукт
      const product = await Product.findByPk(productId, { transaction });
      if (!product) {
        await transaction.rollback();
        return next(ApiError.notFound("Product not found"));
      }

      // Проверяем, принадлежит ли продукт этой коллекции
      if (product.collectionId !== parseInt(collectionId)) {
        await transaction.rollback();
        return next(ApiError.badRequest("Product is not in this collection"));
      }

      // Удаляем продукт из коллекции
      await product.update({ collectionId: null }, { transaction });

      await transaction.commit();

      return res.json({ message: "Product removed from collection successfully" });
    } catch (e) {
      await transaction.rollback();
      console.error("Error removing product from collection:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение продуктов коллекции
  async getProducts(req, res, next) {
    try {
      const { id: collectionId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // Проверяем, существует ли коллекция
      const collection = await Collection.findByPk(collectionId);
      if (!collection) {
        return next(ApiError.notFound("Collection not found"));
      }

      const { count, rows: products } = await Product.findAndCountAll({
        where: { collectionId },
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "product" },
            required: false,
          },
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["createdAt", "DESC"]],
      });

      return res.json({
        products,
        totalCount: count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
      });
    } catch (e) {
      console.error("Error getting collection products:", e);
      next(ApiError.internal(e.message));
    }
  }
}

module.exports = new CollectionController();

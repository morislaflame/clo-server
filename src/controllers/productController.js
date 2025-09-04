const ApiError = require("../errors/ApiError");
const sequelize = require("../db");
const {
  Product,
  MediaFile,
  ClothingType,
  Collection,
  Size,
  Color,
} = require("../models/models");
const { uploadFile, deleteFile } = require("../services/mediaService");

class ProductController {
  // Создание продукта (только для админов)
  async create(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const {
        name,
        priceKZT,
        priceUSD,
        description,
        color,
        ingredients,
        gender,
        sizeIds, // массив размеров
        colorIds, // массив цветов
        clothingTypeId,
        collectionId,
      } = req.body;

      // Валидация обязательных полей
      if (!name || !priceKZT || !priceUSD) {
        await transaction.rollback();
        return next(ApiError.badRequest("Name, priceKZT and priceUSD are required"));
      }

      // Создаем продукт
      const product = await Product.create(
        {
          name,
          priceKZT: parseInt(priceKZT),
          priceUSD: parseInt(priceUSD),
          description,
          color,
          ingredients,
          gender: gender || "MAN",
          clothingTypeId: clothingTypeId || null,
          collectionId: collectionId || null,
          status: "AVAILABLE",
        },
        { transaction }
      );

      // Добавляем размеры к продукту
      if (sizeIds) {
        let parsedSizeIds = sizeIds;
        
        // Парсим sizeIds если это строка
        if (typeof sizeIds === 'string') {
          try {
            // Пробуем распарсить как JSON
            parsedSizeIds = JSON.parse(sizeIds);
          } catch {
            // Если не JSON, то разделяем по запятой
            parsedSizeIds = sizeIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
          }
        }
        
        if (Array.isArray(parsedSizeIds) && parsedSizeIds.length > 0) {
          const sizes = await Size.findAll({
            where: { id: parsedSizeIds },
            transaction
          });
          
          if (sizes.length > 0) {
            await product.setSizes(sizes, { transaction });
          }
        }
      }

      // Добавляем цвета к продукту
      if (colorIds) {
        let parsedColorIds = colorIds;
        
        // Парсим colorIds если это строка
        if (typeof colorIds === 'string') {
          try {
            // Пробуем распарсить как JSON
            parsedColorIds = JSON.parse(colorIds);
          } catch {
            // Если не JSON, то разделяем по запятой
            parsedColorIds = colorIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
          }
        }
        
        if (Array.isArray(parsedColorIds) && parsedColorIds.length > 0) {
          const colors = await Color.findAll({
            where: { id: parsedColorIds },
            transaction
          });
          
          if (colors.length > 0) {
            await product.setColors(colors, { transaction });
          }
        }
      }

      await transaction.commit();

      // Обработка загруженных файлов
      if (req.files && req.files.media) {
        for (const file of req.files.media) {
          try {
            await uploadFile(file, req.user.id, "product", product.id);
          } catch (uploadError) {
            console.error("Error uploading file:", uploadError);
          }
        }
      }


      // Получаем продукт с медиафайлами и размерами
      const createdProduct = await Product.findByPk(product.id, {
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
      });

      return res.json(createdProduct);
    } catch (e) {
      await transaction.rollback();
      console.error("Error creating product:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение всех продуктов с фильтрацией
  async getAll(req, res, next) {
    try {
      const {
        gender,
        size,
        color,
        status,
        clothingTypeId,
        collectionId,
        minPrice,
        maxPrice,
        currency = "KZT",
        page = 1,
        limit = 20,
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {};
      const include = [
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
      ];

      // Фильтры
      if (gender) where.gender = gender;
      if (status) where.status = status;
      if (clothingTypeId) where.clothingTypeId = clothingTypeId;
      if (collectionId) where.collectionId = collectionId;

      // Фильтр по размеру
      if (size) {
        include.push({
          model: Size,
          as: "sizes",
          where: { name: size },
          through: { attributes: [] },
          required: true,
        });
        // Убираем размеры из обычного include, чтобы избежать дублирования
        include.splice(3, 1);
      }

      // Фильтр по цвету
      if (color) {
        include.push({
          model: Color,
          as: "colors",
          where: { name: color },
          through: { attributes: [] },
          required: true,
        });
        // Убираем цвета из обычного include, чтобы избежать дублирования
        include.splice(4, 1);
      }

      // Фильтр по цене
      if (minPrice || maxPrice) {
        const priceField = currency === "USD" ? "priceUSD" : "priceKZT";
        where[priceField] = {};
        if (minPrice) where[priceField][sequelize.Op.gte] = parseInt(minPrice);
        if (maxPrice) where[priceField][sequelize.Op.lte] = parseInt(maxPrice);
      }

      const { count, rows: products } = await Product.findAndCountAll({
        where,
        include,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["createdAt", "DESC"]],
        distinct: true,
      });

      return res.json({
        products,
        totalCount: count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
      });
    } catch (e) {
      console.error("Error getting products:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Получение одного продукта
  async getOne(req, res, next) {
    try {
      const { id } = req.params;

      const product = await Product.findByPk(id, {
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
      });

      if (!product) {
        return next(ApiError.notFound("Product not found"));
      }

      return res.json(product);
    } catch (e) {
      console.error("Error getting product:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Обновление продукта (только для админов)
  async update(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const {
        name,
        priceKZT,
        priceUSD,
        description,
        color,
        ingredients,
        gender,
        size,
        status,
        clothingTypeId,
        collectionId,
        sizeIds, // новые размеры
        colorIds, // новые цвета
      } = req.body;

      const product = await Product.findByPk(id, { transaction });

      if (!product) {
        await transaction.rollback();
        return next(ApiError.notFound("Product not found"));
      }

      // Обновляем только переданные поля
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (priceKZT !== undefined) updateData.priceKZT = parseInt(priceKZT);
      if (priceUSD !== undefined) updateData.priceUSD = parseInt(priceUSD);
      if (description !== undefined) updateData.description = description;
      if (color !== undefined) updateData.color = color;
      if (ingredients !== undefined) updateData.ingredients = ingredients;
      if (gender !== undefined) updateData.gender = gender;
      if (size !== undefined) updateData.size = size;
      if (status !== undefined) updateData.status = status;
      if (clothingTypeId !== undefined) updateData.clothingTypeId = clothingTypeId;
      if (collectionId !== undefined) updateData.collectionId = collectionId;

      await product.update(updateData, { transaction });

      // Обновляем размеры, если переданы
      if (sizeIds && Array.isArray(sizeIds)) {
        const sizes = await Size.findAll({
          where: { id: sizeIds },
          transaction
        });
        await product.setSizes(sizes, { transaction });
      }

      // Обновляем цвета, если переданы
      if (colorIds && Array.isArray(colorIds)) {
        const colors = await Color.findAll({
          where: { id: colorIds },
          transaction
        });
        await product.setColors(colors, { transaction });
      }

      // Обработка новых медиафайлов
      if (req.files && req.files.media) {
        for (const file of req.files.media) {
          try {
            await uploadFile(file, req.user.id, "product", product.id);
          } catch (uploadError) {
            console.error("Error uploading file:", uploadError);
          }
        }
      }

      await transaction.commit();

      // Получаем обновленный продукт
      const updatedProduct = await Product.findByPk(id, {
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
      });

      return res.json(updatedProduct);
    } catch (e) {
      await transaction.rollback();
      console.error("Error updating product:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Удаление продукта (только для админов)
  async delete(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;

      const product = await Product.findByPk(id, {
        include: [
          {
            model: MediaFile,
            as: "mediaFiles",
            where: { entityType: "product" },
            required: false,
          },
        ],
        transaction,
      });

      if (!product) {
        await transaction.rollback();
        return next(ApiError.notFound("Product not found"));
      }

      // Удаляем связанные медиафайлы
      if (product.mediaFiles && product.mediaFiles.length > 0) {
        for (const mediaFile of product.mediaFiles) {
          try {
            await deleteFile(mediaFile.id);
          } catch (deleteError) {
            console.error("Error deleting media file:", deleteError);
          }
        }
      }

      // Удаляем продукт (каскадно удалятся связанные записи)
      await product.destroy({ transaction });

      await transaction.commit();

      return res.json({ message: "Product deleted successfully" });
    } catch (e) {
      await transaction.rollback();
      console.error("Error deleting product:", e);
      next(ApiError.internal(e.message));
    }
  }

  // Удаление медиафайла продукта (только для админов)
  async deleteMedia(req, res, next) {
    try {
      const { productId, mediaId } = req.params;

      // Проверяем, существует ли продукт
      const product = await Product.findByPk(productId);
      if (!product) {
        return next(ApiError.notFound("Product not found"));
      }

      // Проверяем, принадлежит ли медиафайл этому продукту
      const mediaFile = await MediaFile.findOne({
        where: {
          id: mediaId,
          entityType: "product",
          entityId: productId,
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

module.exports = new ProductController();
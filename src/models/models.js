const sequelize = require("../db");
const { DataTypes } = require("sequelize");

async function cascadeDeleteMedia(instance, options) {
    const mediaableType = instance.mediaableType;
    const mediaableId = instance.id;
  
    await Media.destroy({
      where: {
        mediaableType,
        mediaableId,
      },
      transaction: options.transaction,
    });
  }

const User = sequelize.define(
  "user",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING, unique: true, allowNull: true },
    password: { type: DataTypes.STRING, allowNull: true },
    role: {
      type: DataTypes.ENUM("USER", "ADMIN"),
      defaultValue: "USER",
      allowNull: false,
    },
    language: { type: DataTypes.STRING, allowNull: true },
  }
);

const BasketItem = sequelize.define("basket_item", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "products", key: "id" },
    },
});

const Product = sequelize.define("product", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    gender: {
      type: DataTypes.ENUM("MAN", "WOMAN"),
      defaultValue: "MAN",
      allowNull: false,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    priceKZT: { type: DataTypes.INTEGER, allowNull: false },
    priceUSD: { type: DataTypes.INTEGER, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: true },
    color: { type: DataTypes.STRING, allowNull: true },
    ingredients: { type: DataTypes.STRING, allowNull: true },
    status: {
      type: DataTypes.ENUM("AVAILABLE", "SOLD", "DELETED"),
      defaultValue: "AVAILABLE",
      allowNull: false,
    },
    clothingTypeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "clothing_types", key: "id" },
    },
    collectionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "collections", key: "id" },
    },
});

const ClothingType = sequelize.define("clothing_type", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
});

const Size = sequelize.define("size", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { 
      type: DataTypes.STRING, 
      allowNull: false,
      unique: true 
    },
});

const Color = sequelize.define("color", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { 
      type: DataTypes.STRING, 
      allowNull: false,
      unique: true 
    },
    hexCode: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        is: /^#[0-9A-F]{6}$/i // Валидация hex цвета
      }
    },
});

const MediaFile = sequelize.define("media_file", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fileName: { type: DataTypes.STRING, allowNull: false },
    originalName: { type: DataTypes.STRING, allowNull: false },
    mimeType: { type: DataTypes.STRING, allowNull: false },
    size: { type: DataTypes.INTEGER, allowNull: false },
    bucket: { type: DataTypes.STRING, allowNull: false },
    url: { type: DataTypes.STRING, allowNull: true },
    entityType: {
      type: DataTypes.ENUM("product", "collection", "other"),
      defaultValue: "other",
      allowNull: false,
    },
    entityId: { type: DataTypes.INTEGER, allowNull: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
    },
  });

  const Collection = sequelize.define("collection", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: true },
  });

  const ProductSize = sequelize.define("product_size", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "products", key: "id" },
    },
    sizeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "sizes", key: "id" },
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ['productId', 'sizeId']
      }
    ]
  });

  const ProductColor = sequelize.define("product_color", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "products", key: "id" },
    },
    colorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "colors", key: "id" },
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ['productId', 'colorId']
      }
    ]
  });

  User.hasMany(BasketItem, { foreignKey: "userId", as: "basketItems" });
  User.hasMany(MediaFile, { foreignKey: "userId", as: "uploadedFiles" });

  Product.hasMany(MediaFile, { 
    foreignKey: "entityId", 
    as: "mediaFiles",
    scope: { entityType: "product" }
  });
  Product.belongsTo(ClothingType, { foreignKey: "clothingTypeId", as: "clothingType" });
  Product.hasMany(BasketItem, { foreignKey: "productId", as: "basketItems", onDelete: "CASCADE" });
  Product.belongsTo(Collection, { foreignKey: "collectionId", as: "collection" });


  Collection.hasMany(Product, { foreignKey: "collectionId", as: "products" });
  Collection.hasMany(MediaFile, { 
    foreignKey: "entityId", 
    as: "mediaFiles",
    scope: { entityType: "collection" }
  });

  ClothingType.hasMany(Product, { foreignKey: "clothingTypeId", as: "products" });

  // Many-to-many между Product и Size через ProductSize
  Product.belongsToMany(Size, { 
    through: ProductSize, 
    foreignKey: "productId",
    otherKey: "sizeId",
    as: "sizes" 
  });
  
  Size.belongsToMany(Product, { 
    through: ProductSize, 
    foreignKey: "sizeId",
    otherKey: "productId",
    as: "products" 
  });

  // Many-to-many между Product и Color через ProductColor
  Product.belongsToMany(Color, { 
    through: ProductColor, 
    foreignKey: "productId",
    otherKey: "colorId",
    as: "colors" 
  });
  
  Color.belongsToMany(Product, { 
    through: ProductColor, 
    foreignKey: "colorId",
    otherKey: "productId",
    as: "products" 
  });

  MediaFile.belongsTo(User, { foreignKey: "userId", as: "uploader" });

  BasketItem.belongsTo(User, { foreignKey: "userId", as: "user" });
  BasketItem.belongsTo(Product, { foreignKey: "productId", as: "product", onDelete: "CASCADE" });

  Product.addHook("afterDestroy", async (product, options) => {
    await MediaFile.destroy({
      where: {
        entityType: "product",
        entityId: product.id,
      },
      transaction: options.transaction,
    });
    
    // Удаляем связи с размерами
    await ProductSize.destroy({
      where: {
        productId: product.id,
      },
      transaction: options.transaction,
    });

    // Удаляем связи с цветами
    await ProductColor.destroy({
      where: {
        productId: product.id,
      },
      transaction: options.transaction,
    });
  });

  Collection.addHook("afterDestroy", async (collection, options) => {
    await MediaFile.destroy({
      where: {
        entityType: "collection",
        entityId: collection.id,
      },
      transaction: options.transaction,
    });
  });


  module.exports = {
    User,
    BasketItem,
    Product,
    ClothingType,
    MediaFile,
    Collection,
    Size,
    ProductSize,
    Color,
    ProductColor,
  };
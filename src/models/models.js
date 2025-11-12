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
    // Поля для гостевых пользователей
    isGuest: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: false, 
      allowNull: false 
    },
    guestSessionId: { 
      type: DataTypes.STRING, 
      unique: true, 
      allowNull: true 
    },
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
    selectedColorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "colors", key: "id" },
    },
    selectedSizeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "sizes", key: "id" },
    },
    quantity: { 
      type: DataTypes.INTEGER, 
      allowNull: false, 
      defaultValue: 1,
      validate: {
        min: 1
      }
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
      type: DataTypes.ENUM("product", "collection", "news", "other", "main_banner"),
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

  const Order = sequelize.define("order", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    status: {
      type: DataTypes.ENUM("CREATED", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"),
      defaultValue: "CREATED",
      allowNull: false,
    },
    recipientName: { type: DataTypes.STRING, allowNull: false },
    recipientAddress: { type: DataTypes.TEXT, allowNull: false },
    // Поля для гостевых заказов
    recipientPhone: { type: DataTypes.STRING, allowNull: true },
    recipientEmail: { type: DataTypes.STRING, allowNull: true },
    paymentMethod: {
      type: DataTypes.ENUM("TIPTOP_PAY"),
      defaultValue: "TIPTOP_PAY",
      allowNull: false,
    },
    // Поля для TipTopPay
    tipTopPayTransactionId: { type: DataTypes.STRING, allowNull: true },
    paymentStatus: {
      type: DataTypes.ENUM("PENDING", "SUCCESS", "FAILED", "CANCELLED"),
      allowNull: true,
    },
    totalKZT: { type: DataTypes.INTEGER, allowNull: false },
    totalUSD: { type: DataTypes.INTEGER, allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
  });

  const OrderItem = sequelize.define("order_item", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "orders", key: "id" },
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "products", key: "id" },
    },
    selectedColorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "colors", key: "id" },
    },
    selectedSizeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "sizes", key: "id" },
    },
    quantity: { 
      type: DataTypes.INTEGER, 
      allowNull: false, 
      defaultValue: 1,
      validate: {
        min: 1
      }
    },
    priceKZT: { type: DataTypes.INTEGER, allowNull: false },
    priceUSD: { type: DataTypes.INTEGER, allowNull: false },
  });

  // Модель для типов новостей
  const NewsType = sequelize.define("news_type", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { 
      type: DataTypes.STRING, 
      allowNull: false,
      unique: true 
    },
    description: { type: DataTypes.STRING, allowNull: true },
  });

  // Модель для тегов
  const Tag = sequelize.define("tag", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { 
      type: DataTypes.STRING, 
      allowNull: false,
      unique: true 
    },
    color: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        is: /^#[0-9A-F]{6}$/i // Валидация hex цвета
      }
    },
  });

  // Модель для новостей
  const News = sequelize.define("news", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    links: { 
      type: DataTypes.JSON, 
      allowNull: true,
      defaultValue: []
    },
    status: {
      type: DataTypes.ENUM("DRAFT", "PUBLISHED", "ARCHIVED"),
      defaultValue: "DRAFT",
      allowNull: false,
    },
    newsTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "news_types", key: "id" },
    },
    authorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    publishedAt: { type: DataTypes.DATE, allowNull: true },
  });

  // Промежуточная таблица для связи новостей и тегов
  const NewsTag = sequelize.define("news_tag", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    newsId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "news", key: "id" },
    },
    tagId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "tags", key: "id" },
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ['newsId', 'tagId']
      }
    ]
  });

  const MainBanner = sequelize.define("main_banner", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: true },
    isActive: { 
      type: DataTypes.BOOLEAN, 
      allowNull: false, 
      defaultValue: true 
    },
  });

  // Модель для кодов подтверждения email
  const EmailVerification = sequelize.define("email_verification", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    email: { 
      type: DataTypes.STRING, 
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    code: { 
      type: DataTypes.STRING, 
      allowNull: false,
      validate: {
        len: [4, 6] // Код должен быть от 4 до 6 символов
      }
    },
    type: {
      type: DataTypes.ENUM("REGISTRATION", "PASSWORD_RESET", "PASSWORD_RESET_LINK"),
      allowNull: false,
      defaultValue: "REGISTRATION"
    },
    isUsed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: () => new Date(Date.now() + 10 * 60 * 1000) // 10 минут
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
    }
  });

  User.hasMany(BasketItem, { foreignKey: "userId", as: "basketItems" });
  User.hasMany(MediaFile, { foreignKey: "userId", as: "uploadedFiles" });
  User.hasMany(News, { foreignKey: "authorId", as: "news" });
  User.hasMany(EmailVerification, { foreignKey: "userId", as: "emailVerifications" });

  Product.hasMany(MediaFile, { 
    foreignKey: "entityId", 
    as: "mediaFiles",
    scope: { entityType: "product" },
    constraints: false
  });
  Product.belongsTo(ClothingType, { foreignKey: "clothingTypeId", as: "clothingType" });
  Product.hasMany(BasketItem, { foreignKey: "productId", as: "basketItems", onDelete: "CASCADE" });
  Product.belongsTo(Collection, { foreignKey: "collectionId", as: "collection" });


  Collection.hasMany(Product, { foreignKey: "collectionId", as: "products" });
  Collection.hasMany(MediaFile, { 
    foreignKey: "entityId", 
    as: "mediaFiles",
    scope: { entityType: "collection" },
    constraints: false
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
  BasketItem.belongsTo(Color, { foreignKey: "selectedColorId", as: "selectedColor" });
  BasketItem.belongsTo(Size, { foreignKey: "selectedSizeId", as: "selectedSize" });

  // Связи для заказов
  User.hasMany(Order, { foreignKey: "userId", as: "orders" });
  Order.belongsTo(User, { foreignKey: "userId", as: "user" });
  
  Order.hasMany(OrderItem, { foreignKey: "orderId", as: "orderItems", onDelete: "CASCADE" });
  OrderItem.belongsTo(Order, { foreignKey: "orderId", as: "order" });
  
  OrderItem.belongsTo(Product, { foreignKey: "productId", as: "product", onDelete: "CASCADE" });
  OrderItem.belongsTo(Color, { foreignKey: "selectedColorId", as: "selectedColor" });
  OrderItem.belongsTo(Size, { foreignKey: "selectedSizeId", as: "selectedSize" });

  // Связи для новостей
  News.belongsTo(User, { foreignKey: "authorId", as: "author" });
  News.belongsTo(NewsType, { foreignKey: "newsTypeId", as: "newsType" });
  News.hasMany(MediaFile, { 
    foreignKey: "entityId", 
    as: "mediaFiles",
    scope: { entityType: "news" },
    constraints: false
  });

  // Many-to-many между News и Tag через NewsTag
  News.belongsToMany(Tag, { 
    through: NewsTag, 
    foreignKey: "newsId",
    otherKey: "tagId",
    as: "tags" 
  });
  
  Tag.belongsToMany(News, { 
    through: NewsTag, 
    foreignKey: "tagId",
    otherKey: "newsId",
    as: "news" 
  });

  NewsType.hasMany(News, { foreignKey: "newsTypeId", as: "news" });

  // Связи для главного баннера
  MainBanner.hasMany(MediaFile, { 
    foreignKey: "entityId", 
    as: "mediaFiles",
    scope: { entityType: "main_banner" },
    constraints: false
  });

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

  News.addHook("afterDestroy", async (news, options) => {
    await MediaFile.destroy({
      where: {
        entityType: "news",
        entityId: news.id,
      },
      transaction: options.transaction,
    });
    
    // Удаляем связи с тегами
    await NewsTag.destroy({
      where: {
        newsId: news.id,
      },
      transaction: options.transaction,
    });
  });

  MainBanner.addHook("afterDestroy", async (mainBanner, options) => {
    await MediaFile.destroy({
      where: {
        entityType: "main_banner",
        entityId: mainBanner.id,
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
    Order,
    OrderItem,
    News,
    NewsType,
    Tag,
    NewsTag,
    MainBanner,
    EmailVerification,
  };
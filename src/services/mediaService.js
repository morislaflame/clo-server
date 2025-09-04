const Minio = require('minio');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { MediaFile } = require('../models/models');

// Настройки MinIO клиента
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY
});

// Название основного бакета
const BUCKET_NAME = process.env.MINIO_BUCKET || 'clothing';

/**
 * Инициализация бакетов при запуске сервера
 */
async function initializeBuckets() {
  try {
    // Проверяем, существует ли основной бакет
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
    
    if (!bucketExists) {
      // Создаем бакет, если он не существует
      await minioClient.makeBucket(BUCKET_NAME, process.env.MINIO_REGION || 'us-east-1');
      console.log(`Bucket ${BUCKET_NAME} created`);
      
      // Устанавливаем политику доступа (публичный доступ на чтение)
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`]
          }
        ]
      };
      
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
      console.log(`Policy set for bucket ${BUCKET_NAME}`);
    } else {
      console.log(`Bucket ${BUCKET_NAME} already exists`);
    }
  } catch (error) {
    console.error('Error initializing buckets:', error);
    throw error;
  }
}

/**
 * Загрузка файла в MinIO
 * @param {Object} file Информация о файле из multer
 * @param {number} userId ID пользователя
 * @param {string} entityType Тип сущности (prize, raffle, user, other)
 * @param {number} entityId ID сущности
 * @returns {Promise<Object>} Информация о загруженном файле
 */
async function uploadFile(file, userId, entityType = 'other', entityId = null) {
  try {
    // Генерируем уникальное имя файла
    const extension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${extension}`;
    
    // Определяем путь в бакете в зависимости от типа сущности
    const filePath = `${entityType}/${fileName}`;
    
    // Загружаем файл в MinIO
    await minioClient.putObject(
      BUCKET_NAME,
      filePath,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype }
    );
    
    // Создаем публичный URL для доступа к файлу
    const fileUrl = `${process.env.MINIO_PUBLIC_URL || `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`}/${BUCKET_NAME}/${filePath}`;
    
    // Сохраняем информацию о файле в базе данных
    const mediaFile = await MediaFile.create({
      fileName: filePath,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      bucket: BUCKET_NAME,
      url: fileUrl,
      userId,
      entityType,
      entityId
    });
    
    return mediaFile;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

/**
 * Удаление файла из MinIO
 * @param {number} fileId ID файла
 * @returns {Promise<boolean>} Успешность операции
 */
async function deleteFile(fileId) {
  try {
    // Получаем информацию о файле из базы данных
    const mediaFile = await MediaFile.findByPk(fileId);
    
    if (!mediaFile) {
      throw new Error('File not found');
    }
    
    // Удаляем файл из MinIO
    await minioClient.removeObject(mediaFile.bucket, mediaFile.fileName);
    
    // Удаляем запись из базы данных
    await mediaFile.destroy();
    
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

/**
 * Получение временной ссылки на файл
 * @param {number} fileId ID файла
 * @param {number} expirySeconds Срок действия ссылки в секундах
 * @returns {Promise<string>} Временная ссылка
 */
async function getPresignedUrl(fileId, expirySeconds = 3600) {
  try {
    // Получаем информацию о файле из базы данных
    const mediaFile = await MediaFile.findByPk(fileId);
    
    if (!mediaFile) {
      throw new Error('File not found');
    }
    
    // Генерируем временную ссылку
    const presignedUrl = await minioClient.presignedGetObject(
      mediaFile.bucket,
      mediaFile.fileName,
      expirySeconds
    );
    
    return presignedUrl;
  } catch (error) {
    console.error('Error getting presigned URL:', error);
    throw error;
  }
}

module.exports = {
  initializeBuckets,
  uploadFile,
  deleteFile,
  getPresignedUrl,
  minioClient,
  BUCKET_NAME
};
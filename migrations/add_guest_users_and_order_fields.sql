-- Миграция для добавления поддержки гостевых пользователей и полей заказа
-- Дата создания: 2025-10-03

-- 1. Добавление полей для гостевых пользователей в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS isGuest BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guestSessionId VARCHAR(255) UNIQUE;

-- Создание индекса для быстрого поиска гостевых пользователей
CREATE INDEX IF NOT EXISTS idx_users_isGuest ON users(isGuest);
CREATE INDEX IF NOT EXISTS idx_users_guestSessionId ON users(guestSessionId);

-- 2. Добавление полей для контактных данных в таблицу orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipientPhone VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipientEmail VARCHAR(255);

-- Комментарии к полям
COMMENT ON COLUMN users.isGuest IS 'Является ли пользователь гостем (не зарегистрирован)';
COMMENT ON COLUMN users.guestSessionId IS 'Уникальный идентификатор сессии гостевого пользователя';
COMMENT ON COLUMN orders.recipientPhone IS 'Телефон получателя (для гостевых заказов)';
COMMENT ON COLUMN orders.recipientEmail IS 'Email получателя (для гостевых заказов)';

-- Проверка успешности миграции
SELECT 
    'Миграция завершена успешно' AS status,
    COUNT(*) FILTER (WHERE isGuest = true) AS guest_users_count,
    COUNT(*) FILTER (WHERE isGuest = false) AS registered_users_count
FROM users;



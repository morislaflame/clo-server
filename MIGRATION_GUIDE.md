# 🔄 Руководство по миграции БД для гостевых пользователей

## 📝 Обзор изменений

Добавлена поддержка гостевых пользователей и расширены возможности заказов.

### Изменения в моделях:

#### User (users)
- `isGuest` (BOOLEAN) - флаг гостевого пользователя
- `guestSessionId` (VARCHAR) - уникальный ID сессии гостя

#### Order (orders)
- `recipientPhone` (VARCHAR) - телефон получателя
- `recipientEmail` (VARCHAR) - email получателя

## 🚀 Применение миграции

### Вариант 1: Автоматическая миграция (для разработки)

Если вы в режиме разработки и можете потерять данные:

```javascript
// В clo-server/src/index.js
// Измените строку sync на:
await sequelize.sync({ alter: true });
```

Затем перезапустите сервер:
```bash
cd clo-server
npm start
```

⚠️ **ВНИМАНИЕ**: Это изменит структуру таблиц автоматически, но может привести к потере данных!

### Вариант 2: SQL миграция (для продакшена)

Безопасный способ для продакшена:

#### 1. Подключитесь к базе данных

```bash
# Если используете PostgreSQL
psql -U your_username -d your_database_name

# Если используете MySQL
mysql -u your_username -p your_database_name
```

#### 2. Выполните SQL миграцию

```bash
# PostgreSQL
psql -U your_username -d your_database_name -f migrations/add_guest_users_and_order_fields.sql

# MySQL (может потребоваться небольшая адаптация синтаксиса)
mysql -u your_username -p your_database_name < migrations/add_guest_users_and_order_fields.sql
```

Или выполните вручную:

```sql
-- 1. Добавление полей для гостевых пользователей
ALTER TABLE users ADD COLUMN isGuest BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN guestSessionId VARCHAR(255) UNIQUE;

-- Индексы для оптимизации
CREATE INDEX idx_users_isGuest ON users(isGuest);
CREATE INDEX idx_users_guestSessionId ON users(guestSessionId);

-- 2. Добавление полей для контактных данных в заказы
ALTER TABLE orders ADD COLUMN recipientPhone VARCHAR(255);
ALTER TABLE orders ADD COLUMN recipientEmail VARCHAR(255);
```

#### 3. Проверьте миграцию

```sql
-- Проверка структуры таблицы users
DESCRIBE users;
-- или для PostgreSQL:
\d users

-- Проверка структуры таблицы orders
DESCRIBE orders;
-- или для PostgreSQL:
\d orders
```

## 🧪 Тестирование после миграции

### 1. Запустите сервер

```bash
cd clo-server
npm start
```

### 2. Проверьте логи

Убедитесь, что нет ошибок при подключении к БД и синхронизации моделей.

### 3. Тестирование API

#### Создание гостевого пользователя

```bash
curl -X POST http://localhost:5000/api/user/guest \
  -H "Content-Type: application/json"
```

Ожидаемый ответ:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "isGuest": true,
  "userId": 123
}
```

#### Создание гостевого заказа

```bash
curl -X POST http://localhost:5000/api/order/guest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_GUEST_TOKEN" \
  -d '{
    "recipientName": "Иван Иванов",
    "recipientAddress": "г. Алматы, ул. Абая 123",
    "recipientPhone": "+77771234567",
    "recipientEmail": "ivan@example.com",
    "paymentMethod": "CASH",
    "notes": "Тестовый заказ",
    "items": [
      {
        "productId": 1,
        "quantity": 2,
        "selectedColorId": 5,
        "selectedSizeId": 3
      }
    ]
  }'
```

### 4. Проверка в БД

```sql
-- Проверка гостевых пользователей
SELECT id, isGuest, guestSessionId, createdAt 
FROM users 
WHERE isGuest = true
LIMIT 10;

-- Проверка заказов с контактными данными
SELECT id, recipientName, recipientPhone, recipientEmail, createdAt
FROM orders
ORDER BY createdAt DESC
LIMIT 10;
```

## 🧹 Очистка старых гостевых пользователей

### Ручная очистка

Создайте CRON задачу для периодической очистки:

```bash
# Добавьте в crontab (выполняется каждый день в 3:00)
0 3 * * * cd /path/to/clo-server && node -e "require('./src/utilities/cleanupGuests').cleanupOldGuests(30)"
```

### Использование скрипта

```javascript
// Создайте файл clo-server/scripts/cleanup.js
const { cleanupOldGuests, getGuestUsersStats } = require('../src/utilities/cleanupGuests');

async function run() {
  console.log('Getting stats...');
  const stats = await getGuestUsersStats();
  console.log('Guest users stats:', stats);

  console.log('\nCleaning up old guests...');
  const result = await cleanupOldGuests(30); // 30 дней
  console.log('Cleanup result:', result);
  
  process.exit(0);
}

run();
```

Запуск:
```bash
node scripts/cleanup.js
```

## 📊 Статистика

Получение статистики по гостевым пользователям:

```javascript
const { getGuestUsersStats } = require('./src/utilities/cleanupGuests');

const stats = await getGuestUsersStats();
console.log(stats);
// {
//   totalGuests: 150,
//   guestsWithOrders: 45,
//   guestsWithBasket: 30,
//   oldGuests: 75,
//   guestsWithoutActivity: 75
// }
```

## 🔙 Откат изменений (если необходимо)

Если нужно откатить миграцию:

```sql
-- Удаление новых полей из users
ALTER TABLE users DROP COLUMN IF EXISTS isGuest;
ALTER TABLE users DROP COLUMN IF EXISTS guestSessionId;
DROP INDEX IF EXISTS idx_users_isGuest;
DROP INDEX IF EXISTS idx_users_guestSessionId;

-- Удаление новых полей из orders
ALTER TABLE orders DROP COLUMN IF EXISTS recipientPhone;
ALTER TABLE orders DROP COLUMN IF EXISTS recipientEmail;
```

## ⚠️ Важные замечания

1. **Резервное копирование**: Всегда делайте бэкап БД перед миграцией
   ```bash
   # PostgreSQL
   pg_dump -U username database_name > backup_$(date +%Y%m%d).sql
   
   # MySQL
   mysqldump -u username -p database_name > backup_$(date +%Y%m%d).sql
   ```

2. **Тестирование**: Сначала примените миграцию на тестовом окружении

3. **Мониторинг**: После развертывания следите за логами и ошибками

4. **Очистка**: Настройте автоматическую очистку старых гостевых пользователей

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи сервера
2. Убедитесь, что миграция выполнена корректно
3. Проверьте версию Sequelize и БД
4. Обратитесь к документации Sequelize: https://sequelize.org/docs/v6/other-topics/migrations/



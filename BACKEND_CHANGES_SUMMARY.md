# ✅ Backend изменения - Сводка

## 🎯 Что было сделано

### 1. Обновленные файлы

#### 📄 `src/models/models.js`
- ✅ Добавлены поля в модель User:
  - `isGuest` (BOOLEAN) - флаг гостевого пользователя
  - `guestSessionId` (VARCHAR) - уникальный ID сессии
  
- ✅ Добавлены поля в модель Order:
  - `recipientPhone` (VARCHAR) - телефон получателя
  - `recipientEmail` (VARCHAR) - email получателя

#### 📄 `src/controllers/userController.js`
- ✅ Добавлен метод `createGuestUser()` - создание гостевого пользователя
  - Генерирует уникальный `guestSessionId`
  - Создает пользователя с флагом `isGuest: true`
  - Возвращает JWT токен для гостя

#### 📄 `src/routes/userRouter.js`
- ✅ Добавлен роут `POST /api/user/guest` - создание гостевой сессии

#### 📄 `src/controllers/orderController.js`
- ✅ Добавлен метод `createGuestOrder()` - создание заказа для гостей
  - Принимает массив товаров в теле запроса
  - Проверяет доступность товаров
  - Создает заказ с контактными данными
  - Не требует корзины на сервере

#### 📄 `src/routes/orderRouter.js`
- ✅ Добавлен роут `POST /api/order/guest` - создание гостевого заказа

### 2. Новые файлы

#### 📄 `migrations/add_guest_users_and_order_fields.sql`
- SQL миграция для обновления БД
- Добавление новых полей
- Создание индексов для оптимизации

#### 📄 `src/utilities/cleanupGuests.js`
- Утилита для очистки старых гостевых пользователей
- Функции:
  - `cleanupOldGuests(daysOld)` - удаление старых гостей
  - `forceCleanupGuestsWithoutOrders()` - принудительная очистка
  - `getGuestUsersStats()` - статистика по гостям

#### 📄 `MIGRATION_GUIDE.md`
- Полное руководство по применению миграции
- Инструкции для разработки и продакшена
- Примеры тестирования
- Инструкции по откату

#### 📄 `BACKEND_CHANGES_SUMMARY.md` (этот файл)
- Сводка всех изменений

## 🔌 Новые API endpoints

### 1. Создание гостевого пользователя
```
POST /api/user/guest
```

**Запрос:**
```json
{}
```

**Ответ:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "isGuest": true,
  "userId": 123
}
```

### 2. Создание гостевого заказа
```
POST /api/order/guest
Authorization: Bearer {token}
```

**Запрос:**
```json
{
  "recipientName": "Иван Иванов",
  "recipientAddress": "г. Алматы, ул. Абая 123",
  "recipientPhone": "+77771234567",
  "recipientEmail": "ivan@example.com",
  "paymentMethod": "CASH",
  "notes": "Комментарий к заказу",
  "items": [
    {
      "productId": 1,
      "quantity": 2,
      "selectedColorId": 5,
      "selectedSizeId": 3
    }
  ]
}
```

**Ответ:**
```json
{
  "message": "Order created successfully",
  "order": {
    "id": 456,
    "userId": 123,
    "recipientName": "Иван Иванов",
    "recipientAddress": "г. Алматы, ул. Абая 123",
    "recipientPhone": "+77771234567",
    "recipientEmail": "ivan@example.com",
    "paymentMethod": "CASH",
    "totalKZT": 50000,
    "totalUSD": 100,
    "status": "CREATED",
    "orderItems": [...]
  }
}
```

## 📊 Изменения в базе данных

### Таблица `users`
| Поле | Тип | Описание | Новое |
|------|-----|----------|-------|
| isGuest | BOOLEAN | Флаг гостевого пользователя | ✅ |
| guestSessionId | VARCHAR(255) | Уникальный ID сессии гостя | ✅ |

### Таблица `orders`
| Поле | Тип | Описание | Новое |
|------|-----|----------|-------|
| recipientPhone | VARCHAR(255) | Телефон получателя | ✅ |
| recipientEmail | VARCHAR(255) | Email получателя | ✅ |

### Новые индексы
- `idx_users_isGuest` - для быстрого поиска гостей
- `idx_users_guestSessionId` - для поиска по сессии

## 🚀 Следующие шаги

### 1. Применение миграции

```bash
# Перейдите в папку сервера
cd clo-server

# Вариант 1: Автоматическая миграция (разработка)
# В src/index.js измените sync на { alter: true }

# Вариант 2: SQL миграция (продакшен)
psql -U your_username -d your_database_name -f migrations/add_guest_users_and_order_fields.sql
```

### 2. Тестирование

```bash
# Запуск сервера
npm start

# Тестирование создания гостя
curl -X POST http://localhost:5000/api/user/guest

# Тестирование заказа (с токеном гостя)
curl -X POST http://localhost:5000/api/order/guest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipientName": "Test", ...}'
```

### 3. Настройка очистки

```bash
# Добавьте в crontab (опционально)
0 3 * * * node /path/to/clo-server/scripts/cleanup.js
```

## 🔍 Проверочный список

- [ ] Миграция БД применена успешно
- [ ] Сервер запускается без ошибок
- [ ] Endpoint `/api/user/guest` работает
- [ ] Endpoint `/api/order/guest` работает
- [ ] Токен гостевого пользователя валиден
- [ ] Заказы создаются корректно
- [ ] Данные сохраняются в БД
- [ ] Протестированы различные сценарии

## ⚠️ Важные замечания

1. **Авторизация**: Гостевые пользователи тоже получают JWT токен
2. **Срок жизни токена**: Токены истекают через 24 часа (настраивается в `generateJwt`)
3. **Очистка**: Рекомендуется настроить автоматическую очистку старых гостей
4. **Безопасность**: Гостевые пользователи имеют те же права, что и обычные USER

## 🐛 Возможные проблемы

### Ошибка при миграции
```
ERROR: column "isGuest" of relation "users" already exists
```
**Решение**: Поле уже существует, пропустите этот шаг

### Ошибка JWT
```
JsonWebTokenError: invalid token
```
**Решение**: Проверьте, что SECRET_KEY установлен в .env

### Ошибка создания заказа
```
Product not found
```
**Решение**: Убедитесь, что productId существует и товар AVAILABLE

## 📚 Дополнительная информация

- Документация по миграции: `MIGRATION_GUIDE.md`
- Полная документация: `../GUEST_CHECKOUT_IMPLEMENTATION.md`
- Утилиты: `src/utilities/cleanupGuests.js`

## ✨ Что дальше?

Теперь можно переходить к обновлению **Frontend части**!



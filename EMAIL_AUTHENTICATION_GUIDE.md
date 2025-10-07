# Email Authentication Guide

## Обзор

Система email аутентификации позволяет пользователям регистрироваться и сбрасывать пароли с подтверждением через email. Используется Titan Email для отправки кодов подтверждения.

## Настройка

### 1. Переменные окружения

Создайте файл `.env` в корне проекта `clo-server`:

```env
# Email Configuration (Titan Email)
EMAIL_USER=support@ghettoco.com
EMAIL_PASSWORD=your_email_password_here
```

### 2. Установка зависимостей

```bash
npm install nodemailer
```

### 3. Миграция базы данных

Выполните SQL миграцию для создания таблицы `email_verifications`:

```bash
psql -d your_database -f migrations/add_email_verification_table.sql
```

## API Endpoints

### 1. Отправка кода подтверждения для регистрации

**POST** `/api/user/send-registration-code`

```json
{
  "email": "user@example.com"
}
```

**Ответ:**
```json
{
  "message": "Verification code sent to your email",
  "expiresAt": "2024-01-01T12:10:00.000Z"
}
```

### 2. Регистрация с подтверждением кода

**POST** `/api/user/register-with-verification`

```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "code": "123456"
}
```

**Ответ:**
```json
{
  "token": "jwt_token_here",
  "message": "Registration successful"
}
```

### 3. Отправка кода для сброса пароля

**POST** `/api/user/send-password-reset-code`

```json
{
  "email": "user@example.com"
}
```

**Ответ:**
```json
{
  "message": "Password reset code sent to your email",
  "expiresAt": "2024-01-01T12:10:00.000Z"
}
```

### 4. Сброс пароля с подтверждением кода

**POST** `/api/user/reset-password-with-verification`

```json
{
  "email": "user@example.com",
  "newPassword": "newsecurepassword",
  "code": "123456"
}
```

**Ответ:**
```json
{
  "message": "Password reset successful"
}
```

## Процесс регистрации

1. **Шаг 1**: Пользователь вводит email и нажимает "Отправить код"
2. **Шаг 2**: Система проверяет, что пользователь с таким email не существует
3. **Шаг 3**: Генерируется 6-значный код и отправляется на email
4. **Шаг 4**: Пользователь вводит email, пароль и код подтверждения
5. **Шаг 5**: Система проверяет код и создает пользователя

## Процесс сброса пароля

1. **Шаг 1**: Пользователь вводит email и нажимает "Отправить код"
2. **Шаг 2**: Система проверяет, что пользователь с таким email существует
3. **Шаг 3**: Генерируется 6-значный код и отправляется на email
4. **Шаг 4**: Пользователь вводит email, новый пароль и код подтверждения
5. **Шаг 5**: Система проверяет код и обновляет пароль

## Безопасность

- Коды действительны в течение 10 минут
- Коды можно использовать только один раз
- Старые неиспользованные коды автоматически удаляются при создании новых
- Истекшие коды можно очистить с помощью функции `cleanupExpiredCodes()`

## Тестирование

Для тестирования email сервиса:

```bash
node test-email.js
```

## Структура базы данных

### Таблица `email_verifications`

| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL | Первичный ключ |
| email | VARCHAR(255) | Email адрес |
| code | VARCHAR(6) | Код подтверждения |
| type | VARCHAR(20) | Тип кода (REGISTRATION/PASSWORD_RESET) |
| is_used | BOOLEAN | Использован ли код |
| expires_at | TIMESTAMP | Время истечения |
| user_id | INTEGER | ID пользователя (для сброса пароля) |
| created_at | TIMESTAMP | Время создания |
| updated_at | TIMESTAMP | Время обновления |

## Обработка ошибок

### Возможные ошибки:

- `400 Bad Request`: Неверный email, отсутствующие поля, неверный код
- `404 Not Found`: Пользователь не найден (для сброса пароля)
- `500 Internal Server Error`: Ошибки отправки email, проблемы с базой данных

### Примеры ошибок:

```json
{
  "message": "User with this email already exists"
}
```

```json
{
  "message": "Invalid or expired verification code"
}
```

```json
{
  "message": "Verification code has expired"
}
```

## Мониторинг

Для мониторинга и очистки истекших кодов можно использовать:

```javascript
const verificationService = require('./src/services/verificationService');

// Очистка истекших кодов
const deletedCount = await verificationService.cleanupExpiredCodes();
console.log(`Cleaned up ${deletedCount} expired codes`);
```

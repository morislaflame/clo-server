# Быстрый старт: Email Аутентификация

## 🚀 Быстрая настройка

### 1. Установка зависимостей
```bash
cd clo-server
npm install nodemailer
```

### 2. Настройка переменных окружения
Создайте файл `.env` в папке `clo-server`:
```env
EMAIL_USER=support@ghettoco.com
EMAIL_PASSWORD=ваш_пароль_от_почты
```

### 3. Автоматическая настройка
```bash
node setup-email-auth.js
```

### 4. Миграция базы данных
```bash
psql -d your_database -f migrations/add_email_verification_table.sql
```

### 5. Тестирование
```bash
node test-email.js
```

## 📡 Новые API endpoints

| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/user/send-registration-code` | Отправить код для регистрации |
| POST | `/api/user/register-with-verification` | Регистрация с кодом |
| POST | `/api/user/send-password-reset-code` | Отправить код для сброса пароля |
| POST | `/api/user/reset-password-with-verification` | Сброс пароля с кодом |

## 🔧 Примеры использования

### Регистрация
```javascript
// 1. Отправить код
fetch('/api/user/send-registration-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});

// 2. Зарегистрироваться с кодом
fetch('/api/user/register-with-verification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
    code: '123456'
  })
});
```

### Сброс пароля
```javascript
// 1. Отправить код
fetch('/api/user/send-password-reset-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});

// 2. Сбросить пароль с кодом
fetch('/api/user/reset-password-with-verification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    newPassword: 'newpassword123',
    code: '123456'
  })
});
```

## ⚠️ Важные замечания

1. **Пароль от почты**: Убедитесь, что EMAIL_PASSWORD содержит правильный пароль от support@ghettoco.com
2. **Коды действительны 10 минут**: Пользователи должны ввести код в течение этого времени
3. **Один код = одно использование**: Коды нельзя использовать повторно
4. **Автоматическая очистка**: Истекшие коды можно очистить с помощью `verificationService.cleanupExpiredCodes()`

## 🐛 Решение проблем

### Ошибка подключения к email
- Проверьте EMAIL_PASSWORD в .env файле
- Убедитесь, что включен доступ для сторонних приложений в Titan Email
- Проверьте, что двухфакторная аутентификация отключена

### Коды не приходят
- Проверьте папку "Спам"
- Убедитесь, что email адрес корректен
- Проверьте логи сервера на наличие ошибок

## 📚 Полная документация
См. `EMAIL_AUTHENTICATION_GUIDE.md` для подробной информации.

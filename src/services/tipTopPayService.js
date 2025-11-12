const crypto = require('crypto');
const axios = require('axios');

class TipTopPayService {
  constructor() {
    this.publicId = process.env.TIP_TOP_PUBLIC_ID;
    this.apiKey = process.env.TIP_TOP_API_KEY;
    this.apiUrl = 'https://api.tiptoppay.kz/v1';
    
    if (!this.publicId || !this.apiKey) {
      console.warn('TipTopPay credentials not configured. Payment service may not work properly.');
    }
  }

  /**
   * Генерация подписи для запроса
   * @param {Object} data - Данные для подписи
   * @returns {string} - Подпись
   */
  generateSignature(data) {
    const sortedKeys = Object.keys(data).sort();
    const stringToSign = sortedKeys
      .map(key => `${key}=${data[key]}`)
      .join('&');
    
    return crypto
      .createHmac('sha256', this.apiKey)
      .update(stringToSign)
      .digest('hex');
  }

  /**
   * Создание платежа по криптограмме
   * @param {Object} paymentData - Данные платежа
   * @param {string} paymentData.cryptogram - Криптограмма карты
   * @param {number} paymentData.amount - Сумма платежа в тийынах
   * @param {string} paymentData.currency - Валюта (KZT, USD)
   * @param {string} paymentData.orderId - ID заказа
   * @param {string} paymentData.description - Описание платежа
   * @param {Object} paymentData.customer - Данные клиента
   * @returns {Promise<Object>} - Результат создания платежа
   */
  async createPaymentByCryptogram(paymentData) {
    try {
      const {
        cryptogram,
        amount,
        currency = 'KZT',
        orderId,
        description,
        customer = {}
      } = paymentData;

      const requestData = {
        publicId: this.publicId,
        cryptogram,
        amount: Math.round(amount * 100), // Конвертируем в тийыны
        currency: currency.toUpperCase(),
        orderId: orderId.toString(),
        description: description || `Оплата заказа #${orderId}`,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        customerName: customer.name,
      };

      // Удаляем пустые поля
      Object.keys(requestData).forEach(key => {
        if (requestData[key] === undefined || requestData[key] === null || requestData[key] === '') {
          delete requestData[key];
        }
      });

      const signature = this.generateSignature(requestData);
      requestData.signature = signature;

      const response = await axios.post(
        `${this.apiUrl}/payments/cryptogram`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('TipTopPay createPaymentByCryptogram error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        details: error.response?.data,
      };
    }
  }

  /**
   * Проверка статуса платежа
   * @param {string} transactionId - ID транзакции
   * @returns {Promise<Object>} - Статус платежа
   */
  async checkPaymentStatus(transactionId) {
    try {
      const requestData = {
        publicId: this.publicId,
        transactionId,
      };

      const signature = this.generateSignature(requestData);
      requestData.signature = signature;

      const response = await axios.post(
        `${this.apiUrl}/payments/status`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('TipTopPay checkPaymentStatus error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        details: error.response?.data,
      };
    }
  }

  /**
   * Подтверждение платежа (для двухстадийной схемы)
   * @param {string} transactionId - ID транзакции
   * @param {number} amount - Сумма подтверждения в тийынах
   * @returns {Promise<Object>} - Результат подтверждения
   */
  async confirmPayment(transactionId, amount) {
    try {
      const requestData = {
        publicId: this.publicId,
        transactionId,
        amount: Math.round(amount * 100), // Конвертируем в тийыны
      };

      const signature = this.generateSignature(requestData);
      requestData.signature = signature;

      const response = await axios.post(
        `${this.apiUrl}/payments/confirm`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('TipTopPay confirmPayment error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        details: error.response?.data,
      };
    }
  }

  /**
   * Отмена платежа
   * @param {string} transactionId - ID транзакции
   * @returns {Promise<Object>} - Результат отмены
   */
  async cancelPayment(transactionId) {
    try {
      const requestData = {
        publicId: this.publicId,
        transactionId,
      };

      const signature = this.generateSignature(requestData);
      requestData.signature = signature;

      const response = await axios.post(
        `${this.apiUrl}/payments/cancel`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('TipTopPay cancelPayment error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        details: error.response?.data,
      };
    }
  }

  /**
   * Возврат средств
   * @param {string} transactionId - ID транзакции
   * @param {number} amount - Сумма возврата в тийынах
   * @returns {Promise<Object>} - Результат возврата
   */
  async refundPayment(transactionId, amount) {
    try {
      const requestData = {
        publicId: this.publicId,
        transactionId,
        amount: Math.round(amount * 100), // Конвертируем в тийыны
      };

      const signature = this.generateSignature(requestData);
      requestData.signature = signature;

      const response = await axios.post(
        `${this.apiUrl}/payments/refund`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('TipTopPay refundPayment error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        details: error.response?.data,
      };
    }
  }

  /**
   * Проверка подписи уведомления от TipTopPay
   * @param {Object} notificationData - Данные уведомления
   * @param {string} signature - Подпись из заголовка
   * @returns {boolean} - Валидность подписи
   */
  verifyNotificationSignature(notificationData, signature) {
    try {
      const calculatedSignature = this.generateSignature(notificationData);
      return calculatedSignature === signature;
    } catch (error) {
      console.error('Error verifying notification signature:', error);
      return false;
    }
  }
}

module.exports = new TipTopPayService();


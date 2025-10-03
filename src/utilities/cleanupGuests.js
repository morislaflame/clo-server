const { User, Order, BasketItem } = require("../models/models");
const { Op } = require("sequelize");

/**
 * Очистка старых гостевых пользователей
 * Удаляет гостевых пользователей, которые:
 * - Старше указанного количества дней
 * - Не имеют заказов
 * - Не имеют товаров в корзине
 */
async function cleanupOldGuests(daysOld = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    console.log(`Starting cleanup of guest users older than ${daysOld} days (before ${cutoffDate.toISOString()})`);

    // Находим всех гостевых пользователей старше указанной даты
    const guestUsers = await User.findAll({
      where: {
        isGuest: true,
        createdAt: { [Op.lt]: cutoffDate }
      }
    });

    console.log(`Found ${guestUsers.length} old guest users`);

    let deletedCount = 0;
    let skippedCount = 0;

    for (const guest of guestUsers) {
      // Проверяем, есть ли у гостя заказы
      const ordersCount = await Order.count({
        where: { userId: guest.id }
      });

      // Проверяем, есть ли товары в корзине
      const basketCount = await BasketItem.count({
        where: { userId: guest.id }
      });

      if (ordersCount === 0 && basketCount === 0) {
        // Гость без заказов и корзины - можно удалить
        await guest.destroy();
        deletedCount++;
        console.log(`Deleted guest user ${guest.id} (session: ${guest.guestSessionId})`);
      } else {
        // Гость с заказами или товарами в корзине - оставляем
        skippedCount++;
        console.log(`Skipped guest user ${guest.id} (has ${ordersCount} orders, ${basketCount} basket items)`);
      }
    }

    console.log(`Cleanup completed: ${deletedCount} deleted, ${skippedCount} skipped`);
    
    return {
      success: true,
      deleted: deletedCount,
      skipped: skippedCount,
      total: guestUsers.length
    };
  } catch (error) {
    console.error('Error cleaning up guest users:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Принудительная очистка всех гостевых пользователей без заказов
 * (независимо от даты создания)
 */
async function forceCleanupGuestsWithoutOrders() {
  try {
    console.log('Starting force cleanup of all guest users without orders');

    const guestUsers = await User.findAll({
      where: {
        isGuest: true
      }
    });

    console.log(`Found ${guestUsers.length} guest users`);

    let deletedCount = 0;

    for (const guest of guestUsers) {
      const ordersCount = await Order.count({
        where: { userId: guest.id }
      });

      if (ordersCount === 0) {
        // Сначала удаляем все из корзины
        await BasketItem.destroy({
          where: { userId: guest.id }
        });
        
        // Затем удаляем пользователя
        await guest.destroy();
        deletedCount++;
      }
    }

    console.log(`Force cleanup completed: ${deletedCount} guest users deleted`);
    
    return {
      success: true,
      deleted: deletedCount
    };
  } catch (error) {
    console.error('Error force cleaning up guest users:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Получение статистики по гостевым пользователям
 */
async function getGuestUsersStats() {
  try {
    const totalGuests = await User.count({
      where: { isGuest: true }
    });

    const guestsWithOrders = await User.count({
      where: { isGuest: true },
      include: [{
        model: Order,
        as: 'orders',
        required: true
      }]
    });

    const guestsWithBasket = await User.count({
      where: { isGuest: true },
      include: [{
        model: BasketItem,
        as: 'basketItems',
        required: true
      }]
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const oldGuests = await User.count({
      where: {
        isGuest: true,
        createdAt: { [Op.lt]: thirtyDaysAgo }
      }
    });

    return {
      totalGuests,
      guestsWithOrders,
      guestsWithBasket,
      oldGuests: oldGuests,
      guestsWithoutActivity: totalGuests - guestsWithOrders - guestsWithBasket
    };
  } catch (error) {
    console.error('Error getting guest users stats:', error);
    return null;
  }
}

module.exports = {
  cleanupOldGuests,
  forceCleanupGuestsWithoutOrders,
  getGuestUsersStats
};


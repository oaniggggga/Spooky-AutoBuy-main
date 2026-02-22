const { delay } = require('./utils');
const { logInfo, logWarn } = require('./logging');

// Фиксированная анархия - боты всегда остаются на an402
const FIXED_AN = 'an402';

function chooseRandomAN() {
    // Всегда возвращаем an402
    return FIXED_AN;
}


async function connectToAN(bot, an = FIXED_AN) {
    // Всегда подключаемся к an402, игнорируем переданный параметр
    const targetAN = FIXED_AN;
    
    return new Promise(async (resolve) => {
        let confirmed = false;
        let alreadyConnected = false;

        const listener = (msgJson) => {
            const msg = msgJson.toString().replace(/\u00A7./g, '');
            // Успешное подключение или уже подключены
            if (msg.includes('Вы уже подключены на этот сервер!')) {
                alreadyConnected = true;
                confirmed = true;
            }
            // Телепортация на сервер (успешное первое подключение)
            if (msg.includes('Подключение к') || msg.includes('Телепортация') || msg.includes('Connecting')) {
                confirmed = true;
            }
        };

        bot.on('message', listener);
        bot.chat(`/${targetAN}`);
        
        // Ждём первую попытку
        await delay(3000);
        
        // Если не подтвердилось — пробуем ещё раз
        if (!confirmed) {
            bot.chat(`/${targetAN}`);
            await delay(5000);
        }
        
        bot.removeListener('message', listener);

        // Если получили любое подтверждение — считаем успехом
        // Если нет — всё равно считаем что подключились (команда отправлена)
        bot.currentAN = targetAN;
        
        if (confirmed) {
            logInfo(`[AN] (${bot.customUsername}) Подключение к ${targetAN} подтверждено (фиксированная анархия)`, 'auction');
        } else {
            logInfo(`[AN] (${bot.customUsername}) Команда /${targetAN} отправлена, продолжаем`, 'auction');
        }
        
        // Даём время на телепортацию
        await delay(alreadyConnected ? 2000 : 8000);
        resolve(true);
    });
}


async function connectToSellAN(bot) {
    // Всегда подключаемся к an402
    const success = await connectToAN(bot, FIXED_AN);
    if (success) {
        bot.activeSellAN = FIXED_AN;
        return true;
    } else {
        return false;
    }
}

module.exports = {
    chooseRandomAN,
    connectToAN,
    connectToSellAN,
    FIXED_AN
};

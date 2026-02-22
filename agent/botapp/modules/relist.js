const { logInfo, logWarn } = require('./logging');
const { targetItems } = require('./items');
const { waitForWindowOpen, closeWindow, delay } = require('./utils');
const { loadListedItems } = require('./listedItemsStore');
const { connectToAN, FIXED_AN } = require('./anManager');

async function checkMyLotsAndRelistIfNeeded(bot) {
    const now = Date.now();

    if (now - bot.lastRelistTime < 60_000) {
        const secLeft = Math.floor((60_000 - (now - bot.lastRelistTime)) / 1000);
        logInfo(`[Relist] Кулдаун не прошёл (осталось ~${secLeft} сек).`, 'auction');
        return;
    }

    logInfo(`[Relist] Старт перевыставления.`, 'auction');

    const listed = loadListedItems(bot.customUsername);
    if (!listed || listed.length === 0) {
        logInfo(`[Relist] У бота ${bot.customUsername} нет лотов.`, 'auction');
        return;
    }

    const { autoSell } = require('./ahParseBuy');
    
    // Всегда работаем только на фиксированной анархии an402
    bot.currentAN = FIXED_AN;
    const success = await connectToAN(bot, FIXED_AN);
    if (!success) {
        logWarn(`[Relist] Не удалось подключиться к ${FIXED_AN}`, 'auction');
        return;
    }

    logInfo(`[Relist] Перевыставляем ${listed.length} лотов на ${FIXED_AN}`, 'auction');
    await delay(15000);

    const ahWindowPromise = waitForWindowOpen(bot, 25000);
    bot.chat('/ah');
    const ahWindow = await ahWindowPromise;
    if (!ahWindow) {
        logWarn(`[Relist] Не удалось открыть окно аукциона`, 'auction');
        return;
    }

    const myLotsWindowPromise = waitForWindowOpen(bot, 20000);
    await bot.clickWindow(46, 0, 0);
    await delay(500);
    const myLotsWindow = await myLotsWindowPromise;
    if (!myLotsWindow) {
        closeWindow(bot);
        logWarn(`[Relist] Не удалось открыть окно "Мои лоты"`, 'auction');
        return;
    }

    await delay(500);

    for (let i = 0; i < 3; i++) {
        await bot.clickWindow(0, 0, 0);
        await delay(300);
    }

    await autoSell(bot, targetItems);

    closeWindow(bot);

    logInfo(`[Relist] Завершено перевыставление на ${FIXED_AN}`, 'auction');

    bot.lastRelistTime = Date.now();
    bot.myListedItems = listed;

    await delay(15000);
}

module.exports = {
    checkMyLotsAndRelistIfNeeded
};

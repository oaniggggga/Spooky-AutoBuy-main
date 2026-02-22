

const {
    delay,
    closeWindow,
    extractAllItemsFromWindow,
    parseLore,
    getLoreFromNbt,
    waitForWindowOpen,
    extractPlainText,
} = require('./utils');

const { logInfo, logWarn, logError } = require('./logging');
const { targetItems, shouldPurchaseItem } = require('./items');
const { getHistoricalPrice, getHistoricalSellPrice } = require('./priceStore');

const { checkMyLotsAndRelistIfNeeded } = require('./relist');
const { getBotTaskQueueSize, enqueueTask } = require('./tasks');
const { getInventoryMatchedTarget } = require('./inventoryCleaner');
const { loadListedItems, saveListedItems } = require('./listedItemsStore');
const { connectToSellAN, connectToAN, chooseRandomAN } = require('./anManager');
const { toList, toNumber } = require('./helpers/nbt');
const { statisticsCollector } = require('./purchaseStatistics');
let currentBalance = null;

// Глобальная переменная для отслеживания статистики
function initializeStatisticsIntegration() {
    try {
        statisticsCollector.initializeEventListeners();
        logInfo('[Statistics Integration] Purchase statistics integration initialized', 'auction');
    } catch (error) {
        logWarn(`[Statistics Integration] Failed to initialize: ${error.message}`, 'auction');
    }
}

// Инициализация интеграции
initializeStatisticsIntegration();


function startBalanceUpdater(bot) {
    setInterval(async () => {
        try {
            const bal = await getBotBalance(bot);
            if (bal !== null) {
                currentBalance = bal;
                bot.balance = bal;
                logInfo(
                    `[BalanceUpdater] (${bot.customUsername}) Текущий баланс: $${bal}`,
                    'auction'
                );
            } else {
                logWarn(
                    `[BalanceUpdater] (${bot.customUsername}) Не удалось получить баланс`,
                    'auction'
                );
            }
        } catch (err) {
            logWarn(
                `[BalanceUpdater] (${bot.customUsername}) Ошибка: ${err.message}`,
                'auction'
            );
        }
    }, 15_000);
}


async function parseAndBuyFromAh(bot) {
    // Проверяем глобальную переменную из botapp.js
    const botappModule = require('../botapp');
    if (botappModule.isPriceUpdateInProgress) {
        logInfo(`[parseAndBuyFromAh] (${bot.customUsername}) Идет обновление цен - парсинг и покупки приостановлены`, 'auction');
        return;
    }

    if (bot.waitingForSaleBeforeBuy) {
        logInfo(`[parseAndBuyFromAh] (${bot.customUsername}) ???? ???????, ?????????? ???????.`, 'auction');
        return;
    }
    logInfo(`[InfiniteAH] (${bot.customUsername}) ?????? ???????? /ah`, 'auction');

    const MAX_FAILED_ATTEMPTS = 10;
    let failedPurchaseAttempts = 0;

    const MAX_UPDATE_RETRIES = 3;
    let updateRetryCount = 0;

    while (true) {
        if (getBotTaskQueueSize(bot) > 1) {
            logInfo(
                `[InfiniteAH] ? ???? ${bot.customUsername} ???? ?????? ?????? (${getBotTaskQueueSize(
                    bot
                )}). ???????...`,
                'auction'
            );
            break;
        }

        if (failedPurchaseAttempts >= MAX_FAILED_ATTEMPTS) {
            logError(
                `[InfiniteAH] ????? ?????? ??????? (${MAX_FAILED_ATTEMPTS}) ?????????, ???????????????`,
                'auction'
            );
            break;
        }

        let ahWindow = bot.currentWindow;
        if (!ahWindow) {
            try {
                await delay(400);
                const windowPromise = waitForWindowOpen(bot, 10000);
                bot.chat('/ah');
                ahWindow = await windowPromise;
                if (!ahWindow) {
                    logWarn(`[InfiniteAH] /ah ???? ?? ?????????`, 'auction');
                    await delay(2000);
                    continue;
                }
                logInfo(`[InfiniteAH] (${bot.customUsername}) ???? /ah ???????`, 'auction');
                await delay(800);
            } catch (err) {
                logWarn(
                    `[InfiniteAH] (${bot.customUsername}) ?????? ??? /ah: ${err.message}`,
                    'auction'
                );
                await delay(1000);
                continue;
            }
        }

        let items = extractAllItemsFromWindow(ahWindow);
        if (items.length === 0) {
            logWarn(`[InfiniteAH] ?? /ah ??? ?????????`, 'auction');
        } else {
            logInfo(`[InfiniteAH] ??????? ${items.length} ????? ?? /ah`, 'auction');

            const potentialBuys = await findPotentialBuys(bot, items);
            logInfo(
                `[InfiniteAH] ?????????? ????? ? ??????? (? ?????? ????): ${potentialBuys.length}`,
                'auction'
            );

            if (potentialBuys.length > 0) {
                for (const lot of potentialBuys) {
                    if (getBotTaskQueueSize(bot) > 1) {
                        logInfo(
                            `[InfiniteAH] ? ???? ${bot.customUsername} ????????? ????? ?????? (${getBotTaskQueueSize(
                                bot
                            )}). ????????? ????`,
                            'auction'
                        );
                        break;
                    }
                    if (failedPurchaseAttempts >= MAX_FAILED_ATTEMPTS) {
                        logWarn(`[InfiniteAH] ???????? ????? ??????`, 'auction');
                        break;
                    }

                    const bal = bot.balance ?? 0;
                    if (bal < lot.price) {
                        logWarn(
                            `[InfiniteAH] ???????????? ?????: $${bal}, ????? $${lot.price}`,
                            'auction'
                        );
                        continue;
                    }

                    logInfo(
                        `[InfiniteAH] ????????: ${lot.name} x${lot.count} ?? $${lot.price}`,
                        'auction'
                    );
                    const success = await buyItem(bot, lot);
                    if (success) {
                        logInfo(
                            `[InfiniteAH] ??????? ???????: ${lot.name} x${lot.count} ?? $${lot.price}`,
                            'auction'
                        );

                        // ?????????? ?????????? ???????
                        try {
                            const matchedTarget = getMatchedTarget(lot);
                            const purchaseDetails = {
                                itemName: lot.name,
                                enchantments: lot.enchantments || [],
                                attributes: lot.attributes || {},
                                rarity: lot.rarity || 'common',
                                source: 'auction_house'
                            };
                            statisticsCollector.recordPurchase(
                                lot.name,
                                lot.price,
                                new Date(),
                                purchaseDetails
                            );
                        } catch (statsError) {
                            logWarn(`[InfiniteAH] ?????? ?????? ?????????? ???????: ${statsError.message}`, 'auction');
                        }
                        const matchedTarget = getMatchedTarget(lot);
                        const sellUnitPrice = (matchedTarget && matchedTarget.sellPrice)
                            ? matchedTarget.sellPrice
                            : (lot.price / lot.count);
                        await autoSell(bot, targetItems);
                        await delay(400);
                    } else {
                        logWarn(`[InfiniteAH] ??????? ?? ???????`, 'auction');
                        failedPurchaseAttempts++;
                        logWarn(
                            `[InfiniteAH] ?????? ???????: ${failedPurchaseAttempts}/${MAX_FAILED_ATTEMPTS}`,
                            'auction'
                        );
                    }
                }

                await clickRefreshAndParseAgain(bot);
                updateRetryCount = 0;
                continue;
            }
        }

        logInfo(`[InfiniteAH] ??? ?????????? ?????, ???? "????????"`, 'auction');
        const oldItems = items;
        let newWindow = await clickRefreshAndParseAgain(bot);
        if (!newWindow) {
            continue;
        }
        let newItems = extractAllItemsFromWindow(newWindow);
        if (areItemsEqual(oldItems, newItems)) {
            updateRetryCount++;
            logWarn(
                `[InfiniteAH] "????????" ?? ???????? ??????. ?????? ?${updateRetryCount}`,
                'auction'
            );
            if (updateRetryCount >= MAX_UPDATE_RETRIES) {
                logWarn(
                    `[InfiniteAH] ???????? ????. ???????? ??? ????? ?????`,
                    'auction'
                );
                break;
            }
        } else {
            updateRetryCount = 0;
            logInfo(`[InfiniteAH] ?????? ????? ?????????`, 'auction');
        }
        if (bot.waitingForSaleBeforeBuy) {
            logInfo(`[parseAndBuyFromAh] (${bot.customUsername}) ? ???????? ????? ???? waitingForSaleBeforeBuy ???? true. ?????????.`, 'auction');
            break;
        }
    }

    closeWindow(bot);
    logInfo(
        `[InfiniteAH] (${bot.customUsername}) ???? ???????? /ah ??????????`,
        'auction'
    );
}

async function clickRefreshAndParseAgain(bot) {
    try {
        await delay(400);
        if (!bot.currentWindow) return null;
        const updPromise = waitForWindowOpen(bot, 5000);
        await bot.clickWindow(49, 0, 0);
        const newWindow = await updPromise;
        if (!newWindow) {
            logWarn(`[InfiniteAH] ?? ???????? ???? ????? "????????"`, 'auction');
            closeWindow(bot);
            return null;
        }
        return newWindow;
    } catch (err) {
        logWarn(`[InfiniteAH] ?????? ??? "????????": ${err.message}`, 'auction');
        closeWindow(bot);
        return null;
    }
}


async function buyItem(bot, lot) {
    if (!bot.currentWindow) {
        logWarn(`[InfiniteAH] buyItem: ??? ????????? ????`, 'auction');
        return false;
    }
    return new Promise(async (resolve) => {
        let chatHandler, windowOpenHandler;
        let timeout;

        const cleanup = () => {
            bot.removeListener('message', chatHandler);
            bot.removeListener('windowOpen', windowOpenHandler);
            if (timeout) clearTimeout(timeout);
        };

        chatHandler = (msgJson) => {
            const text = msgJson.toString().replace(/\u00A7./g, '').toLowerCase();
            if (text.includes('?? ??????? ??????')) {
                logInfo(`[InfiniteAH] ??????? ????????????: ${text}`, 'auction');
                cleanup();
                resolve(true);
            } else if (
                text.includes('??? ??????') ||
                text.includes('?? ??????? ??????') ||
                text.includes('??????? ????????') ||
                text.includes('?? ??? ??????') ||
                text.includes('?????????? ?????????')
            ) {
                logWarn(`[InfiniteAH] ??????? ?? ???????: ${text}`, 'auction');

                // ?????????? ?????????? ??????????? ???????
                try {
                    let reason = 'unknown';
                    if (text.includes('??? ??????')) reason = 'already_sold';
                    else if (text.includes('?? ??? ??????')) reason = 'too_slow';
                    else if (text.includes('?????????? ?????????')) reason = 'insufficient_funds';
                    else if (text.includes('?? ??????? ??????')) reason = 'purchase_failed';
                    else if (text.includes('??????? ????????')) reason = 'purchase_cancelled';

                    statisticsCollector.recordMissedPurchase(
                        lot.name,
                        reason,
                        new Date(),
                        lot.price
                    );
                } catch (statsError) {
                    logWarn(`[InfiniteAH] ?????? ?????? ?????????? ??????????? ???????: ${statsError.message}`, 'auction');
                }

                cleanup();
                resolve(false);
            }
        };

        windowOpenHandler = async (win) => {
            let title = win && win.title ? String(win.title).toLowerCase() : '';
            if (title.includes('??????') || title.includes('confirm')) {
                const suspiciousSlotItem = win.slots[13];
                if (suspiciousSlotItem && suspiciousSlotItem.name === lot.name) {
                    logInfo(`[InfiniteAH] ???????????? ??????? (?????? ????)`, 'auction');
                    await bot.clickWindow(11, 0, 0);
                } else {
                    logWarn(
                        `[InfiniteAH] ??????? ? ????????????? ?? ?????????, ????????`,
                        'auction'
                    );
                    await bot.clickWindow(17, 0, 0);
                    closeWindow(bot);
                    cleanup();
                    resolve(false);
                }
            }
        };

        bot.on('message', chatHandler);
        bot.on('windowOpen', windowOpenHandler);

        const slotItem = bot.currentWindow.slots[lot.slotIndex];
        if (!slotItem) {
            logWarn(`[InfiniteAH] ???? ${lot.slotIndex} ????`, 'auction');
            cleanup();
            return resolve(false);
        }
        if (slotItem.name !== lot.name) {
            logWarn(
                `[InfiniteAH] ???? ???????? ${slotItem.name}, ??????? ${lot.name}`,
                'auction'
            );
            cleanup();
            return resolve(false);
        }
        const matchedTarget = getMatchedTarget(slotItem);
        if (!matchedTarget) {
            logWarn(
                `[InfiniteAH] ??????? ? ????? ?? ????????????? ??????????? NBT, ??????? ????????`,
                'auction'
            );
            cleanup();
            return resolve(false);
        }
        const loreInfo = parseSlotLore(slotItem);
        if (!loreInfo || loreInfo.price !== lot.price) {
            logWarn(`[InfiniteAH] ???? ???? ??????????`, 'auction');
            cleanup();
            return resolve(false);
        }

        try {
            await bot.clickWindow(lot.slotIndex, 0, 1);
        } catch (err) {
            logError(`[InfiniteAH] ?????? ??? ?????: ${err.message}`, 'auction');
            cleanup();
            return resolve(false);
        }

        timeout = setTimeout(() => {
            logWarn(`[InfiniteAH] ??????? ???????`, 'auction');
            cleanup();
            resolve(false);
        }, 5000);
    });
}


async function autoSell(bot, targetItems) {
    try {
        if (bot.currentWindow) {
            closeWindow(bot);
            await delay(300);
        }

        const inventoryItems = bot.inventory.items();

        if (!bot.activeSellAN) {
            const chosenAN = chooseRandomAN();
            bot.activeSellAN = chosenAN;
            logInfo(`[AutoSell] (${bot.customUsername}) ??????? ?????-???????: ${chosenAN}`, 'auction');
        }

        const connected = await connectToAN(bot, bot.activeSellAN);
        if (!connected) {
            logWarn(`[AutoSell] (${bot.customUsername}) ?? ??????? ???????????? ? ${bot.activeSellAN} ????? ????????`, 'auction');
            return;
        }



        let stopSelling = false;

        for (const item of inventoryItems) {
            if (stopSelling) break;

            const matchedTarget = getInventoryMatchedTarget(item, targetItems);
            if (!matchedTarget) continue;

            const count = item.count;
            // ИСПРАВЛЕНО: Пытаемся взять актуальную цену из хранилища (priceStore)
            // Если её нет в истории, берем sellPrice из конфига, иначе $2500 (стандарт для ценных вещей)
            let unitPrice = getHistoricalSellPrice(matchedTarget.displayName);

            if (unitPrice === null || unitPrice === undefined) {
                unitPrice = matchedTarget.sellPrice || 10; // Минимум 10 по умолчанию
            }

            let totalPrice = unitPrice * count;

            // Сервер не дает выставлять дешевле $10
            if (totalPrice < 10) {
                logWarn(`[AutoSell] (${bot.customUsername}) Цена ${totalPrice} слишком низкая, повышаем до $10`, 'auction');
                totalPrice = 10;
            }

            logInfo(
                `[AutoSell] (${bot.customUsername}) ?????? ???????: ${item.name} x${count}, fullPrice=${totalPrice}`,
                'auction'
            );

            try {
                await bot.equip(item, 'hand');
                await delay(300);
            } catch (err) {
                logWarn(
                    `[AutoSell] (${bot.customUsername}) ?????? ??? ?????????? ???????? ${item.name}: ${err.message}`,
                    'auction'
                );
                continue;
            }

            const maxAttempts = 5;
            let attempt = 1;
            let sold = false;

            while (!sold && attempt <= maxAttempts) {
                logInfo(
                    `[AutoSell] (${bot.customUsername}) ?????????? ??????? ???????: /ah sell ${totalPrice} (??????? ${attempt} ?? ${maxAttempts})`,
                    'auction'
                );

                const result = await new Promise((resolve) => {
                    let resolved = false;
                    const timeoutDuration = 5000;

                    const onMessage = (msg) => {
                        const rawText = msg.toString();
                        const text = rawText.replace(/\u00A7./g, '').toLowerCase();

                        if (text.includes('?? ??????? ???????') || text.includes('????????? ?? ???????')) {
                            logInfo(
                                `[AutoSell] (${bot.customUsername}) ??????? ????????????: ${text}`,
                                'auction'
                            );

                            // ?????????? ?????????? ???????
                            try {
                                // ???????? ????? ???? ??????? ?? matchedTarget ??? ?????????? ??????????????? ??????
                                const estimatedPurchasePrice = matchedTarget.buyPrice || (totalPrice * 0.7); // ????????? ??????
                                statisticsCollector.recordSale(
                                    item.name,
                                    totalPrice,
                                    estimatedPurchasePrice,
                                    new Date()
                                );
                            } catch (statsError) {
                                logWarn(`[AutoSell] ?????? ?????? ?????????? ???????: ${statsError.message}`, 'auction');
                            }

                            if (!bot.myListedItems) {
                                bot.myListedItems = [];
                            }
                            logInfo(`[AutoSell] (${bot.customUsername}) bot.currentAN = ${bot.currentAN}`, 'auction');
                            const listedLot = {
                                anNumber: bot.activeSellAN ? bot.activeSellAN : 'unknown',
                                price: totalPrice,
                                count: count,
                                timestamp: Date.now()
                            };
                            bot.myListedItems.push(listedLot);

                            saveListedItems(bot.customUsername, bot.myListedItems);

                            resolved = true;
                            cleanup();
                            resolve(true);
                        }

                        else if (text.includes('?????????? ?????????') || text.includes('??????? ???????? ? ???????')) {
                            logWarn(
                                `[AutoSell] (${bot.customUsername}) ?????? ??????? ?????????? ?????????: ${text}`,
                                'auction'
                            );
                            resolved = true;
                            cleanup();

                            bot.waitingForSaleBeforeBuy = true;

                            enqueueTask(bot, async () => {
                                logInfo(`[AutoSell] (${bot.customUsername}) ????????? ??????????????? ?????...`, 'auction');
                                await checkMyLotsAndRelistIfNeeded(bot);
                            });
                            resolve("clearStorage");
                        }

                        else if (text.includes('???????????? ???? ?? ???? ?????')) {
                            logWarn(
                                `[AutoSell] (${bot.customUsername}) ????????? ??????????? ?? ????: ${rawText}`,
                                'auction'
                            );
                            const priceMatch = rawText.match(/\$(\d[\d,\.]*)/);
                            if (priceMatch) {
                                const parsedMaxPrice = Number(priceMatch[1].replace(/[^\d]/g, ''));
                                if (!isNaN(parsedMaxPrice)) {
                                    resolved = true;
                                    cleanup();
                                    resolve({ maxPriceUpdate: parsedMaxPrice });
                                    return;
                                }
                            }
                            resolved = true;
                            cleanup();
                            resolve(false);
                        }

                        else if (
                            text.includes('?? ???????') ||
                            text.includes('?? ??? ??????') ||
                            text.includes('??????? ????????')
                        ) {
                            logWarn(
                                `[AutoSell] (${bot.customUsername}) ??????? ?? ???????: ${text}`,
                                'auction'
                            );
                            resolved = true;
                            cleanup();
                            resolve(false);
                        }
                    };

                    function cleanup() {
                        bot.removeListener('message', onMessage);
                    }

                    bot.on('message', onMessage);
                    if (false) {
                        logWarn(`[parseAndBuyFromAh] (${bot.customUsername}) awaitingSale=true, ?????????? /ah sell`);
                    } else {
                        bot.chat(`/ah sell ${totalPrice}`);
                    }

                    setTimeout(() => {
                        if (!resolved) {
                            logWarn(
                                `[AutoSell] (${bot.customUsername}) ??????? ????????????? ??????? (??????? ${attempt})`,
                                'auction'
                            );
                            cleanup();
                            resolve(false);
                        }
                    }, timeoutDuration);
                });

                if (result === true) {
                    sold = true;
                } else if (result === "clearStorage") {
                    logWarn(`[AutoSell] (${bot.customUsername}) ????????? ???????????, ????????????? ??????? ???????? ????????.`);
                    stopSelling = true;
                    break;
                } else if (result && typeof result === 'object' && result.maxPriceUpdate) {
                    const newPrice = result.maxPriceUpdate;
                    logInfo(
                        `[AutoSell] (${bot.customUsername}) ?????????? ????? ???????????? ????: ${newPrice}`,
                        'auction'
                    );
                    totalPrice = newPrice;
                    attempt++;
                } else {
                    attempt++;
                }
            }

            if (stopSelling) {
                logWarn(`[AutoSell] (${bot.customUsername}) ?????????? ?????????? ??????? ????????? ?? ???????.`);
                break;
            }

            if (!sold && !stopSelling) {
                logWarn(
                    `[AutoSell] (${bot.customUsername}) ??????? ${item.name} (x${count}) ?? ??????? ??????? ????? ${maxAttempts} ???????.`,
                    'auction'
                );
            }
        }

        logInfo(`[AutoSell] (${bot.customUsername}) ??????? ???? ?????????? ????????? ?????????.`, 'auction');
    } catch (err) {
        logError(
            `[AutoSell] (${bot.customUsername}) ?????? ? ???????? ???????? ???????: ${err.message}`,
            'auction'
        );
    }
}


function parseSlotLore(slotItem) {
    if (!slotItem) return null;
    const loreArray = slotItem.nbt ? getLoreFromNbt(slotItem.nbt) : [];
    const { isAuction, price } = parseLore(loreArray);
    if (!isAuction) return null;
    return { price };
}


function getBotBalance(bot) {
    return new Promise((resolve) => {
        let done = false;
        let timer = null;

        function cleanup() {
            bot.removeListener('message', onMsg);
            if (timer) clearTimeout(timer);
        }

        const onMsg = (jsonMsg) => {
            const rawText = jsonMsg.toString().replace(/\u00A7./g, '');
            const match = rawText.match(/\$([\d,\.]+)/);
            if (match) {
                const balStr = match[1].replace(/,/g, '');
                const bal = parseFloat(balStr);
                if (!isNaN(bal)) {
                    done = true;
                    cleanup();
                    resolve(bal);
                }
            }
        };

        bot.on('message', onMsg);
        bot.chat('/money');

        timer = setTimeout(() => {
            if (!done) {
                cleanup();
                resolve(null);
            }
        }, 3000);
    });
}


async function checkWithHelper(helperBot, itemId, seller) {
    return true;
}



async function checkWithHelper2(helperBot, targetItem, seller) {
    return true;
}



async function findPotentialBuys(bot, items) {
    const validCandidates = [];

    for (const lot of items) {
        if (!lot.price || lot.price <= 0) {
            logWarn(
                `[PotentialBuys] Пропускаем лот с недопустимой ценой: ${lot.name} от ${lot.seller}`,
                'auction'
            );
            continue;
        }

        const matchedTarget = getMatchedTarget(lot);
        if (!matchedTarget) continue;

        // ????????? ??????? ?? ??????? ??? ???????
        if (!shouldPurchaseItem(matchedTarget)) {
            logInfo(
                `[PotentialBuys] Предмет ${matchedTarget.displayName} (${matchedTarget.id}) отключен для покупки`,
                'auction'
            );
            continue;
        }

        // ИСПРАВЛЕНО: Используем buyPrice вместо sellPrice для определения выгодных покупок
        let targetBuyPrice = matchedTarget.buyPrice;
        if (targetBuyPrice === null || targetBuyPrice === undefined) {
            // Fallback на исторические данные если buyPrice не установлен
            const historicalSellPrice = getHistoricalSellPrice(matchedTarget.displayName);
            if (historicalSellPrice !== null && historicalSellPrice !== undefined) {
                // Если есть только sellPrice, вычисляем buyPrice как ~79% от него
                targetBuyPrice = Math.floor(historicalSellPrice * 0.79); // 0.75/0.95 ≈ 0.79
                matchedTarget.buyPrice = targetBuyPrice;
            }
        }

        const unitPrice = lot.price / lot.count;

        if (
            targetBuyPrice !== null &&
            targetBuyPrice !== undefined &&
            unitPrice < targetBuyPrice
        ) {
            validCandidates.push({ lot, matchedTarget, unitPrice });
        } else {
            logInfo(
                `[PotentialBuys] Лот ${lot.name} от ${lot.seller} с ценой за единицу $${unitPrice.toFixed(2)} не проходит фильтр (buyPrice: $${targetBuyPrice})`,
                'auction'
            );
        }
    }

    if (validCandidates.length > 0) {
        logInfo(
            `[PotentialBuys] (${bot.customUsername}) Кандидаты для покупки (после фильтра по цене):`,
            'auction'
        );
        for (const candidate of validCandidates) {
            logInfo(
                `[PotentialBuys] (${bot.customUsername}) Лот ${candidate.lot.name} от ${candidate.lot.seller} с unitPrice $${candidate.unitPrice.toFixed(2)} (buyPrice: $${candidate.matchedTarget.buyPrice})`,
                'auction'
            );
        }
    } else {
        logInfo(
            `[PotentialBuys] (${bot.customUsername}) Нет кандидатов после фильтра по цене`,
            'auction'
        );
        return [];
    }

    const finalBuys = validCandidates.map(c => c.lot);
    logInfo(`[PotentialBuys] (${bot.customUsername}) Используем ${finalBuys.length} лотов без проверки helper.`, 'auction');
    return finalBuys;
}



function getMatchedTarget(lot) {

    const candidates = targetItems.filter((ti) => ti.name === lot.name);
    if (candidates.length > 0) {
    } else {
    }

    let bestCandidate = null;
    let bestScore = -1;

    for (const c of candidates) {
        if (
            !lot.nbt &&
            c.requiredNbt &&
            (c.requiredNbt.expLvl !== undefined || c.requiredNbt.loreContains)
        ) {
            continue;
        }

        if (checkNbtRequirements(lot.nbt, c.requiredNbt)) {
            let score = Object.keys(c.requiredNbt || {}).length;
            if (c.requiredNbt && c.requiredNbt.expLvl !== undefined) {
                score += 1;
            }
            if (score > bestScore) {
                bestScore = score;
                bestCandidate = c;
            }
        } else {
        }
    }

    if (!bestCandidate) {
    }
    return bestCandidate;
}


function getEnchantments(nbt) {
    if (!nbt || !nbt.value) return [];
    const raw = nbt.value.Enchantments
        || (nbt.value.display && nbt.value.display.Enchantments);
    return toList(raw).map(e => ({
        id: String(e.id && e.id.value || e.id),
        lvl: toNumber(e.lvl)
    }));
}


function getAttributeModifiers(nbt) {
    if (!nbt || !nbt.value) return [];
    const raw = nbt.value.AttributeModifiers
        || (nbt.value.display && nbt.value.display.AttributeModifiers);
    return toList(raw).map(a => ({
        AttributeName: String(a.AttributeName && a.AttributeName.value || a.AttributeName),
        Amount: toNumber(a.Amount),
        Slot: String(a.Slot && a.Slot.value || a.Slot)
    }));
}

function getPotionEffects(nbt) {
    if (!nbt || !nbt.value) return [];

    const tag = nbt.value.CustomPotionEffects;
    if (!tag) return [];

    let list;
    if (Array.isArray(tag)) {
        list = tag;
    } else if (Array.isArray(tag.value)) {
        list = tag.value;
    } else if (tag.value && Array.isArray(tag.value.value)) {
        list = tag.value.value;
    } else {
        return [];
    }

    return list.map(e => ({
        Id: typeof e.Id === 'object' ? +e.Id.value : +e.Id,
        Amplifier: typeof e.Amplifier === 'object' ? +e.Amplifier.value : +e.Amplifier,
        Duration: typeof e.Duration === 'object' ? +e.Duration.value : +e.Duration
    }));
}


function checkNbtRequirements(nbt, nbtReq) {
    if (!nbtReq) {
        return true;
    }

    if (nbtReq.expLvlMissing) {
        if (hasExpLvl(nbt)) {
            return false;
        }
    }

    if (nbtReq.loreContains) {
        const loreArray = getLoreFromNbt(nbt);
        const combinedLore = loreArray.map((line) => extractPlainText(line)).join(' ');
        if (!combinedLore.includes(nbtReq.loreContains)) {
            return false;
        }
    }

    if (nbtReq.expLvl !== undefined) {
        const loreArray = getLoreFromNbt(nbt);
        const combinedLore = loreArray.map((line) => extractPlainText(line)).join(' ');
        const expLvlRegex = /(?:Уровень:|Уровень:\s*)(\d+)/i;
        const match = combinedLore.match(expLvlRegex);
        if (!match) {
            return false;
        }
        const lvl = parseInt(match[1], 10);
        if (lvl !== nbtReq.expLvl) {
            return false;
        }
    }

    if (nbtReq.displayName) {
        let itemDisplayName = '';

        if (nbt.value.display && nbt.value.display.value.Name && nbt.value.display.value.Name.value) {
            let nameObj = nbt.value.display.value.Name.value;
            if (typeof nameObj === 'string') {
                try {
                    nameObj = JSON.parse(nameObj);
                } catch (e) {
                    console.error('?????? ??? ??????? JSON display.Name:', e);
                }
            }
            if (Array.isArray(nameObj.extra)) {
                itemDisplayName = nameObj.extra.map(part => part.text || '').join('');
            } else if (nameObj.text) {
                itemDisplayName = nameObj.text;
            }
        }

        if (!itemDisplayName && nbt.value.Name) {
            let nameObj = nbt.value.Name;
            if (typeof nameObj === 'string') {
                try {
                    nameObj = JSON.parse(nameObj);
                } catch (e) {
                    console.error('?????? ??? ??????? JSON Name:', e);
                }
            }
            if (Array.isArray(nameObj.extra)) {
                itemDisplayName = nameObj.extra.map(part => part.text || '').join('');
            } else if (nameObj.text) {
                itemDisplayName = nameObj.text;
            }
        }

        if (!itemDisplayName.includes(nbtReq.displayName)) {
            return false;
        }
    }

    if (nbtReq.Enchantments) {
        const itemEnchantments = getEnchantments(nbt)
            .map(e => ({ id: toId(e.id), lvl: +e.lvl }));
        const reqEnchantments = nbtReq.Enchantments
            .map(e => ({ id: toId(e.id), lvl: +e.lvl }));

        if (nbtReq.exactEnchantments) {
            if (itemEnchantments.length !== reqEnchantments.length) return false;

            const same = reqEnchantments.every(re =>
                itemEnchantments.some(ie => ie.id === re.id && ie.lvl === re.lvl)
            );
            if (!same) return false;
        } else {
            for (const re of reqEnchantments) {
                if (!itemEnchantments.some(ie => ie.id === re.id && ie.lvl === re.lvl))
                    return false;
            }
        }
    }

    if (nbtReq.customEnchantments) {
        const unbox = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v);
        const num = (v) => {
            const n = Number(unbox(v));
            return Number.isNaN(n) ? undefined : n;
        };
        const normId = (s) => String(s || '')
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/-1lvl$/, '')
            .replace(/-2lvl$/, '');

        const flatten = (obj) => {
            const out = {};
            if (!obj) return out;
            const v = obj.value ?? obj;
            for (const k of Object.keys(v)) out[k] = unbox(v[k]);
            return out;
        };

        const tag = nbt?.value || nbt;
        const pbv = tag?.PublicBukkitValues || tag?.publicBukkitValues;
        const flat = { ...flatten(tag), ...(pbv ? flatten(pbv) : {}) };

        const foundLevels = {};
        for (const [k, v] of Object.entries(flat)) {
            if (/-enchantment-1lvl$/i.test(k)) {
                foundLevels[normId(k)] = num(v);
            }
        }

        const reqList = Array.isArray(nbtReq.customEnchantments)
            ? nbtReq.customEnchantments.map(e => ({ id: e.id || e.name || e.key, level: e.level ?? e.lvl ?? e.value }))
            : Object.entries(nbtReq.customEnchantments).map(([id, level]) => ({ id, level }));

        const exactLevels = !!nbtReq.exactCustomEnchantmentsLevels;
        const exactSet = !!nbtReq.exactCustomEnchantments;

        for (const req of reqList) {
            const id = normId(req.id);
            const want = Number(req.level);
            const have = foundLevels[id];
            if (have == null) return false;
            if (exactLevels ? have !== want : have < want) return false;
        }

        if (exactSet) {
            const reqIds = new Set(reqList.map(r => normId(r.id)));
            const haveIds = new Set(Object.keys(foundLevels));
            if (reqIds.size !== haveIds.size) return false;
            for (const id of haveIds) if (!reqIds.has(id)) return false;
        }
    }


    function toId(str) {
        return String(str).replace(/^minecraft:/, '');
    }



    if (nbtReq.AttributeModifiers) {
        const itemAttrs = getAttributeModifiers(nbt);
        if (!Array.isArray(itemAttrs) || itemAttrs.length === 0) {
            return false;
        }
        for (const reqAttr of nbtReq.AttributeModifiers) {
            let requiredAttrName = reqAttr.AttributeName;
            if (!requiredAttrName.startsWith('minecraft:')) {
                requiredAttrName = 'minecraft:' + requiredAttrName;
            }
            const foundAttr = itemAttrs.find((attr) => {
                let attrName =
                    (typeof attr.AttributeName === 'object' && attr.AttributeName.value)
                        ? attr.AttributeName.value
                        : attr.AttributeName;
                let attrAmount =
                    (typeof attr.Amount === 'object' && attr.Amount.value)
                        ? attr.Amount.value
                        : attr.Amount;
                let attrSlot =
                    (typeof attr.Slot === 'object' && attr.Slot.value)
                        ? attr.Slot.value
                        : attr.Slot;
                if (reqAttr.Slot && attrSlot !== reqAttr.Slot) return false;
                return attrName === requiredAttrName && parseFloat(attrAmount) === reqAttr.Amount;
            });
            if (!foundAttr) {
                return false;
            }
        }
    }
    if (nbtReq.potionEffects) {
        const rawEff = getPotionEffects(nbt) || [];

        const num = (v) => {
            if (v == null) return v;
            if (typeof v === 'object' && 'value' in v) return num(v.value);
            const n = Number(v);
            return Number.isNaN(n) ? v : n;
        };

        const norm = (e) => ({
            Id: num(e?.Id),
            Amplifier: num(e?.Amplifier),
            Duration: e?.Duration == null ? undefined : num(e?.Duration),
        });

        const itemEff = rawEff.map(norm);
        const reqEff = nbtReq.potionEffects.map(norm);

        if (nbtReq.exactPotionEffects && itemEff.length !== reqEff.length) {
            return false;
        }

        const durEq = (a, b) =>
            a === b ||
            (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1);

        for (const req of reqEff) {
            const match = itemEff.find((e) =>
                e.Id === req.Id &&
                e.Amplifier === req.Amplifier &&
                (req.Duration === undefined || durEq(e.Duration, req.Duration))
            );
            if (!match) return false;
        }
    }


    return true;
}


function hasExpLvl(nbt) {
    if (!nbt || !nbt.value) return false;
    return Object.prototype.hasOwnProperty.call(nbt.value, 'exp-lvl');
}


function areItemsEqual(oldItems, newItems) {
    if (oldItems.length !== newItems.length) return false;
    const sortFn = (a, b) =>
        (a.name + a.price + a.count).localeCompare(b.name + b.price + b.count);
    const sortedOld = [...oldItems].sort(sortFn);
    const sortedNew = [...newItems].sort(sortFn);
    for (let i = 0; i < sortedOld.length; i++) {
        const o = sortedOld[i];
        const n = sortedNew[i];
        if (o.name !== n.name || o.price !== n.price || o.count !== n.count) {
            return false;
        }
    }
    return true;
}

module.exports = {
    parseAndBuyFromAh,
    startBalanceUpdater,
    getMatchedTarget,
    hasExpLvl,
    checkWithHelper,
    checkNbtRequirements,
    autoSell,
    initializeStatisticsIntegration
};



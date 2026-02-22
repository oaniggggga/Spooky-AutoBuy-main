/**
 * Purchase Statistics Module
 * Система статистики автобая для отслеживания эффективности покупок предметов
 * 
 * @author Bot System
 * @version 1.0.0
 */

const { logInfo, logWarn, logError } = require('./logging');
const { profitCalculator } = require('./profitCalculator');
const path = require('path');
const fs = require('fs');

/**
 * Statistics Collector - собирает события покупок, продаж и неудач
 */
class StatisticsCollector {
    constructor() {
        this.eventListeners = new Map();
        this.initialized = false;
        
        logInfo('StatisticsCollector initialized', 'statistics');
    }

    /**
     * Регистрирует покупку предмета
     * @param {string} itemId - ID предмета
     * @param {number} price - цена покупки
     * @param {Date|string} timestamp - время покупки
     * @param {Object} details - дополнительные детали предмета
     */
    recordPurchase(itemId, price, timestamp, details = {}) {
        try {
            // Валидация входных данных
            if (!itemId || typeof itemId !== 'string') {
                throw new Error('Invalid itemId: must be a non-empty string');
            }
            if (!price || typeof price !== 'number' || price <= 0) {
                throw new Error('Invalid price: must be a positive number');
            }
            if (!timestamp) {
                timestamp = new Date();
            }
            if (typeof timestamp === 'string') {
                timestamp = new Date(timestamp);
            }

            const purchaseRecord = {
                id: this._generateId('purchase'),
                itemId,
                itemName: details.itemName || itemId,
                itemDetails: {
                    enchantments: details.enchantments || [],
                    attributes: details.attributes || {},
                    rarity: details.rarity || 'common'
                },
                purchasePrice: price,
                timestamp: timestamp.toISOString(),
                source: details.source || 'auction_house'
            };

            logInfo(`Purchase recorded: ${itemId} for ${price}`, 'statistics');
            
            // Эмитируем событие для других компонентов
            this._emitEvent('purchase', purchaseRecord);
            
            return purchaseRecord;
        } catch (error) {
            logError(`Failed to record purchase: ${error.message}`, 'statistics');
            throw error;
        }
    }

    /**
     * Регистрирует продажу предмета
     * @param {string} itemId - ID предмета
     * @param {number} salePrice - цена продажи
     * @param {number} purchasePrice - цена покупки
     * @param {Date|string} timestamp - время продажи
     */
    recordSale(itemId, salePrice, purchasePrice, timestamp) {
        try {
            // Валидация входных данных
            if (!itemId || typeof itemId !== 'string') {
                throw new Error('Invalid itemId: must be a non-empty string');
            }
            if (!salePrice || typeof salePrice !== 'number' || salePrice <= 0) {
                throw new Error('Invalid salePrice: must be a positive number');
            }
            if (!purchasePrice || typeof purchasePrice !== 'number' || purchasePrice <= 0) {
                throw new Error('Invalid purchasePrice: must be a positive number');
            }
            if (!timestamp) {
                timestamp = new Date();
            }
            if (typeof timestamp === 'string') {
                timestamp = new Date(timestamp);
            }

            // Используем ProfitCalculator для расчетов
            const profit = profitCalculator.calculateProfit(salePrice, purchasePrice);
            const profitMargin = profitCalculator.calculateProfitMargin(profit, purchasePrice);

            const saleRecord = {
                id: this._generateId('sale'),
                purchaseId: null, // Будет связано позже
                itemId,
                salePrice,
                profit,
                profitMargin: profitMargin / 100, // Конвертируем из процентов в десятичную дробь
                timestamp: timestamp.toISOString(),
                holdingTime: null // Будет рассчитано позже
            };

            logInfo(`Sale recorded: ${itemId} for ${salePrice} (profit: ${profit})`, 'statistics');
            
            // Эмитируем событие для других компонентов
            this._emitEvent('sale', saleRecord);
            
            return saleRecord;
        } catch (error) {
            logError(`Failed to record sale: ${error.message}`, 'statistics');
            throw error;
        }
    }

    /**
     * Регистрирует неудачную попытку покупки
     * @param {string} itemId - ID предмета
     * @param {string} reason - причина неудачи
     * @param {Date|string} timestamp - время попытки
     * @param {number} attemptedPrice - цена которую пытались заплатить
     */
    recordMissedPurchase(itemId, reason, timestamp, attemptedPrice) {
        try {
            // Валидация входных данных
            if (!itemId || typeof itemId !== 'string') {
                throw new Error('Invalid itemId: must be a non-empty string');
            }
            if (!reason || typeof reason !== 'string') {
                throw new Error('Invalid reason: must be a non-empty string');
            }
            if (!timestamp) {
                timestamp = new Date();
            }
            if (typeof timestamp === 'string') {
                timestamp = new Date(timestamp);
            }

            const missedRecord = {
                id: this._generateId('missed'),
                itemId,
                attemptedPrice: attemptedPrice || 0,
                reason,
                timestamp: timestamp.toISOString(),
                details: ''
            };

            logInfo(`Missed purchase recorded: ${itemId} - ${reason}`, 'statistics');
            
            // Эмитируем событие для других компонентов
            this._emitEvent('missed_purchase', missedRecord);
            
            return missedRecord;
        } catch (error) {
            logError(`Failed to record missed purchase: ${error.message}`, 'statistics');
            throw error;
        }
    }

    /**
     * Инициализирует слушатели событий
     */
    initializeEventListeners() {
        if (this.initialized) {
            logWarn('Event listeners already initialized', 'statistics');
            return;
        }

        // Здесь будут добавлены слушатели событий от других модулей
        // Пока что просто отмечаем как инициализированные
        this.initialized = true;
        logInfo('Event listeners initialized', 'statistics');
    }

    /**
     * Генерирует уникальный ID для записи
     * @param {string} type - тип записи (purchase, sale, missed)
     * @returns {string} уникальный ID
     */
    _generateId(type) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${type}_${timestamp}_${random}`;
    }

    /**
     * Эмитирует событие для других компонентов
     * @param {string} eventType - тип события
     * @param {Object} data - данные события
     */
    _emitEvent(eventType, data) {
        const listeners = this.eventListeners.get(eventType) || [];
        listeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                logError(`Error in event listener for ${eventType}: ${error.message}`, 'statistics');
            }
        });
    }

    /**
     * Добавляет слушатель события
     * @param {string} eventType - тип события
     * @param {Function} listener - функция-слушатель
     */
    addEventListener(eventType, listener) {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, []);
        }
        this.eventListeners.get(eventType).push(listener);
    }
}

/**
 * Statistics Engine - основной движок для обработки и агрегации данных
 */
class StatisticsEngine {
    constructor(dataStore = null) {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 минут
        this.dataStore = dataStore;
        this.data = null;
        
        logInfo('StatisticsEngine initialized', 'statistics');
    }

    /**
     * Инициализирует движок с хранилищем данных
     * @param {StatisticsDataStore} dataStore - хранилище данных
     */
    initialize(dataStore) {
        this.dataStore = dataStore;
        this._loadData();
    }

    /**
     * Загружает данные из хранилища
     */
    _loadData() {
        if (!this.dataStore) {
            logWarn('No data store configured, using empty data', 'statistics');
            this.data = this._getEmptyData();
            return;
        }

        try {
            this.data = this.dataStore.loadStatistics();
            logInfo('Data loaded successfully', 'statistics');
        } catch (error) {
            logError(`Failed to load data: ${error.message}`, 'statistics');
            this.data = this._getEmptyData();
        }
    }

    /**
     * Получает статистику по предмету
     * @param {string} itemId - ID предмета
     * @returns {Object} статистика предмета
     */
    getItemStatistics(itemId) {
        if (!itemId || typeof itemId !== 'string') {
            throw new Error('Invalid itemId: must be a non-empty string');
        }

        const cacheKey = `item_${itemId}`;
        
        // Проверяем кэш
        if (this._isCacheValid(cacheKey)) {
            logInfo(`Returning cached statistics for item: ${itemId}`, 'statistics');
            return this.cache.get(cacheKey).data;
        }

        logInfo(`Calculating statistics for item: ${itemId}`, 'statistics');

        if (!this.data) {
            this._loadData();
        }

        const purchases = this.data.purchases.filter(p => p.itemId === itemId);
        const sales = this.data.sales.filter(s => s.itemId === itemId);
        const missedPurchases = this.data.missedPurchases.filter(m => m.itemId === itemId);

        // Агрегируем данные
        const totalPurchases = purchases.length;
        const totalSales = sales.length;
        const totalProfit = sales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
        const totalInvestment = purchases.reduce((sum, purchase) => sum + purchase.purchasePrice, 0);
        const averageProfit = totalSales > 0 ? totalProfit / totalSales : 0;
        const profitMargin = totalInvestment > 0 ? totalProfit / totalInvestment : 0;
        
        // Рассчитываем успешность
        const totalAttempts = totalPurchases + missedPurchases.length;
        const successRate = totalAttempts > 0 ? totalPurchases / totalAttempts : 0;

        // Группируем причины пропущенных покупок
        const missedReasons = {};
        missedPurchases.forEach(missed => {
            const reason = missed.reason || 'unknown';
            missedReasons[reason] = (missedReasons[reason] || 0) + 1;
        });

        // Находим последнюю активность
        const allEvents = [...purchases, ...sales, ...missedPurchases];
        const lastActivity = allEvents.length > 0 
            ? allEvents.reduce((latest, event) => {
                const eventTime = new Date(event.timestamp);
                return eventTime > new Date(latest) ? event.timestamp : latest;
            }, allEvents[0].timestamp)
            : null;

        const itemStats = {
            itemId,
            itemName: purchases.length > 0 ? purchases[0].itemName : itemId,
            totalPurchases,
            totalSales,
            totalProfit,
            averageProfit,
            profitMargin,
            successRate,
            rating: 0, // Будет рассчитан ниже
            missedPurchases: {
                total: missedPurchases.length,
                reasons: missedReasons
            },
            lastActivity
        };

        // Рассчитываем рейтинг с помощью RatingCalculator
        if (typeof ratingCalculator !== 'undefined' && ratingCalculator.calculateItemRating) {
            itemStats.rating = ratingCalculator.calculateItemRating(itemStats);
        }

        // Кэшируем результат
        this._setCacheValue(cacheKey, itemStats);
        
        return itemStats;
    }

    /**
     * Получает общую статистику
     * @returns {Object} общая статистика
     */
    getOverallStatistics() {
        const cacheKey = 'overall_stats';
        
        // Проверяем кэш
        if (this._isCacheValid(cacheKey)) {
            logInfo('Returning cached overall statistics', 'statistics');
            return this.cache.get(cacheKey).data;
        }

        logInfo('Calculating overall statistics', 'statistics');

        if (!this.data) {
            this._loadData();
        }

        const uniqueItems = new Set([
            ...this.data.purchases.map(p => p.itemId),
            ...this.data.sales.map(s => s.itemId),
            ...this.data.missedPurchases.map(m => m.itemId)
        ]);

        const totalItems = uniqueItems.size;
        const totalPurchases = this.data.purchases.length;
        const totalSales = this.data.sales.length;
        const totalProfit = this.data.sales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
        const totalMissed = this.data.missedPurchases.length;
        const totalAttempts = totalPurchases + totalMissed;
        const averageSuccessRate = totalAttempts > 0 ? totalPurchases / totalAttempts : 0;

        const overallStats = {
            totalItems,
            totalPurchases,
            totalSales,
            totalProfit,
            averageSuccessRate,
            topItems: [] // Будет заполнено getTopItems
        };

        // Кэшируем результат
        this._setCacheValue(cacheKey, overallStats);
        
        return overallStats;
    }

    /**
     * Получает топ предметов по критерию
     * @param {string} criteria - критерий сортировки (rating, profit, purchases, successRate)
     * @param {number} limit - количество предметов
     * @returns {Array} массив топ предметов
     */
    getTopItems(criteria = 'rating', limit = 10) {
        if (typeof limit !== 'number' || limit <= 0) {
            throw new Error('Invalid limit: must be a positive number');
        }

        const cacheKey = `top_items_${criteria}_${limit}`;
        
        // Проверяем кэш
        if (this._isCacheValid(cacheKey)) {
            logInfo(`Returning cached top ${limit} items by ${criteria}`, 'statistics');
            return this.cache.get(cacheKey).data;
        }

        logInfo(`Calculating top ${limit} items by ${criteria}`, 'statistics');

        if (!this.data) {
            this._loadData();
        }

        // Получаем уникальные предметы
        const uniqueItems = new Set([
            ...this.data.purchases.map(p => p.itemId),
            ...this.data.sales.map(s => s.itemId),
            ...this.data.missedPurchases.map(m => m.itemId)
        ]);

        // Получаем статистику для каждого предмета
        const itemsWithStats = Array.from(uniqueItems).map(itemId => {
            return this.getItemStatistics(itemId);
        });

        // Используем RatingCalculator для сортировки если доступен
        let sortedItems;
        if (typeof ratingCalculator !== 'undefined' && ratingCalculator.sortItemsByCriteria) {
            sortedItems = ratingCalculator.sortItemsByCriteria(itemsWithStats, criteria, 'desc');
        } else {
            // Fallback сортировка если RatingCalculator недоступен
            switch (criteria) {
                case 'profit':
                    sortedItems = itemsWithStats.sort((a, b) => b.totalProfit - a.totalProfit);
                    break;
                case 'purchases':
                    sortedItems = itemsWithStats.sort((a, b) => b.totalPurchases - a.totalPurchases);
                    break;
                case 'successRate':
                    sortedItems = itemsWithStats.sort((a, b) => b.successRate - a.successRate);
                    break;
                case 'profitMargin':
                    sortedItems = itemsWithStats.sort((a, b) => b.profitMargin - a.profitMargin);
                    break;
                case 'rating':
                default:
                    sortedItems = itemsWithStats.sort((a, b) => b.rating - a.rating);
                    break;
            }
        }

        const topItems = sortedItems.slice(0, limit);

        // Кэшируем результат
        this._setCacheValue(cacheKey, topItems);
        
        return topItems;
    }

    /**
     * Обновляет статистику при новом событии
     * @param {Object} event - событие
     */
    updateStatistics(event) {
        if (!event || typeof event !== 'object') {
            logWarn('Invalid event provided to updateStatistics', 'statistics');
            return;
        }

        logInfo(`Updating statistics with event: ${event.type || 'unknown'}`, 'statistics');
        
        if (!this.data) {
            this._loadData();
        }

        // Добавляем событие в соответствующий массив
        switch (event.type) {
            case 'purchase':
                this.data.purchases.push(event);
                break;
            case 'sale':
                this.data.sales.push(event);
                break;
            case 'missed_purchase':
                this.data.missedPurchases.push(event);
                break;
            default:
                logWarn(`Unknown event type: ${event.type}`, 'statistics');
                return;
        }

        // Очищаем кэш при обновлении
        this.cache.clear();
        
        // Сохраняем данные
        if (this.dataStore) {
            try {
                this.dataStore.saveStatistics(this.data);
            } catch (error) {
                logError(`Failed to save statistics after update: ${error.message}`, 'statistics');
            }
        }
    }

    /**
     * Получает статистику за период
     * @param {Date} startDate - начальная дата
     * @param {Date} endDate - конечная дата
     * @returns {Object} статистика за период
     */
    getStatisticsForPeriod(startDate, endDate) {
        if (!startDate || !endDate) {
            throw new Error('Start date and end date are required');
        }

        if (!(startDate instanceof Date)) {
            startDate = new Date(startDate);
        }
        if (!(endDate instanceof Date)) {
            endDate = new Date(endDate);
        }

        if (startDate >= endDate) {
            throw new Error('Start date must be before end date');
        }

        const cacheKey = `period_${startDate.getTime()}_${endDate.getTime()}`;
        
        // Проверяем кэш
        if (this._isCacheValid(cacheKey)) {
            logInfo(`Returning cached statistics for period: ${startDate.toISOString()} - ${endDate.toISOString()}`, 'statistics');
            return this.cache.get(cacheKey).data;
        }

        logInfo(`Calculating statistics for period: ${startDate.toISOString()} - ${endDate.toISOString()}`, 'statistics');

        if (!this.data) {
            this._loadData();
        }

        // Оптимизированная фильтрация по времени с предварительной сортировкой
        const startTime = startDate.getTime();
        const endTime = endDate.getTime();

        // Фильтруем события по периоду с оптимизацией
        const purchasesInPeriod = this._filterEventsByTimeRange(this.data.purchases, startTime, endTime);
        const salesInPeriod = this._filterEventsByTimeRange(this.data.sales, startTime, endTime);
        const missedInPeriod = this._filterEventsByTimeRange(this.data.missedPurchases, startTime, endTime);

        // Агрегируем данные за период
        const totalPurchases = purchasesInPeriod.length;
        const totalSales = salesInPeriod.length;
        const totalProfit = salesInPeriod.reduce((sum, sale) => sum + (sale.profit || 0), 0);

        // Получаем уникальные предметы за период с оптимизацией
        const uniqueItemsMap = new Map();
        
        // Собираем все предметы в одном проходе
        [...purchasesInPeriod, ...salesInPeriod, ...missedInPeriod].forEach(event => {
            if (!uniqueItemsMap.has(event.itemId)) {
                uniqueItemsMap.set(event.itemId, {
                    itemId: event.itemId,
                    itemName: event.itemName || event.itemId,
                    purchases: [],
                    sales: [],
                    missed: []
                });
            }
        });

        // Группируем события по предметам
        purchasesInPeriod.forEach(purchase => {
            uniqueItemsMap.get(purchase.itemId).purchases.push(purchase);
        });
        salesInPeriod.forEach(sale => {
            uniqueItemsMap.get(sale.itemId).sales.push(sale);
        });
        missedInPeriod.forEach(missed => {
            uniqueItemsMap.get(missed.itemId).missed.push(missed);
        });

        // Создаем статистику по предметам за период
        const itemsStats = Array.from(uniqueItemsMap.values()).map(item => {
            const itemProfit = item.sales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
            const itemAttempts = item.purchases.length + item.missed.length;
            const itemSuccessRate = itemAttempts > 0 ? item.purchases.length / itemAttempts : 0;
            const totalInvestment = item.purchases.reduce((sum, purchase) => sum + purchase.purchasePrice, 0);
            const profitMargin = totalInvestment > 0 ? itemProfit / totalInvestment : 0;

            return {
                itemId: item.itemId,
                itemName: item.itemName,
                purchases: item.purchases.length,
                sales: item.sales.length,
                profit: itemProfit,
                profitMargin,
                successRate: itemSuccessRate,
                missed: item.missed.length,
                totalInvestment
            };
        });

        const periodStats = {
            period: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                durationDays: Math.ceil((endTime - startTime) / (24 * 60 * 60 * 1000))
            },
            totalPurchases,
            totalSales,
            totalProfit,
            totalMissed: missedInPeriod.length,
            uniqueItems: uniqueItemsMap.size,
            averageSuccessRate: (totalPurchases + missedInPeriod.length) > 0 
                ? totalPurchases / (totalPurchases + missedInPeriod.length) 
                : 0,
            items: itemsStats.sort((a, b) => b.profit - a.profit)
        };

        // Кэшируем результат
        this._setCacheValue(cacheKey, periodStats);
        
        return periodStats;
    }

    /**
     * Оптимизированная фильтрация событий по временному диапазону
     * @param {Array} events - массив событий
     * @param {number} startTime - начальное время (timestamp)
     * @param {number} endTime - конечное время (timestamp)
     * @returns {Array} отфильтрованные события
     */
    _filterEventsByTimeRange(events, startTime, endTime) {
        // Для больших массивов используем бинарный поиск если данные отсортированы
        if (events.length > 1000) {
            // Проверяем, отсортированы ли данные по времени
            const isSorted = this._isArraySortedByTimestamp(events);
            
            if (isSorted) {
                return this._binarySearchTimeRange(events, startTime, endTime);
            }
        }
        
        // Для небольших массивов или неотсортированных данных используем обычную фильтрацию
        return events.filter(event => {
            const eventTime = new Date(event.timestamp).getTime();
            return eventTime >= startTime && eventTime <= endTime;
        });
    }

    /**
     * Проверяет, отсортирован ли массив по timestamp
     * @param {Array} events - массив событий
     * @returns {boolean} отсортирован ли массив
     */
    _isArraySortedByTimestamp(events) {
        if (events.length <= 1) return true;
        
        for (let i = 1; i < events.length; i++) {
            const prevTime = new Date(events[i - 1].timestamp).getTime();
            const currTime = new Date(events[i].timestamp).getTime();
            if (prevTime > currTime) {
                return false;
            }
        }
        return true;
    }

    /**
     * Бинарный поиск для оптимизированной фильтрации по времени
     * @param {Array} events - отсортированный массив событий
     * @param {number} startTime - начальное время
     * @param {number} endTime - конечное время
     * @returns {Array} отфильтрованные события
     */
    _binarySearchTimeRange(events, startTime, endTime) {
        // Находим начальный индекс
        let startIndex = this._binarySearchStart(events, startTime);
        if (startIndex === -1) return [];
        
        // Находим конечный индекс
        let endIndex = this._binarySearchEnd(events, endTime, startIndex);
        if (endIndex === -1) return [];
        
        return events.slice(startIndex, endIndex + 1);
    }

    /**
     * Бинарный поиск начального индекса
     * @param {Array} events - массив событий
     * @param {number} targetTime - целевое время
     * @returns {number} индекс или -1
     */
    _binarySearchStart(events, targetTime) {
        let left = 0;
        let right = events.length - 1;
        let result = -1;
        
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const midTime = new Date(events[mid].timestamp).getTime();
            
            if (midTime >= targetTime) {
                result = mid;
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }
        
        return result;
    }

    /**
     * Бинарный поиск конечного индекса
     * @param {Array} events - массив событий
     * @param {number} targetTime - целевое время
     * @param {number} startFrom - начальный индекс поиска
     * @returns {number} индекс или -1
     */
    _binarySearchEnd(events, targetTime, startFrom = 0) {
        let left = startFrom;
        let right = events.length - 1;
        let result = -1;
        
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const midTime = new Date(events[mid].timestamp).getTime();
            
            if (midTime <= targetTime) {
                result = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        
        return result;
    }

    /**
     * Проверяет валидность кэша
     * @param {string} key - ключ кэша
     * @returns {boolean} валиден ли кэш
     */
    _isCacheValid(key) {
        if (!this.cache.has(key)) {
            return false;
        }
        
        const cached = this.cache.get(key);
        const now = Date.now();
        return (now - cached.timestamp) < this.cacheTimeout;
    }

    /**
     * Устанавливает значение в кэш
     * @param {string} key - ключ
     * @param {*} data - данные
     */
    _setCacheValue(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Получает детальную статистику прибыли для предмета
     * @param {string} itemId - ID предмета
     * @param {number} currentMarketPrice - текущая рыночная цена (опционально)
     * @returns {Object} детальная статистика прибыли
     */
    getItemProfitStatistics(itemId, currentMarketPrice = null) {
        if (!itemId || typeof itemId !== 'string') {
            throw new Error('Invalid itemId: must be a non-empty string');
        }

        if (!this.data) {
            this._loadData();
        }

        const purchases = this.data.purchases.filter(p => p.itemId === itemId);
        const sales = this.data.sales.filter(s => s.itemId === itemId);

        return profitCalculator.calculateItemProfitStatistics(purchases, sales, currentMarketPrice);
    }

    /**
     * Рассчитывает потенциальную прибыль для непроданных предметов
     * @param {Object} currentMarketPrices - текущие рыночные цены по itemId
     * @returns {Object} информация о потенциальной прибыли
     */
    calculatePotentialProfit(currentMarketPrices = {}) {
        if (!this.data) {
            this._loadData();
        }

        // Находим непроданные предметы
        const soldItemIds = new Set(this.data.sales.map(s => s.itemId));
        const unsoldItems = this.data.purchases.filter(p => !soldItemIds.has(p.itemId));

        return profitCalculator.calculatePotentialProfit(unsoldItems, currentMarketPrices);
    }

    /**
     * Получает тренды прибыльности по периодам
     * @param {string} period - период группировки ('day', 'week', 'month')
     * @returns {Array} тренды прибыльности по периодам
     */
    getProfitTrends(period = 'day') {
        if (!this.data) {
            this._loadData();
        }

        return profitCalculator.calculateProfitTrends(this.data.sales, period);
    }

    /**
     * Сравнивает прибыльность между двумя периодами
     * @param {Date} currentStart - начало текущего периода
     * @param {Date} currentEnd - конец текущего периода
     * @param {Date} previousStart - начало предыдущего периода
     * @param {Date} previousEnd - конец предыдущего периода
     * @returns {Object} сравнение прибыльности
     */
    compareProfitabilityBetweenPeriods(currentStart, currentEnd, previousStart, previousEnd) {
        if (!this.data) {
            this._loadData();
        }

        const currentSales = this._filterEventsByTimeRange(
            this.data.sales, 
            currentStart.getTime(), 
            currentEnd.getTime()
        );
        
        const previousSales = this._filterEventsByTimeRange(
            this.data.sales, 
            previousStart.getTime(), 
            previousEnd.getTime()
        );

        return profitCalculator.compareProfitability(currentSales, previousSales);
    }

    /**
     * Очищает кэш
     */
    clearCache() {
        this.cache.clear();
        logInfo('Cache cleared', 'statistics');
    }

    /**
     * Возвращает пустую структуру данных
     * @returns {Object} пустые данные
     */
    _getEmptyData() {
        return {
            version: '1.0.0',
            created: new Date().toISOString(),
            purchases: [],
            sales: [],
            missedPurchases: [],
            itemStatistics: {},
            overallStatistics: {
                totalItems: 0,
                totalPurchases: 0,
                totalSales: 0,
                totalProfit: 0,
                averageSuccessRate: 0
            }
        };
    }
}

/**
 * Rating Calculator - рассчитывает рейтинги предметов
 */
class RatingCalculator {
    constructor() {
        logInfo('RatingCalculator initialized', 'statistics');
    }

    /**
     * Рассчитывает общий рейтинг предмета (1-5 звезд)
     * @param {Object} itemStats - статистика предмета
     * @returns {number} рейтинг от 1 до 5
     */
    calculateItemRating(itemStats) {
        try {
            if (!itemStats || typeof itemStats !== 'object') {
                logWarn('Invalid itemStats provided to calculateItemRating', 'statistics');
                return 1;
            }

            // Базовый рейтинг
            let rating = 1;
            
            // Компонент прибыльности (0-2 балла)
            const profitabilityRatio = this.calculateProfitabilityRatio(itemStats.totalProfit || 0, itemStats.totalPurchases * (itemStats.averageProfit || 0) - (itemStats.totalProfit || 0));
            if (profitabilityRatio > 0.2) rating += 0.5; // 20% прибыль
            if (profitabilityRatio > 0.5) rating += 0.5; // 50% прибыль
            if (profitabilityRatio > 1.0) rating += 0.5; // 100% прибыль
            if (profitabilityRatio > 2.0) rating += 0.5; // 200% прибыль

            // Компонент успешности покупок (0-1.5 балла)
            const successRate = itemStats.successRate || 0;
            if (successRate > 0.5) rating += 0.5; // 50% успешность
            if (successRate > 0.7) rating += 0.5; // 70% успешность
            if (successRate > 0.9) rating += 0.5; // 90% успешность

            // Компонент частоты покупок (0-1.5 балла)
            const totalPurchases = itemStats.totalPurchases || 0;
            if (totalPurchases >= 5) rating += 0.5;   // Минимум 5 покупок
            if (totalPurchases >= 15) rating += 0.5;  // 15+ покупок
            if (totalPurchases >= 50) rating += 0.5;  // 50+ покупок

            // Ограничиваем рейтинг от 1 до 5 и округляем до 1 знака
            rating = Math.max(1, Math.min(5, Math.round(rating * 10) / 10));
            
            logInfo(`Calculated rating for ${itemStats.itemId}: ${rating} (profit ratio: ${profitabilityRatio.toFixed(2)}, success rate: ${successRate.toFixed(2)}, purchases: ${totalPurchases})`, 'statistics');
            return rating;
        } catch (error) {
            logError(`Failed to calculate rating: ${error.message}`, 'statistics');
            return 1;
        }
    }

    /**
     * Рассчитывает коэффициент прибыльности
     * @param {number} totalProfit - общая прибыль
     * @param {number} totalInvestment - общие инвестиции
     * @returns {number} коэффициент прибыльности
     */
    calculateProfitabilityRatio(totalProfit, totalInvestment) {
        return profitCalculator.calculateProfitabilityRatio(totalProfit, totalInvestment);
    }

    /**
     * Рассчитывает показатель частоты покупок
     * @param {number} purchaseCount - количество покупок
     * @param {number} timeSpan - временной промежуток в миллисекундах
     * @returns {number} показатель частоты
     */
    calculateFrequencyScore(purchaseCount, timeSpan) {
        if (!timeSpan || timeSpan <= 0) {
            return 0;
        }
        // Покупок в день
        const daysSpan = timeSpan / (24 * 60 * 60 * 1000);
        return purchaseCount / daysSpan;
    }

    /**
     * Рассчитывает показатель успешности
     * @param {number} successfulPurchases - успешные покупки
     * @param {number} totalAttempts - общее количество попыток
     * @returns {number} показатель успешности (0-1)
     */
    calculateSuccessScore(successfulPurchases, totalAttempts) {
        if (!totalAttempts || totalAttempts <= 0) {
            return 0;
        }
        return successfulPurchases / totalAttempts;
    }

    /**
     * Сортирует предметы по рейтингу в порядке убывания
     * @param {Array} items - массив предметов со статистикой
     * @returns {Array} отсортированный массив предметов
     */
    sortItemsByRating(items) {
        if (!Array.isArray(items)) {
            logWarn('Invalid items array provided to sortItemsByRating', 'statistics');
            return [];
        }

        try {
            // Рассчитываем рейтинг для каждого предмета и сортируем
            const itemsWithRating = items.map(item => {
                const rating = this.calculateItemRating(item);
                return {
                    ...item,
                    rating
                };
            });

            // Сортируем по рейтингу в порядке убывания
            const sortedItems = itemsWithRating.sort((a, b) => {
                // Сначала по рейтингу
                if (b.rating !== a.rating) {
                    return b.rating - a.rating;
                }
                // При равном рейтинге - по общей прибыли
                if (b.totalProfit !== a.totalProfit) {
                    return (b.totalProfit || 0) - (a.totalProfit || 0);
                }
                // При равной прибыли - по количеству покупок
                return (b.totalPurchases || 0) - (a.totalPurchases || 0);
            });

            logInfo(`Sorted ${sortedItems.length} items by rating`, 'statistics');
            return sortedItems;
        } catch (error) {
            logError(`Failed to sort items by rating: ${error.message}`, 'statistics');
            return items; // Возвращаем исходный массив в случае ошибки
        }
    }

    /**
     * Получает топ-N предметов по рейтингу
     * @param {Array} items - массив предметов со статистикой
     * @param {number} limit - количество предметов для возврата
     * @returns {Array} топ-N предметов
     */
    getTopRatedItems(items, limit = 10) {
        if (!Array.isArray(items)) {
            logWarn('Invalid items array provided to getTopRatedItems', 'statistics');
            return [];
        }

        if (typeof limit !== 'number' || limit <= 0) {
            logWarn('Invalid limit provided to getTopRatedItems, using default 10', 'statistics');
            limit = 10;
        }

        try {
            const sortedItems = this.sortItemsByRating(items);
            const topItems = sortedItems.slice(0, limit);
            
            logInfo(`Retrieved top ${topItems.length} rated items (requested: ${limit})`, 'statistics');
            return topItems;
        } catch (error) {
            logError(`Failed to get top rated items: ${error.message}`, 'statistics');
            return [];
        }
    }

    /**
     * Сортирует предметы по указанному критерию
     * @param {Array} items - массив предметов со статистикой
     * @param {string} criteria - критерий сортировки (rating, profit, purchases, successRate, profitMargin)
     * @param {string} order - порядок сортировки ('desc' или 'asc')
     * @returns {Array} отсортированный массив предметов
     */
    sortItemsByCriteria(items, criteria = 'rating', order = 'desc') {
        if (!Array.isArray(items)) {
            logWarn('Invalid items array provided to sortItemsByCriteria', 'statistics');
            return [];
        }

        const validCriteria = ['rating', 'profit', 'purchases', 'successRate', 'profitMargin'];
        if (!validCriteria.includes(criteria)) {
            logWarn(`Invalid criteria '${criteria}', using 'rating'`, 'statistics');
            criteria = 'rating';
        }

        if (order !== 'asc' && order !== 'desc') {
            logWarn(`Invalid order '${order}', using 'desc'`, 'statistics');
            order = 'desc';
        }

        try {
            // Добавляем рейтинг к предметам если его нет
            const itemsWithRating = items.map(item => {
                if (typeof item.rating === 'undefined') {
                    return {
                        ...item,
                        rating: this.calculateItemRating(item)
                    };
                }
                return item;
            });

            // Сортируем по указанному критерию
            const sortedItems = itemsWithRating.sort((a, b) => {
                let valueA, valueB;

                switch (criteria) {
                    case 'profit':
                        valueA = a.totalProfit || 0;
                        valueB = b.totalProfit || 0;
                        break;
                    case 'purchases':
                        valueA = a.totalPurchases || 0;
                        valueB = b.totalPurchases || 0;
                        break;
                    case 'successRate':
                        valueA = a.successRate || 0;
                        valueB = b.successRate || 0;
                        break;
                    case 'profitMargin':
                        valueA = a.profitMargin || 0;
                        valueB = b.profitMargin || 0;
                        break;
                    case 'rating':
                    default:
                        valueA = a.rating || 0;
                        valueB = b.rating || 0;
                        break;
                }

                // Применяем порядок сортировки
                if (order === 'asc') {
                    return valueA - valueB;
                } else {
                    return valueB - valueA;
                }
            });

            logInfo(`Sorted ${sortedItems.length} items by ${criteria} (${order})`, 'statistics');
            return sortedItems;
        } catch (error) {
            logError(`Failed to sort items by criteria: ${error.message}`, 'statistics');
            return items; // Возвращаем исходный массив в случае ошибки
        }
    }
}

/**
 * Data Store - управляет сохранением и загрузкой данных
 */
class StatisticsDataStore {
    constructor(dataPath = null) {
        this.dataPath = dataPath || path.join(__dirname, '..', 'purchaseStatistics.json');
        this.backupPath = this.dataPath + '.backup';
        this.backupDir = path.join(path.dirname(this.dataPath), 'backups');
        this.maxBackups = 10; // Максимальное количество резервных копий
        this.autoBackupInterval = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
        this.lastBackupTime = 0;
        
        // Создаем директорию для резервных копий если её нет
        this._ensureBackupDirectory();
        
        logInfo(`StatisticsDataStore initialized with path: ${this.dataPath}`, 'statistics');
    }

    /**
     * Сохраняет данные статистики
     * @param {Object} statistics - данные статистики
     */
    saveStatistics(statistics) {
        try {
            // Валидация входных данных
            if (!statistics || typeof statistics !== 'object') {
                throw new Error('Invalid statistics data: must be an object');
            }

            // Добавляем метаданные
            const dataToSave = {
                ...statistics,
                version: statistics.version || '1.0.0',
                lastModified: new Date().toISOString(),
                dataIntegrity: this._calculateChecksum(statistics)
            };

            // Создаем автоматическую резервную копию если прошло достаточно времени
            this._createAutoBackupIfNeeded();

            // Создаем резервную копию текущих данных перед сохранением
            if (fs.existsSync(this.dataPath)) {
                fs.copyFileSync(this.dataPath, this.backupPath);
            }

            // Атомарная запись: сначала во временный файл, затем переименование
            const tempPath = this.dataPath + '.tmp';
            const data = JSON.stringify(dataToSave, null, 2);
            fs.writeFileSync(tempPath, data, 'utf8');
            
            // Проверяем целостность записанных данных
            this._validateSavedData(tempPath, dataToSave);
            
            // Переименовываем временный файл в основной
            fs.renameSync(tempPath, this.dataPath);
            
            logInfo(`Statistics saved successfully (${data.length} bytes)`, 'statistics');
        } catch (error) {
            logError(`Failed to save statistics: ${error.message}`, 'statistics');
            
            // Удаляем временный файл если он существует
            const tempPath = this.dataPath + '.tmp';
            if (fs.existsSync(tempPath)) {
                try {
                    fs.unlinkSync(tempPath);
                } catch (cleanupError) {
                    logWarn(`Failed to cleanup temp file: ${cleanupError.message}`, 'statistics');
                }
            }
            
            throw error;
        }
    }

    /**
     * Загружает данные статистики
     * @returns {Object} данные статистики
     */
    loadStatistics() {
        try {
            if (!fs.existsSync(this.dataPath)) {
                logInfo('Statistics file not found, returning empty data', 'statistics');
                return this._getEmptyStatistics();
            }

            const data = fs.readFileSync(this.dataPath, 'utf8');
            
            // Проверяем, что файл не пустой
            if (!data.trim()) {
                logWarn('Statistics file is empty, attempting to restore from backup', 'statistics');
                return this.restoreFromBackup();
            }

            let statistics;
            try {
                statistics = JSON.parse(data);
            } catch (parseError) {
                logError(`Failed to parse statistics JSON: ${parseError.message}`, 'statistics');
                logWarn('Attempting to restore from backup due to corrupted data', 'statistics');
                return this.restoreFromBackup();
            }

            // Проверяем целостность данных
            if (!this._validateDataIntegrity(statistics)) {
                logWarn('Data integrity check failed, attempting to restore from backup', 'statistics');
                return this.restoreFromBackup();
            }

            // Проверяем версию данных и выполняем миграцию если необходимо
            statistics = this._migrateDataIfNeeded(statistics);
            
            logInfo(`Statistics loaded successfully (version: ${statistics.version})`, 'statistics');
            return statistics;
        } catch (error) {
            logError(`Failed to load statistics: ${error.message}`, 'statistics');
            
            // Пытаемся восстановить из резервной копии
            return this.restoreFromBackup();
        }
    }

    /**
     * Создает резервную копию
     * @param {boolean} timestamped - создать копию с временной меткой
     * @returns {string|null} путь к созданной резервной копии или null при ошибке
     */
    createBackup(timestamped = true) {
        try {
            if (!fs.existsSync(this.dataPath)) {
                logWarn('No data file exists to backup', 'statistics');
                return null;
            }

            let backupPath;
            if (timestamped) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                backupPath = path.join(this.backupDir, `purchaseStatistics.backup.${timestamp}.json`);
            } else {
                backupPath = this.backupPath;
            }

            // Создаем директорию если её нет
            const backupDirPath = path.dirname(backupPath);
            if (!fs.existsSync(backupDirPath)) {
                fs.mkdirSync(backupDirPath, { recursive: true });
            }

            fs.copyFileSync(this.dataPath, backupPath);
            
            // Обновляем время последнего бэкапа
            this.lastBackupTime = Date.now();
            
            logInfo(`Backup created: ${backupPath}`, 'statistics');
            
            // Очищаем старые резервные копии
            if (timestamped) {
                this._cleanupOldBackups();
            }
            
            return backupPath;
        } catch (error) {
            logError(`Failed to create backup: ${error.message}`, 'statistics');
            return null;
        }
    }

    /**
     * Восстанавливает из резервной копии
     * @returns {Object} восстановленные данные
     */
    restoreFromBackup() {
        try {
            // Сначала пытаемся восстановить из основной резервной копии
            if (fs.existsSync(this.backupPath)) {
                const data = fs.readFileSync(this.backupPath, 'utf8');
                
                if (data.trim()) {
                    try {
                        const statistics = JSON.parse(data);
                        
                        // Проверяем целостность восстановленных данных
                        if (this._validateDataIntegrity(statistics)) {
                            logInfo('Statistics restored from main backup', 'statistics');
                            return statistics;
                        } else {
                            logWarn('Main backup data integrity check failed', 'statistics');
                        }
                    } catch (parseError) {
                        logWarn(`Failed to parse main backup: ${parseError.message}`, 'statistics');
                    }
                }
            }

            // Если основная резервная копия не работает, ищем в директории бэкапов
            const backupFiles = this._getAvailableBackups();
            
            for (const backupFile of backupFiles) {
                try {
                    const backupPath = path.join(this.backupDir, backupFile);
                    const data = fs.readFileSync(backupPath, 'utf8');
                    
                    if (data.trim()) {
                        const statistics = JSON.parse(data);
                        
                        if (this._validateDataIntegrity(statistics)) {
                            logInfo(`Statistics restored from backup: ${backupFile}`, 'statistics');
                            return statistics;
                        }
                    }
                } catch (error) {
                    logWarn(`Failed to restore from backup ${backupFile}: ${error.message}`, 'statistics');
                    continue;
                }
            }

            logWarn('No valid backup found, returning empty data', 'statistics');
            return this._getEmptyStatistics();
        } catch (error) {
            logError(`Failed to restore from backup: ${error.message}`, 'statistics');
            return this._getEmptyStatistics();
        }
    }

    /**
     * Очищает устаревшие данные
     * @param {number} retentionDays - количество дней для хранения
     */
    cleanupOldData(retentionDays = 90) {
        try {
            logInfo(`Cleaning up data older than ${retentionDays} days`, 'statistics');
            
            if (!fs.existsSync(this.dataPath)) {
                logInfo('No data file exists to cleanup', 'statistics');
                return;
            }

            const statistics = this.loadStatistics();
            const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
            const cutoffTime = cutoffDate.getTime();

            let cleanedCount = 0;

            // Очищаем старые покупки
            const originalPurchasesCount = statistics.purchases.length;
            statistics.purchases = statistics.purchases.filter(purchase => {
                const purchaseTime = new Date(purchase.timestamp).getTime();
                return purchaseTime >= cutoffTime;
            });
            cleanedCount += originalPurchasesCount - statistics.purchases.length;

            // Очищаем старые продажи
            const originalSalesCount = statistics.sales.length;
            statistics.sales = statistics.sales.filter(sale => {
                const saleTime = new Date(sale.timestamp).getTime();
                return saleTime >= cutoffTime;
            });
            cleanedCount += originalSalesCount - statistics.sales.length;

            // Очищаем старые пропущенные покупки
            const originalMissedCount = statistics.missedPurchases.length;
            statistics.missedPurchases = statistics.missedPurchases.filter(missed => {
                const missedTime = new Date(missed.timestamp).getTime();
                return missedTime >= cutoffTime;
            });
            cleanedCount += originalMissedCount - statistics.missedPurchases.length;

            // Создаем архивную копию перед очисткой если есть что архивировать
            if (cleanedCount > 0) {
                const archivePath = path.join(this.backupDir, `archive-${cutoffDate.toISOString().split('T')[0]}.json`);
                
                // Создаем архив со старыми данными
                const originalData = this.loadStatistics();
                const archiveData = {
                    version: originalData.version,
                    archived: new Date().toISOString(),
                    retentionDays,
                    cutoffDate: cutoffDate.toISOString(),
                    purchases: originalData.purchases.filter(p => new Date(p.timestamp).getTime() < cutoffTime),
                    sales: originalData.sales.filter(s => new Date(s.timestamp).getTime() < cutoffTime),
                    missedPurchases: originalData.missedPurchases.filter(m => new Date(m.timestamp).getTime() < cutoffTime)
                };

                if (archiveData.purchases.length > 0 || archiveData.sales.length > 0 || archiveData.missedPurchases.length > 0) {
                    fs.writeFileSync(archivePath, JSON.stringify(archiveData, null, 2), 'utf8');
                    logInfo(`Archived ${cleanedCount} old records to: ${archivePath}`, 'statistics');
                }

                // Сохраняем очищенные данные
                this.saveStatistics(statistics);
                
                logInfo(`Cleanup completed: removed ${cleanedCount} records older than ${retentionDays} days`, 'statistics');
            } else {
                logInfo('No old data found to cleanup', 'statistics');
            }

        } catch (error) {
            logError(`Failed to cleanup old data: ${error.message}`, 'statistics');
            throw error;
        }
    }

    /**
     * Оптимизирует размер файлов данных путем сжатия и дедупликации
     * @returns {Object} отчет об оптимизации
     */
    optimizeDataFiles() {
        try {
            logInfo('Starting data file optimization', 'statistics');
            
            const statistics = this.loadStatistics();
            const originalSize = JSON.stringify(statistics).length;
            
            let optimizationReport = {
                originalSize,
                optimizedSize: 0,
                spaceSaved: 0,
                duplicatesRemoved: 0,
                emptyFieldsRemoved: 0,
                timestamp: new Date().toISOString()
            };

            // Удаляем дубликаты покупок
            const uniquePurchases = this._removeDuplicates(statistics.purchases, 'id');
            optimizationReport.duplicatesRemoved += statistics.purchases.length - uniquePurchases.length;
            statistics.purchases = uniquePurchases;

            // Удаляем дубликаты продаж
            const uniqueSales = this._removeDuplicates(statistics.sales, 'id');
            optimizationReport.duplicatesRemoved += statistics.sales.length - uniqueSales.length;
            statistics.sales = uniqueSales;

            // Удаляем дубликаты пропущенных покупок
            const uniqueMissed = this._removeDuplicates(statistics.missedPurchases, 'id');
            optimizationReport.duplicatesRemoved += statistics.missedPurchases.length - uniqueMissed.length;
            statistics.missedPurchases = uniqueMissed;

            // Очищаем пустые поля и нормализуем данные
            statistics.purchases = this._cleanEmptyFields(statistics.purchases);
            statistics.sales = this._cleanEmptyFields(statistics.sales);
            statistics.missedPurchases = this._cleanEmptyFields(statistics.missedPurchases);

            // Сортируем данные по времени для лучшего сжатия
            statistics.purchases.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            statistics.sales.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            statistics.missedPurchases.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            // Рассчитываем новый размер
            optimizationReport.optimizedSize = JSON.stringify(statistics).length;
            optimizationReport.spaceSaved = originalSize - optimizationReport.optimizedSize;

            // Сохраняем оптимизированные данные
            this.saveStatistics(statistics);

            logInfo(`Optimization completed: saved ${optimizationReport.spaceSaved} bytes, removed ${optimizationReport.duplicatesRemoved} duplicates`, 'statistics');
            return optimizationReport;
        } catch (error) {
            logError(`Data optimization failed: ${error.message}`, 'statistics');
            throw error;
        }
    }

    /**
     * Архивирует данные за указанный период
     * @param {Date} startDate - начальная дата для архивации
     * @param {Date} endDate - конечная дата для архивации
     * @param {boolean} removeFromMain - удалить ли данные из основного файла после архивации
     * @returns {string} путь к созданному архиву
     */
    archiveDataForPeriod(startDate, endDate, removeFromMain = false) {
        try {
            if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
                throw new Error('Start and end dates must be Date objects');
            }

            if (startDate >= endDate) {
                throw new Error('Start date must be before end date');
            }

            logInfo(`Archiving data from ${startDate.toISOString()} to ${endDate.toISOString()}`, 'statistics');

            const statistics = this.loadStatistics();
            const startTime = startDate.getTime();
            const endTime = endDate.getTime();

            // Фильтруем данные для архива
            const archiveData = {
                version: statistics.version,
                archived: new Date().toISOString(),
                period: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString()
                },
                purchases: statistics.purchases.filter(p => {
                    const time = new Date(p.timestamp).getTime();
                    return time >= startTime && time <= endTime;
                }),
                sales: statistics.sales.filter(s => {
                    const time = new Date(s.timestamp).getTime();
                    return time >= startTime && time <= endTime;
                }),
                missedPurchases: statistics.missedPurchases.filter(m => {
                    const time = new Date(m.timestamp).getTime();
                    return time >= startTime && time <= endTime;
                })
            };

            // Создаем имя файла архива
            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];
            const archivePath = path.join(this.backupDir, `archive-${startDateStr}-to-${endDateStr}.json`);

            // Сохраняем архив
            fs.writeFileSync(archivePath, JSON.stringify(archiveData, null, 2), 'utf8');

            const archivedCount = archiveData.purchases.length + archiveData.sales.length + archiveData.missedPurchases.length;
            logInfo(`Archived ${archivedCount} records to: ${archivePath}`, 'statistics');

            // Удаляем данные из основного файла если требуется
            if (removeFromMain && archivedCount > 0) {
                statistics.purchases = statistics.purchases.filter(p => {
                    const time = new Date(p.timestamp).getTime();
                    return !(time >= startTime && time <= endTime);
                });
                statistics.sales = statistics.sales.filter(s => {
                    const time = new Date(s.timestamp).getTime();
                    return !(time >= startTime && time <= endTime);
                });
                statistics.missedPurchases = statistics.missedPurchases.filter(m => {
                    const time = new Date(m.timestamp).getTime();
                    return !(time >= startTime && time <= endTime);
                });

                this.saveStatistics(statistics);
                logInfo(`Removed ${archivedCount} archived records from main data file`, 'statistics');
            }

            return archivePath;
        } catch (error) {
            logError(`Failed to archive data for period: ${error.message}`, 'statistics');
            throw error;
        }
    }

    /**
     * Получает статистику использования дискового пространства
     * @returns {Object} статистика использования места
     */
    getDiskUsageStats() {
        try {
            const stats = {
                mainFile: { path: this.dataPath, size: 0, exists: false },
                mainBackup: { path: this.backupPath, size: 0, exists: false },
                timestampedBackups: [],
                archives: [],
                totalSize: 0,
                timestamp: new Date().toISOString()
            };

            // Основной файл
            if (fs.existsSync(this.dataPath)) {
                stats.mainFile.exists = true;
                stats.mainFile.size = fs.statSync(this.dataPath).size;
                stats.totalSize += stats.mainFile.size;
            }

            // Основная резервная копия
            if (fs.existsSync(this.backupPath)) {
                stats.mainBackup.exists = true;
                stats.mainBackup.size = fs.statSync(this.backupPath).size;
                stats.totalSize += stats.mainBackup.size;
            }

            // Резервные копии с временными метками
            if (fs.existsSync(this.backupDir)) {
                const files = fs.readdirSync(this.backupDir);
                
                for (const file of files) {
                    const filePath = path.join(this.backupDir, file);
                    const fileStats = fs.statSync(filePath);
                    const fileInfo = {
                        filename: file,
                        path: filePath,
                        size: fileStats.size,
                        created: fileStats.birthtime.toISOString(),
                        modified: fileStats.mtime.toISOString()
                    };

                    if (file.startsWith('purchaseStatistics.backup.')) {
                        stats.timestampedBackups.push(fileInfo);
                    } else if (file.startsWith('archive-')) {
                        stats.archives.push(fileInfo);
                    }

                    stats.totalSize += fileStats.size;
                }
            }

            // Сортируем по размеру (большие первые)
            stats.timestampedBackups.sort((a, b) => b.size - a.size);
            stats.archives.sort((a, b) => b.size - a.size);

            return stats;
        } catch (error) {
            logError(`Failed to get disk usage stats: ${error.message}`, 'statistics');
            return { error: error.message, timestamp: new Date().toISOString() };
        }
    }

    /**
     * Получает список доступных резервных копий
     * @returns {Array} массив имен файлов резервных копий, отсортированный по дате (новые первые)
     */
    getAvailableBackups() {
        return this._getAvailableBackups();
    }

    /**
     * Проверяет целостность данных в файле
     * @param {string} filePath - путь к файлу для проверки
     * @returns {boolean} true если данные целые
     */
    validateFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return false;
            }

            const data = fs.readFileSync(filePath, 'utf8');
            if (!data.trim()) {
                return false;
            }

            const statistics = JSON.parse(data);
            return this._validateDataIntegrity(statistics);
        } catch (error) {
            logWarn(`File validation failed for ${filePath}: ${error.message}`, 'statistics');
            return false;
        }
    }

    /**
     * Обнаруживает поврежденные данные и автоматически восстанавливает
     * @returns {Object} восстановленные данные или пустые данные
     */
    detectCorruptionAndRecover() {
        try {
            logInfo('Starting corruption detection and recovery process', 'statistics');

            // Проверяем основной файл данных
            if (this.validateFile(this.dataPath)) {
                logInfo('Main data file is valid', 'statistics');
                return this.loadStatistics();
            }

            logWarn('Main data file is corrupted or missing', 'statistics');

            // Проверяем основную резервную копию
            if (this.validateFile(this.backupPath)) {
                logInfo('Main backup file is valid, restoring from it', 'statistics');
                
                // Восстанавливаем основной файл из резервной копии
                fs.copyFileSync(this.backupPath, this.dataPath);
                return this.loadStatistics();
            }

            logWarn('Main backup file is also corrupted or missing', 'statistics');

            // Ищем валидную резервную копию в директории бэкапов
            const backupFiles = this._getAvailableBackups();
            
            for (const backupFile of backupFiles) {
                const backupPath = path.join(this.backupDir, backupFile);
                
                if (this.validateFile(backupPath)) {
                    logInfo(`Found valid backup: ${backupFile}, restoring from it`, 'statistics');
                    
                    // Восстанавливаем основной файл из этой резервной копии
                    fs.copyFileSync(backupPath, this.dataPath);
                    
                    // Создаем новую основную резервную копию
                    fs.copyFileSync(backupPath, this.backupPath);
                    
                    return this.loadStatistics();
                }
            }

            logError('No valid backup found, creating empty data structure', 'statistics');
            
            // Если ничего не найдено, создаем пустую структуру
            const emptyData = this._getEmptyStatistics();
            this.saveStatistics(emptyData);
            
            return emptyData;
        } catch (error) {
            logError(`Corruption detection and recovery failed: ${error.message}`, 'statistics');
            return this._getEmptyStatistics();
        }
    }

    /**
     * Выполняет полную проверку целостности всех файлов
     * @returns {Object} отчет о состоянии файлов
     */
    performIntegrityCheck() {
        const report = {
            timestamp: new Date().toISOString(),
            mainFile: {
                path: this.dataPath,
                exists: fs.existsSync(this.dataPath),
                valid: false,
                size: 0,
                lastModified: null
            },
            mainBackup: {
                path: this.backupPath,
                exists: fs.existsSync(this.backupPath),
                valid: false,
                size: 0,
                lastModified: null
            },
            timestampedBackups: [],
            recommendations: []
        };

        try {
            // Проверяем основной файл
            if (report.mainFile.exists) {
                const stats = fs.statSync(this.dataPath);
                report.mainFile.size = stats.size;
                report.mainFile.lastModified = stats.mtime.toISOString();
                report.mainFile.valid = this.validateFile(this.dataPath);
            }

            // Проверяем основную резервную копию
            if (report.mainBackup.exists) {
                const stats = fs.statSync(this.backupPath);
                report.mainBackup.size = stats.size;
                report.mainBackup.lastModified = stats.mtime.toISOString();
                report.mainBackup.valid = this.validateFile(this.backupPath);
            }

            // Проверяем резервные копии с временными метками
            const backupFiles = this._getAvailableBackups();
            for (const backupFile of backupFiles) {
                const backupPath = path.join(this.backupDir, backupFile);
                const stats = fs.statSync(backupPath);
                
                report.timestampedBackups.push({
                    filename: backupFile,
                    path: backupPath,
                    valid: this.validateFile(backupPath),
                    size: stats.size,
                    lastModified: stats.mtime.toISOString()
                });
            }

            // Генерируем рекомендации
            if (!report.mainFile.exists) {
                report.recommendations.push('Main data file is missing - consider running recovery');
            } else if (!report.mainFile.valid) {
                report.recommendations.push('Main data file is corrupted - run recovery immediately');
            }

            if (!report.mainBackup.exists) {
                report.recommendations.push('Main backup file is missing - create backup');
            } else if (!report.mainBackup.valid) {
                report.recommendations.push('Main backup file is corrupted - create new backup');
            }

            const validBackups = report.timestampedBackups.filter(b => b.valid).length;
            if (validBackups === 0) {
                report.recommendations.push('No valid timestamped backups found - create backup immediately');
            } else if (validBackups < 3) {
                report.recommendations.push('Few valid backups available - consider creating more frequent backups');
            }

            logInfo(`Integrity check completed: ${report.recommendations.length} recommendations`, 'statistics');
            return report;
        } catch (error) {
            logError(`Integrity check failed: ${error.message}`, 'statistics');
            report.error = error.message;
            return report;
        }
    }

    /**
     * Создает директорию для резервных копий
     * @private
     */
    _ensureBackupDirectory() {
        try {
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
                logInfo(`Created backup directory: ${this.backupDir}`, 'statistics');
            }
        } catch (error) {
            logWarn(`Failed to create backup directory: ${error.message}`, 'statistics');
        }
    }

    /**
     * Создает автоматическую резервную копию если прошло достаточно времени
     * @private
     */
    _createAutoBackupIfNeeded() {
        const now = Date.now();
        if (now - this.lastBackupTime >= this.autoBackupInterval) {
            this.createBackup(true);
        }
    }

    /**
     * Валидирует сохраненные данные
     * @param {string} filePath - путь к файлу
     * @param {Object} originalData - исходные данные для сравнения
     * @private
     */
    _validateSavedData(filePath, originalData) {
        try {
            const savedData = fs.readFileSync(filePath, 'utf8');
            const parsedData = JSON.parse(savedData);
            
            // Проверяем контрольную сумму
            const expectedChecksum = this._calculateChecksum(originalData);
            const actualChecksum = this._calculateChecksum(parsedData);
            
            if (expectedChecksum !== actualChecksum) {
                throw new Error('Data integrity check failed after save');
            }
        } catch (error) {
            throw new Error(`Saved data validation failed: ${error.message}`);
        }
    }

    /**
     * Проверяет целостность данных
     * @param {Object} statistics - данные для проверки
     * @returns {boolean} true если данные целые
     * @private
     */
    _validateDataIntegrity(statistics) {
        try {
            // Проверяем базовую структуру
            if (!statistics || typeof statistics !== 'object') {
                return false;
            }

            // Проверяем обязательные поля
            const requiredFields = ['purchases', 'sales', 'missedPurchases'];
            for (const field of requiredFields) {
                if (!Array.isArray(statistics[field])) {
                    logWarn(`Missing or invalid field: ${field}`, 'statistics');
                    return false;
                }
            }

            // Проверяем контрольную сумму если она есть
            if (statistics.dataIntegrity) {
                const calculatedChecksum = this._calculateChecksum(statistics);
                if (calculatedChecksum !== statistics.dataIntegrity) {
                    logWarn('Data integrity checksum mismatch', 'statistics');
                    return false;
                }
            }

            return true;
        } catch (error) {
            logWarn(`Data integrity validation error: ${error.message}`, 'statistics');
            return false;
        }
    }

    /**
     * Рассчитывает контрольную сумму данных
     * @param {Object} data - данные для расчета
     * @returns {string} контрольная сумма
     * @private
     */
    _calculateChecksum(data) {
        try {
            // Создаем копию данных без метаданных для расчета контрольной суммы
            const dataForChecksum = {
                purchases: data.purchases || [],
                sales: data.sales || [],
                missedPurchases: data.missedPurchases || []
            };
            
            const dataString = JSON.stringify(dataForChecksum, Object.keys(dataForChecksum).sort());
            
            // Простая контрольная сумма на основе длины и содержимого
            let checksum = 0;
            for (let i = 0; i < dataString.length; i++) {
                checksum = ((checksum << 5) - checksum + dataString.charCodeAt(i)) & 0xffffffff;
            }
            
            return checksum.toString(16);
        } catch (error) {
            logWarn(`Failed to calculate checksum: ${error.message}`, 'statistics');
            return '0';
        }
    }

    /**
     * Выполняет миграцию данных если необходимо
     * @param {Object} statistics - данные для миграции
     * @returns {Object} мигрированные данные
     * @private
     */
    _migrateDataIfNeeded(statistics) {
        try {
            const currentVersion = '1.0.0';
            const dataVersion = statistics.version || '0.0.0';

            if (dataVersion === currentVersion) {
                return statistics;
            }

            logInfo(`Migrating data from version ${dataVersion} to ${currentVersion}`, 'statistics');

            // Здесь будут добавлены миграции при изменении версии
            const migratedData = {
                ...statistics,
                version: currentVersion,
                migrated: new Date().toISOString(),
                previousVersion: dataVersion
            };

            return migratedData;
        } catch (error) {
            logWarn(`Data migration failed: ${error.message}`, 'statistics');
            return statistics;
        }
    }

    /**
     * Получает список доступных резервных копий
     * @returns {Array} отсортированный список файлов резервных копий
     * @private
     */
    _getAvailableBackups() {
        try {
            if (!fs.existsSync(this.backupDir)) {
                return [];
            }

            const files = fs.readdirSync(this.backupDir);
            const backupFiles = files
                .filter(file => file.startsWith('purchaseStatistics.backup.') && file.endsWith('.json'))
                .sort((a, b) => {
                    // Сортируем по дате создания (новые первые)
                    const timeA = fs.statSync(path.join(this.backupDir, a)).mtime.getTime();
                    const timeB = fs.statSync(path.join(this.backupDir, b)).mtime.getTime();
                    return timeB - timeA;
                });

            return backupFiles;
        } catch (error) {
            logWarn(`Failed to get available backups: ${error.message}`, 'statistics');
            return [];
        }
    }

    /**
     * Очищает старые резервные копии
     * @private
     */
    _cleanupOldBackups() {
        try {
            const backupFiles = this._getAvailableBackups();
            
            if (backupFiles.length > this.maxBackups) {
                const filesToDelete = backupFiles.slice(this.maxBackups);
                
                for (const file of filesToDelete) {
                    const filePath = path.join(this.backupDir, file);
                    fs.unlinkSync(filePath);
                    logInfo(`Deleted old backup: ${file}`, 'statistics');
                }
                
                logInfo(`Cleaned up ${filesToDelete.length} old backup files`, 'statistics');
            }
        } catch (error) {
            logWarn(`Failed to cleanup old backups: ${error.message}`, 'statistics');
        }
    }

    /**
     * Удаляет дубликаты из массива по указанному полю
     * @param {Array} array - массив для обработки
     * @param {string} keyField - поле для определения уникальности
     * @returns {Array} массив без дубликатов
     * @private
     */
    _removeDuplicates(array, keyField) {
        if (!Array.isArray(array)) {
            return [];
        }

        const seen = new Set();
        return array.filter(item => {
            const key = item[keyField];
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Очищает пустые поля из объектов в массиве
     * @param {Array} array - массив объектов для очистки
     * @returns {Array} массив с очищенными объектами
     * @private
     */
    _cleanEmptyFields(array) {
        if (!Array.isArray(array)) {
            return [];
        }

        return array.map(item => {
            const cleaned = {};
            for (const [key, value] of Object.entries(item)) {
                // Сохраняем только непустые значения
                if (value !== null && value !== undefined && value !== '' && 
                    !(Array.isArray(value) && value.length === 0) &&
                    !(typeof value === 'object' && Object.keys(value).length === 0)) {
                    cleaned[key] = value;
                }
            }
            return cleaned;
        });
    }

    /**
     * Возвращает пустую структуру данных статистики
     * @returns {Object} пустые данные
     * @private
     */
    _getEmptyStatistics() {
        return {
            version: '1.0.0',
            created: new Date().toISOString(),
            purchases: [],
            sales: [],
            missedPurchases: [],
            itemStatistics: {},
            overallStatistics: {
                totalItems: 0,
                totalPurchases: 0,
                totalSales: 0,
                totalProfit: 0,
                averageSuccessRate: 0
            }
        };
    }
}

// Экспортируем классы и создаем основные экземпляры
const statisticsCollector = new StatisticsCollector();
const statisticsDataStore = new StatisticsDataStore();
const statisticsEngine = new StatisticsEngine(statisticsDataStore);
const ratingCalculator = new RatingCalculator();

// Инициализируем движок с хранилищем данных
statisticsEngine.initialize(statisticsDataStore);

// Convenience functions for easy access
const calculateStatistics = (data) => {
    if (!data || data.length === 0) {
        return {
            totalPurchases: 0,
            totalSales: 0,
            totalProfit: 0,
            totalMissed: 0,
            successRate: 0,
            averageProfit: 0,
            profitMargin: 0
        };
    }
    return statisticsEngine.getOverallStatistics();
};

const getTopItems = (data, limit = 10) => {
    if (!data || data.length === 0) {
        return [];
    }
    return statisticsEngine.getTopItems('rating', limit);
};

const getTopCategories = (data, limit = 5) => {
    if (!data || data.length === 0) {
        return [];
    }
    return statisticsEngine.getTopItems('profit', limit);
};

const getSpendingTrends = (data) => {
    if (!data || data.length === 0) {
        return [];
    }
    return statisticsEngine.getStatisticsForPeriod(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date());
};

module.exports = {
    StatisticsCollector,
    StatisticsEngine,
    RatingCalculator,
    StatisticsDataStore,
    
    // Экземпляры для использования в других модулях
    statisticsCollector,
    statisticsEngine,
    ratingCalculator,
    statisticsDataStore,
    profitCalculator,
    
    // Convenience functions
    calculateStatistics,
    getTopItems,
    getTopCategories,
    getSpendingTrends
};
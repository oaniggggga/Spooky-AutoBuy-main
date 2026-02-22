/**
 * Profit Calculator Module
 * Модуль расчета прибыли для системы статистики автобая
 * 
 * @author Bot System
 * @version 1.0.0
 */

const { logInfo, logWarn, logError } = require('./logging');

/**
 * Profit Calculator - рассчитывает различные показатели прибыльности
 */
class ProfitCalculator {
    constructor() {
        logInfo('ProfitCalculator initialized', 'statistics');
    }

    /**
     * Рассчитывает прибыль от продажи предмета
     * @param {number} salePrice - цена продажи
     * @param {number} purchasePrice - цена покупки
     * @returns {number} прибыль (может быть отрицательной)
     */
    calculateProfit(salePrice, purchasePrice) {
        if (typeof salePrice !== 'number' || typeof purchasePrice !== 'number') {
            throw new Error('Sale price and purchase price must be numbers');
        }
        
        if (salePrice < 0 || purchasePrice < 0) {
            throw new Error('Prices cannot be negative');
        }

        const profit = salePrice - purchasePrice;
        logInfo(`Calculated profit: ${profit} (sale: ${salePrice}, purchase: ${purchasePrice})`, 'statistics');
        return profit;
    }

    /**
     * Рассчитывает маржу прибыли в процентах
     * @param {number} profit - прибыль
     * @param {number} purchasePrice - цена покупки
     * @returns {number} маржа в процентах (0-100+)
     */
    calculateProfitMargin(profit, purchasePrice) {
        if (typeof profit !== 'number' || typeof purchasePrice !== 'number') {
            throw new Error('Profit and purchase price must be numbers');
        }
        
        if (purchasePrice <= 0) {
            logWarn('Purchase price is zero or negative, cannot calculate margin', 'statistics');
            return 0;
        }

        const margin = (profit / purchasePrice) * 100;
        logInfo(`Calculated profit margin: ${margin.toFixed(2)}% (profit: ${profit}, purchase: ${purchasePrice})`, 'statistics');
        return margin;
    }

    /**
     * Рассчитывает коэффициент прибыльности (ROI)
     * @param {number} totalProfit - общая прибыль
     * @param {number} totalInvestment - общие инвестиции
     * @returns {number} коэффициент прибыльности
     */
    calculateProfitabilityRatio(totalProfit, totalInvestment) {
        if (typeof totalProfit !== 'number' || typeof totalInvestment !== 'number') {
            throw new Error('Total profit and total investment must be numbers');
        }
        
        if (totalInvestment <= 0) {
            logWarn('Total investment is zero or negative, cannot calculate profitability ratio', 'statistics');
            return 0;
        }

        const ratio = totalProfit / totalInvestment;
        logInfo(`Calculated profitability ratio: ${ratio.toFixed(4)} (profit: ${totalProfit}, investment: ${totalInvestment})`, 'statistics');
        return ratio;
    }

    /**
     * Рассчитывает среднюю прибыль на единицу
     * @param {number} totalProfit - общая прибыль
     * @param {number} totalUnits - общее количество единиц
     * @returns {number} средняя прибыль на единицу
     */
    calculateAverageProfit(totalProfit, totalUnits) {
        if (typeof totalProfit !== 'number' || typeof totalUnits !== 'number') {
            throw new Error('Total profit and total units must be numbers');
        }
        
        if (totalUnits <= 0) {
            logWarn('Total units is zero or negative, cannot calculate average profit', 'statistics');
            return 0;
        }

        const averageProfit = totalProfit / totalUnits;
        logInfo(`Calculated average profit: ${averageProfit.toFixed(2)} (total: ${totalProfit}, units: ${totalUnits})`, 'statistics');
        return averageProfit;
    }

    /**
     * Рассчитывает среднюю цену покупки
     * @param {Array} purchases - массив покупок с ценами
     * @returns {number} средняя цена покупки
     */
    calculateAveragePurchasePrice(purchases) {
        if (!Array.isArray(purchases) || purchases.length === 0) {
            logWarn('No purchases provided for average calculation', 'statistics');
            return 0;
        }

        const totalPrice = purchases.reduce((sum, purchase) => {
            const price = purchase.purchasePrice || purchase.price || 0;
            if (typeof price !== 'number' || price < 0) {
                logWarn(`Invalid purchase price: ${price}`, 'statistics');
                return sum;
            }
            return sum + price;
        }, 0);

        const averagePrice = totalPrice / purchases.length;
        logInfo(`Calculated average purchase price: ${averagePrice.toFixed(2)} from ${purchases.length} purchases`, 'statistics');
        return averagePrice;
    }

    /**
     * Рассчитывает среднюю цену продажи
     * @param {Array} sales - массив продаж с ценами
     * @returns {number} средняя цена продажи
     */
    calculateAverageSalePrice(sales) {
        if (!Array.isArray(sales) || sales.length === 0) {
            logWarn('No sales provided for average calculation', 'statistics');
            return 0;
        }

        const totalPrice = sales.reduce((sum, sale) => {
            const price = sale.salePrice || sale.price || 0;
            if (typeof price !== 'number' || price < 0) {
                logWarn(`Invalid sale price: ${price}`, 'statistics');
                return sum;
            }
            return sum + price;
        }, 0);

        const averagePrice = totalPrice / sales.length;
        logInfo(`Calculated average sale price: ${averagePrice.toFixed(2)} from ${sales.length} sales`, 'statistics');
        return averagePrice;
    }

    /**
     * Рассчитывает потенциальную прибыль на основе текущих рыночных цен
     * @param {Array} unsoldItems - массив непроданных предметов
     * @param {Object} currentMarketPrices - текущие рыночные цены по itemId
     * @returns {Object} информация о потенциальной прибыли
     */
    calculatePotentialProfit(unsoldItems, currentMarketPrices = {}) {
        if (!Array.isArray(unsoldItems)) {
            throw new Error('Unsold items must be an array');
        }

        if (typeof currentMarketPrices !== 'object' || currentMarketPrices === null) {
            throw new Error('Current market prices must be an object');
        }

        let totalPotentialProfit = 0;
        let totalInvestment = 0;
        let itemsWithPotential = 0;
        const itemBreakdown = [];

        unsoldItems.forEach(item => {
            const itemId = item.itemId;
            const purchasePrice = item.purchasePrice || 0;
            const currentPrice = currentMarketPrices[itemId];

            if (typeof currentPrice === 'number' && currentPrice > 0) {
                const potentialProfit = this.calculateProfit(currentPrice, purchasePrice);
                const potentialMargin = this.calculateProfitMargin(potentialProfit, purchasePrice);

                totalPotentialProfit += potentialProfit;
                totalInvestment += purchasePrice;
                itemsWithPotential++;

                itemBreakdown.push({
                    itemId,
                    itemName: item.itemName || itemId,
                    purchasePrice,
                    currentMarketPrice: currentPrice,
                    potentialProfit,
                    potentialMargin,
                    timestamp: item.timestamp
                });
            }
        });

        const averagePotentialProfit = itemsWithPotential > 0 ? totalPotentialProfit / itemsWithPotential : 0;
        const potentialProfitabilityRatio = totalInvestment > 0 ? totalPotentialProfit / totalInvestment : 0;

        const result = {
            totalItems: unsoldItems.length,
            itemsWithMarketData: itemsWithPotential,
            totalPotentialProfit,
            totalInvestment,
            averagePotentialProfit,
            potentialProfitabilityRatio,
            itemBreakdown: itemBreakdown.sort((a, b) => b.potentialProfit - a.potentialProfit)
        };

        logInfo(`Calculated potential profit: ${totalPotentialProfit.toFixed(2)} from ${itemsWithPotential}/${unsoldItems.length} items`, 'statistics');
        return result;
    }

    /**
     * Рассчитывает детальную статистику прибыли для предмета
     * @param {Array} purchases - покупки предмета
     * @param {Array} sales - продажи предмета
     * @param {number} currentMarketPrice - текущая рыночная цена (опционально)
     * @returns {Object} детальная статистика прибыли
     */
    calculateItemProfitStatistics(purchases, sales, currentMarketPrice = null) {
        if (!Array.isArray(purchases)) {
            throw new Error('Purchases must be an array');
        }
        if (!Array.isArray(sales)) {
            throw new Error('Sales must be an array');
        }

        // Базовые расчеты
        const totalPurchases = purchases.length;
        const totalSales = sales.length;
        const totalInvestment = purchases.reduce((sum, p) => sum + (p.purchasePrice || 0), 0);
        const totalRevenue = sales.reduce((sum, s) => sum + (s.salePrice || 0), 0);
        const totalProfit = sales.reduce((sum, s) => sum + (s.profit || 0), 0);

        // Средние значения
        const averagePurchasePrice = this.calculateAveragePurchasePrice(purchases);
        const averageSalePrice = this.calculateAverageSalePrice(sales);
        const averageProfit = this.calculateAverageProfit(totalProfit, totalSales);

        // Коэффициенты
        const profitabilityRatio = this.calculateProfitabilityRatio(totalProfit, totalInvestment);
        const averageProfitMargin = totalSales > 0 ? 
            sales.reduce((sum, s) => sum + (s.profitMargin || 0), 0) / totalSales : 0;

        // Непроданные предметы
        const unsoldItems = purchases.slice(totalSales);
        const unsoldInvestment = unsoldItems.reduce((sum, p) => sum + (p.purchasePrice || 0), 0);

        // Потенциальная прибыль
        let potentialProfit = null;
        if (currentMarketPrice && typeof currentMarketPrice === 'number' && unsoldItems.length > 0) {
            const marketPrices = {};
            if (unsoldItems.length > 0) {
                marketPrices[unsoldItems[0].itemId] = currentMarketPrice;
            }
            potentialProfit = this.calculatePotentialProfit(unsoldItems, marketPrices);
        }

        const statistics = {
            purchases: {
                total: totalPurchases,
                totalInvestment,
                averagePrice: averagePurchasePrice
            },
            sales: {
                total: totalSales,
                totalRevenue,
                averagePrice: averageSalePrice
            },
            profit: {
                total: totalProfit,
                average: averageProfit,
                margin: averageProfitMargin,
                ratio: profitabilityRatio
            },
            unsold: {
                items: unsoldItems.length,
                investment: unsoldInvestment,
                potentialProfit: potentialProfit
            },
            performance: {
                sellThroughRate: totalPurchases > 0 ? Math.round((totalSales / totalPurchases) * 10000) / 100 : 0,
                profitPerDay: null, // Будет рассчитано если есть временные данные
                roi: profitabilityRatio * 100
            }
        };

        // Рассчитываем прибыль в день если есть временные данные
        if (purchases.length > 0 && sales.length > 0) {
            const firstPurchase = new Date(Math.min(...purchases.map(p => new Date(p.timestamp).getTime())));
            const lastSale = new Date(Math.max(...sales.map(s => new Date(s.timestamp).getTime())));
            const daysDiff = Math.max(1, Math.ceil((lastSale - firstPurchase) / (24 * 60 * 60 * 1000)));
            statistics.performance.profitPerDay = totalProfit / daysDiff;
        }

        logInfo(`Calculated detailed profit statistics for item with ${totalPurchases} purchases and ${totalSales} sales`, 'statistics');
        return statistics;
    }

    /**
     * Рассчитывает тренды прибыльности по периодам
     * @param {Array} sales - массив продаж с временными метками
     * @param {string} period - период группировки ('day', 'week', 'month')
     * @returns {Array} тренды прибыльности по периодам
     */
    calculateProfitTrends(sales, period = 'day') {
        // Validate period first
        const validPeriods = ['day', 'week', 'month'];
        if (!validPeriods.includes(period)) {
            throw new Error(`Invalid period: ${period}. Must be one of: ${validPeriods.join(', ')}`);
        }

        if (!Array.isArray(sales) || sales.length === 0) {
            logWarn('No sales provided for trend calculation', 'statistics');
            return [];
        }

        // Группируем продажи по периодам
        const periodGroups = new Map();

        sales.forEach(sale => {
            if (!sale.timestamp) {
                logWarn('Sale without timestamp, skipping', 'statistics');
                return;
            }

            const date = new Date(sale.timestamp);
            let periodKey;

            switch (period) {
                case 'day':
                    periodKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
                    break;
                case 'week':
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    periodKey = weekStart.toISOString().split('T')[0];
                    break;
                case 'month':
                    periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
            }

            if (!periodGroups.has(periodKey)) {
                periodGroups.set(periodKey, []);
            }
            periodGroups.get(periodKey).push(sale);
        });

        // Рассчитываем статистику для каждого периода
        const trends = Array.from(periodGroups.entries()).map(([periodKey, periodSales]) => {
            const totalProfit = periodSales.reduce((sum, s) => sum + (s.profit || 0), 0);
            const totalRevenue = periodSales.reduce((sum, s) => sum + (s.salePrice || 0), 0);
            const averageProfit = this.calculateAverageProfit(totalProfit, periodSales.length);
            const averageMargin = periodSales.reduce((sum, s) => sum + (s.profitMargin || 0), 0) / periodSales.length;

            return {
                period: periodKey,
                salesCount: periodSales.length,
                totalProfit,
                totalRevenue,
                averageProfit,
                averageMargin,
                profitPerSale: averageProfit
            };
        });

        // Сортируем по периоду
        trends.sort((a, b) => a.period.localeCompare(b.period));

        logInfo(`Calculated profit trends for ${trends.length} ${period} periods`, 'statistics');
        return trends;
    }

    /**
     * Сравнивает прибыльность между двумя периодами
     * @param {Array} currentPeriodSales - продажи текущего периода
     * @param {Array} previousPeriodSales - продажи предыдущего периода
     * @returns {Object} сравнение прибыльности
     */
    compareProfitability(currentPeriodSales, previousPeriodSales) {
        if (!Array.isArray(currentPeriodSales) || !Array.isArray(previousPeriodSales)) {
            throw new Error('Both periods must be arrays of sales');
        }

        const currentStats = this._calculatePeriodStats(currentPeriodSales);
        const previousStats = this._calculatePeriodStats(previousPeriodSales);

        const comparison = {
            current: currentStats,
            previous: previousStats,
            changes: {
                profitChange: currentStats.totalProfit - previousStats.totalProfit,
                profitChangePercent: previousStats.totalProfit > 0 ? 
                    ((currentStats.totalProfit - previousStats.totalProfit) / previousStats.totalProfit) * 100 : 0,
                salesChange: currentStats.salesCount - previousStats.salesCount,
                salesChangePercent: previousStats.salesCount > 0 ? 
                    ((currentStats.salesCount - previousStats.salesCount) / previousStats.salesCount) * 100 : 0,
                averageProfitChange: currentStats.averageProfit - previousStats.averageProfit,
                marginChange: currentStats.averageMargin - previousStats.averageMargin
            }
        };

        logInfo(`Compared profitability: current profit ${currentStats.totalProfit.toFixed(2)} vs previous ${previousStats.totalProfit.toFixed(2)}`, 'statistics');
        return comparison;
    }

    /**
     * Вспомогательный метод для расчета статистики периода
     * @param {Array} sales - продажи периода
     * @returns {Object} статистика периода
     */
    _calculatePeriodStats(sales) {
        if (!Array.isArray(sales) || sales.length === 0) {
            return {
                salesCount: 0,
                totalProfit: 0,
                totalRevenue: 0,
                averageProfit: 0,
                averageMargin: 0
            };
        }

        const totalProfit = sales.reduce((sum, s) => sum + (s.profit || 0), 0);
        const totalRevenue = sales.reduce((sum, s) => sum + (s.salePrice || 0), 0);
        const averageProfit = this.calculateAverageProfit(totalProfit, sales.length);
        const averageMargin = sales.reduce((sum, s) => sum + (s.profitMargin || 0), 0) / sales.length;

        return {
            salesCount: sales.length,
            totalProfit,
            totalRevenue,
            averageProfit,
            averageMargin
        };
    }
}

// Создаем экземпляр для экспорта
const profitCalculator = new ProfitCalculator();

module.exports = {
    ProfitCalculator,
    profitCalculator
};
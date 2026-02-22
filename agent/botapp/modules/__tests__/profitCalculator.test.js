const fc = require('fast-check');
const { ProfitCalculator, profitCalculator } = require('../profitCalculator');

describe('ProfitCalculator Class', () => {
    let calculator;

    beforeEach(() => {
        calculator = new ProfitCalculator();
    });

    describe('Basic Profit Calculations', () => {
        test('calculateProfit works correctly with positive profit', () => {
            const profit = calculator.calculateProfit(1500, 1000);
            expect(profit).toBe(500);
        });

        test('calculateProfit works correctly with negative profit (loss)', () => {
            const profit = calculator.calculateProfit(800, 1000);
            expect(profit).toBe(-200);
        });

        test('calculateProfit works correctly with zero profit', () => {
            const profit = calculator.calculateProfit(1000, 1000);
            expect(profit).toBe(0);
        });

        test('calculateProfit throws error for invalid inputs', () => {
            expect(() => calculator.calculateProfit('invalid', 1000)).toThrow('Sale price and purchase price must be numbers');
            expect(() => calculator.calculateProfit(1000, 'invalid')).toThrow('Sale price and purchase price must be numbers');
            expect(() => calculator.calculateProfit(-100, 1000)).toThrow('Prices cannot be negative');
            expect(() => calculator.calculateProfit(1000, -100)).toThrow('Prices cannot be negative');
        });
    });

    describe('Profit Margin Calculations', () => {
        test('calculateProfitMargin works correctly with positive margin', () => {
            const margin = calculator.calculateProfitMargin(500, 1000);
            expect(margin).toBe(50); // 50%
        });

        test('calculateProfitMargin works correctly with negative margin', () => {
            const margin = calculator.calculateProfitMargin(-200, 1000);
            expect(margin).toBe(-20); // -20%
        });

        test('calculateProfitMargin handles zero purchase price', () => {
            const margin = calculator.calculateProfitMargin(500, 0);
            expect(margin).toBe(0);
        });

        test('calculateProfitMargin throws error for invalid inputs', () => {
            expect(() => calculator.calculateProfitMargin('invalid', 1000)).toThrow('Profit and purchase price must be numbers');
            expect(() => calculator.calculateProfitMargin(500, 'invalid')).toThrow('Profit and purchase price must be numbers');
        });
    });

    describe('Profitability Ratio Calculations', () => {
        test('calculateProfitabilityRatio works correctly', () => {
            const ratio = calculator.calculateProfitabilityRatio(2000, 5000);
            expect(ratio).toBe(0.4); // 40% return
        });

        test('calculateProfitabilityRatio handles zero investment', () => {
            const ratio = calculator.calculateProfitabilityRatio(1000, 0);
            expect(ratio).toBe(0);
        });

        test('calculateProfitabilityRatio throws error for invalid inputs', () => {
            expect(() => calculator.calculateProfitabilityRatio('invalid', 1000)).toThrow('Total profit and total investment must be numbers');
            expect(() => calculator.calculateProfitabilityRatio(1000, 'invalid')).toThrow('Total profit and total investment must be numbers');
        });
    });

    describe('Average Calculations', () => {
        test('calculateAverageProfit works correctly', () => {
            const average = calculator.calculateAverageProfit(1500, 3);
            expect(average).toBe(500);
        });

        test('calculateAverageProfit handles zero units', () => {
            const average = calculator.calculateAverageProfit(1000, 0);
            expect(average).toBe(0);
        });

        test('calculateAveragePurchasePrice works correctly', () => {
            const purchases = [
                { purchasePrice: 1000 },
                { purchasePrice: 1500 },
                { purchasePrice: 2000 }
            ];
            const average = calculator.calculateAveragePurchasePrice(purchases);
            expect(average).toBe(1500);
        });

        test('calculateAveragePurchasePrice handles empty array', () => {
            const average = calculator.calculateAveragePurchasePrice([]);
            expect(average).toBe(0);
        });

        test('calculateAveragePurchasePrice handles invalid prices', () => {
            const purchases = [
                { purchasePrice: 1000 },
                { purchasePrice: 'invalid' },
                { purchasePrice: 2000 }
            ];
            const average = calculator.calculateAveragePurchasePrice(purchases);
            expect(average).toBe(1000); // (1000 + 0 + 2000) / 3
        });

        test('calculateAverageSalePrice works correctly', () => {
            const sales = [
                { salePrice: 1200 },
                { salePrice: 1800 },
                { salePrice: 2400 }
            ];
            const average = calculator.calculateAverageSalePrice(sales);
            expect(average).toBe(1800);
        });
    });

    describe('Potential Profit Calculations', () => {
        test('calculatePotentialProfit works correctly', () => {
            const unsoldItems = [
                { itemId: 'item1', itemName: 'Item 1', purchasePrice: 1000, timestamp: '2026-01-01T00:00:00Z' },
                { itemId: 'item2', itemName: 'Item 2', purchasePrice: 1500, timestamp: '2026-01-01T00:00:00Z' }
            ];
            const marketPrices = {
                'item1': 1200,
                'item2': 1800
            };

            const result = calculator.calculatePotentialProfit(unsoldItems, marketPrices);

            expect(result.totalItems).toBe(2);
            expect(result.itemsWithMarketData).toBe(2);
            expect(result.totalPotentialProfit).toBe(500); // (1200-1000) + (1800-1500)
            expect(result.totalInvestment).toBe(2500);
            expect(result.averagePotentialProfit).toBe(250);
            expect(result.itemBreakdown).toHaveLength(2);
        });

        test('calculatePotentialProfit handles missing market data', () => {
            const unsoldItems = [
                { itemId: 'item1', purchasePrice: 1000 },
                { itemId: 'item2', purchasePrice: 1500 }
            ];
            const marketPrices = {
                'item1': 1200
                // item2 missing
            };

            const result = calculator.calculatePotentialProfit(unsoldItems, marketPrices);

            expect(result.totalItems).toBe(2);
            expect(result.itemsWithMarketData).toBe(1);
            expect(result.totalPotentialProfit).toBe(200);
            expect(result.itemBreakdown).toHaveLength(1);
        });

        test('calculatePotentialProfit throws error for invalid inputs', () => {
            expect(() => calculator.calculatePotentialProfit('invalid', {})).toThrow('Unsold items must be an array');
            expect(() => calculator.calculatePotentialProfit([], 'invalid')).toThrow('Current market prices must be an object');
        });
    });

    describe('Item Profit Statistics', () => {
        test('calculateItemProfitStatistics works correctly', () => {
            const purchases = [
                { purchasePrice: 1000, timestamp: '2026-01-01T00:00:00Z' },
                { purchasePrice: 1200, timestamp: '2026-01-02T00:00:00Z' },
                { purchasePrice: 1100, timestamp: '2026-01-03T00:00:00Z' }
            ];
            const sales = [
                { salePrice: 1300, profit: 300, profitMargin: 0.3, timestamp: '2026-01-04T00:00:00Z' },
                { salePrice: 1500, profit: 300, profitMargin: 0.25, timestamp: '2026-01-05T00:00:00Z' }
            ];

            const stats = calculator.calculateItemProfitStatistics(purchases, sales);

            expect(stats.purchases.total).toBe(3);
            expect(stats.purchases.totalInvestment).toBe(3300);
            expect(stats.sales.total).toBe(2);
            expect(stats.sales.totalRevenue).toBe(2800);
            expect(stats.profit.total).toBe(600);
            expect(stats.unsold.items).toBe(1);
            expect(stats.performance.sellThroughRate).toBe(66.67); // 2/3 * 100
        });

        test('calculateItemProfitStatistics handles empty arrays', () => {
            const stats = calculator.calculateItemProfitStatistics([], []);

            expect(stats.purchases.total).toBe(0);
            expect(stats.sales.total).toBe(0);
            expect(stats.profit.total).toBe(0);
            expect(stats.unsold.items).toBe(0);
        });

        test('calculateItemProfitStatistics throws error for invalid inputs', () => {
            expect(() => calculator.calculateItemProfitStatistics('invalid', [])).toThrow('Purchases must be an array');
            expect(() => calculator.calculateItemProfitStatistics([], 'invalid')).toThrow('Sales must be an array');
        });
    });

    describe('Profit Trends', () => {
        test('calculateProfitTrends works correctly for daily periods', () => {
            const sales = [
                { salePrice: 1300, profit: 300, profitMargin: 0.3, timestamp: '2026-01-01T10:00:00Z' },
                { salePrice: 1400, profit: 400, profitMargin: 0.4, timestamp: '2026-01-01T15:00:00Z' },
                { salePrice: 1500, profit: 500, profitMargin: 0.5, timestamp: '2026-01-02T10:00:00Z' }
            ];

            const trends = calculator.calculateProfitTrends(sales, 'day');

            expect(trends).toHaveLength(2);
            expect(trends[0].period).toBe('2026-01-01');
            expect(trends[0].salesCount).toBe(2);
            expect(trends[0].totalProfit).toBe(700);
            expect(trends[1].period).toBe('2026-01-02');
            expect(trends[1].salesCount).toBe(1);
            expect(trends[1].totalProfit).toBe(500);
        });

        test('calculateProfitTrends handles empty sales array', () => {
            const trends = calculator.calculateProfitTrends([]);
            expect(trends).toEqual([]);
        });

        test('calculateProfitTrends throws error for invalid period', () => {
            expect(() => calculator.calculateProfitTrends([], 'invalid')).toThrow('Invalid period: invalid. Must be one of: day, week, month');
        });
    });

    describe('Profitability Comparison', () => {
        test('compareProfitability works correctly', () => {
            const currentSales = [
                { salePrice: 1300, profit: 300, profitMargin: 0.3 },
                { salePrice: 1400, profit: 400, profitMargin: 0.4 }
            ];
            const previousSales = [
                { salePrice: 1200, profit: 200, profitMargin: 0.2 }
            ];

            const comparison = calculator.compareProfitability(currentSales, previousSales);

            expect(comparison.current.salesCount).toBe(2);
            expect(comparison.current.totalProfit).toBe(700);
            expect(comparison.previous.salesCount).toBe(1);
            expect(comparison.previous.totalProfit).toBe(200);
            expect(comparison.changes.profitChange).toBe(500);
            expect(comparison.changes.profitChangePercent).toBe(250); // (700-200)/200 * 100
        });

        test('compareProfitability throws error for invalid inputs', () => {
            expect(() => calculator.compareProfitability('invalid', [])).toThrow('Both periods must be arrays of sales');
            expect(() => calculator.compareProfitability([], 'invalid')).toThrow('Both periods must be arrays of sales');
        });
    });

    describe('Property-Based Tests', () => {
        test('Property 1: Profit calculation is always sale price minus purchase price', () => {
            const testProperty = fc.property(
                fc.float({ min: Math.fround(0), max: Math.fround(10000) }), // salePrice
                fc.float({ min: Math.fround(0), max: Math.fround(10000) }), // purchasePrice
                (salePrice, purchasePrice) => {
                    // Skip NaN values
                    fc.pre(!isNaN(salePrice) && !isNaN(purchasePrice));
                    
                    const profit = calculator.calculateProfit(salePrice, purchasePrice);
                    const expected = salePrice - purchasePrice;
                    
                    // Handle NaN case
                    if (isNaN(expected)) {
                        expect(isNaN(profit)).toBe(true);
                    } else {
                        expect(profit).toBeCloseTo(expected, 10);
                    }
                }
            );
            
            fc.assert(testProperty, { numRuns: 100 });
        });

        test('Property 2: Profit margin calculation is mathematically correct', () => {
            const testProperty = fc.property(
                fc.float({ min: Math.fround(-1000), max: Math.fround(1000) }), // profit
                fc.float({ min: Math.fround(0.1), max: Math.fround(10000) }), // purchasePrice (avoid zero)
                (profit, purchasePrice) => {
                    // Skip NaN values
                    fc.pre(!isNaN(profit) && !isNaN(purchasePrice) && purchasePrice > 0);
                    
                    const margin = calculator.calculateProfitMargin(profit, purchasePrice);
                    const expectedMargin = (profit / purchasePrice) * 100;
                    expect(margin).toBeCloseTo(expectedMargin, 10);
                }
            );
            
            fc.assert(testProperty, { numRuns: 100 });
        });

        test('Property 3: Average profit calculation is correct', () => {
            const testProperty = fc.property(
                fc.float({ min: -1000, max: 1000 }), // totalProfit
                fc.integer({ min: 1, max: 100 }), // totalUnits (avoid zero)
                (totalProfit, totalUnits) => {
                    const average = calculator.calculateAverageProfit(totalProfit, totalUnits);
                    const expectedAverage = totalProfit / totalUnits;
                    expect(average).toBeCloseTo(expectedAverage, 10);
                }
            );
            
            fc.assert(testProperty, { numRuns: 100 });
        });

        test('Property 4: Profitability ratio is always profit divided by investment', () => {
            const testProperty = fc.property(
                fc.float({ min: Math.fround(-1000), max: Math.fround(1000) }), // totalProfit
                fc.float({ min: Math.fround(0.1), max: Math.fround(10000) }), // totalInvestment (avoid zero)
                (totalProfit, totalInvestment) => {
                    // Skip NaN values
                    fc.pre(!isNaN(totalProfit) && !isNaN(totalInvestment) && totalInvestment > 0);
                    
                    const ratio = calculator.calculateProfitabilityRatio(totalProfit, totalInvestment);
                    const expectedRatio = totalProfit / totalInvestment;
                    expect(ratio).toBeCloseTo(expectedRatio, 10);
                }
            );
            
            fc.assert(testProperty, { numRuns: 100 });
        });

        test('Property 5: Potential profit calculation is consistent', () => {
            const testProperty = fc.property(
                fc.array(fc.record({
                    itemId: fc.string({ minLength: 1, maxLength: 10 }),
                    purchasePrice: fc.float({ min: 1, max: 1000 }),
                    timestamp: fc.constant('2026-01-01T00:00:00Z')
                }), { minLength: 1, maxLength: 10 }),
                fc.dictionary(
                    fc.string({ minLength: 1, maxLength: 10 }),
                    fc.float({ min: 1, max: 2000 })
                ),
                (unsoldItems, marketPrices) => {
                    const result = calculator.calculatePotentialProfit(unsoldItems, marketPrices);
                    
                    // Verify basic properties
                    expect(result.totalItems).toBe(unsoldItems.length);
                    expect(result.itemsWithMarketData).toBeLessThanOrEqual(unsoldItems.length);
                    expect(result.itemBreakdown).toHaveLength(result.itemsWithMarketData);
                    
                    // Verify calculations
                    const expectedInvestment = unsoldItems
                        .filter(item => marketPrices[item.itemId])
                        .reduce((sum, item) => sum + item.purchasePrice, 0);
                    expect(result.totalInvestment).toBeCloseTo(expectedInvestment, 10);
                    
                    if (result.itemsWithMarketData > 0) {
                        const expectedAverage = result.totalPotentialProfit / result.itemsWithMarketData;
                        expect(result.averagePotentialProfit).toBeCloseTo(expectedAverage, 10);
                    }
                }
            );
            
            fc.assert(testProperty, { numRuns: 50 });
        });
    });

    describe('Module Export', () => {
        test('profitCalculator instance is exported correctly', () => {
            expect(profitCalculator).toBeInstanceOf(ProfitCalculator);
            expect(typeof profitCalculator.calculateProfit).toBe('function');
            expect(typeof profitCalculator.calculateProfitMargin).toBe('function');
        });
    });
});
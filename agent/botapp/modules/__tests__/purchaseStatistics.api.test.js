const fc = require('fast-check');
const {
    StatisticsEngine,
    StatisticsDataStore,
    StatisticsCollector,
    RatingCalculator,
    statisticsEngine,
    statisticsDataStore,
    statisticsCollector,
    ratingCalculator
} = require('../purchaseStatistics');

describe('Purchase Statistics API - Property-Based Tests', () => {
    let engine;
    let dataStore;
    let collector;
    let calculator;

    beforeEach(() => {
        // Create fresh instances for each test
        dataStore = new StatisticsDataStore();
        engine = new StatisticsEngine(dataStore);
        collector = new StatisticsCollector();
        calculator = new RatingCalculator();
        
        // Initialize engine with data store
        engine.initialize(dataStore);
    });

    describe('Property 10: API Response Completeness', () => {
        /**
         * Property 10: API Response Completeness
         * For any API request for item statistics, the response should contain all required fields
         * (purchases, sales, profit, rating, missed purchases)
         * 
         * Validates: Requirements 5.3, 7.4
         * 
         * Feature: purchase-statistics, Property 10: API Response Completeness
         */
        test('Property 10: API Response Completeness - getItemStatistics returns all required fields', () => {
            const testProperty = fc.property(
                fc.record({
                    itemId: fc.string({ minLength: 1, maxLength: 20 }),
                    purchaseCount: fc.integer({ min: 1, max: 50 }),
                    saleCount: fc.integer({ min: 0, max: 50 }),
                    missedCount: fc.integer({ min: 0, max: 20 })
                }),
                (testData) => {
                    const { itemId, purchaseCount, saleCount, missedCount } = testData;

                    // Generate purchase records
                    for (let i = 0; i < purchaseCount; i++) {
                        engine.data.purchases.push({
                            id: `purchase_${i}`,
                            itemId,
                            itemName: `Item ${itemId}`,
                            itemDetails: {
                                enchantments: [],
                                attributes: {},
                                rarity: 'common'
                            },
                            purchasePrice: 1000 + i * 100,
                            timestamp: new Date(Date.now() - i * 1000).toISOString(),
                            source: 'auction_house'
                        });
                    }

                    // Generate sale records
                    for (let i = 0; i < saleCount; i++) {
                        engine.data.sales.push({
                            id: `sale_${i}`,
                            purchaseId: null,
                            itemId,
                            salePrice: 1500 + i * 100,
                            profit: 500 + i * 50,
                            profitMargin: 0.5,
                            timestamp: new Date(Date.now() - i * 2000).toISOString(),
                            holdingTime: 3600000
                        });
                    }

                    // Generate missed purchase records
                    for (let i = 0; i < missedCount; i++) {
                        engine.data.missedPurchases.push({
                            id: `missed_${i}`,
                            itemId,
                            attemptedPrice: 900 + i * 50,
                            reason: 'already_sold',
                            timestamp: new Date(Date.now() - i * 3000).toISOString(),
                            details: 'Item was already purchased'
                        });
                    }

                    // Call API method
                    const response = engine.getItemStatistics(itemId);

                    // Verify all required fields are present
                    expect(response).toBeDefined();
                    expect(response).not.toBeNull();

                    // Required fields for item statistics response
                    const requiredFields = [
                        'itemId',
                        'itemName',
                        'totalPurchases',
                        'totalSales',
                        'totalProfit',
                        'averageProfit',
                        'profitMargin',
                        'successRate',
                        'rating',
                        'missedPurchases',
                        'lastActivity'
                    ];

                    // Check that all required fields exist
                    for (const field of requiredFields) {
                        expect(response).toHaveProperty(field);
                        expect(response[field]).not.toBeUndefined();
                    }

                    // Verify missedPurchases object has required structure
                    expect(response.missedPurchases).toHaveProperty('total');
                    expect(response.missedPurchases).toHaveProperty('reasons');
                    expect(typeof response.missedPurchases.total).toBe('number');
                    expect(typeof response.missedPurchases.reasons).toBe('object');

                    // Verify field types
                    expect(typeof response.itemId).toBe('string');
                    expect(typeof response.itemName).toBe('string');
                    expect(typeof response.totalPurchases).toBe('number');
                    expect(typeof response.totalSales).toBe('number');
                    expect(typeof response.totalProfit).toBe('number');
                    expect(typeof response.averageProfit).toBe('number');
                    expect(typeof response.profitMargin).toBe('number');
                    expect(typeof response.successRate).toBe('number');
                    expect(typeof response.rating).toBe('number');

                    // Verify field value constraints
                    expect(response.totalPurchases).toBeGreaterThanOrEqual(0);
                    expect(response.totalSales).toBeGreaterThanOrEqual(0);
                    expect(response.successRate).toBeGreaterThanOrEqual(0);
                    expect(response.successRate).toBeLessThanOrEqual(1);
                    expect(response.profitMargin).toBeGreaterThanOrEqual(0);
                    expect(response.rating).toBeGreaterThanOrEqual(0);
                    expect(response.rating).toBeLessThanOrEqual(5);

                    // Verify consistency: totalPurchases should match generated count
                    expect(response.totalPurchases).toBe(purchaseCount);
                    expect(response.totalSales).toBe(saleCount);
                    expect(response.missedPurchases.total).toBe(missedCount);
                }
            );

            fc.assert(testProperty, { numRuns: 100 });
        });

        /**
         * Property 10 Extended: API Response Completeness - getOverallStatistics
         * For any API request for overall statistics, the response should contain all required fields
         * 
         * Validates: Requirements 5.3, 7.4
         * 
         * Feature: purchase-statistics, Property 10: API Response Completeness (Overall)
         */
        test('Property 10: API Response Completeness - getOverallStatistics returns all required fields', () => {
            const testProperty = fc.property(
                fc.record({
                    itemCount: fc.integer({ min: 1, max: 20 }),
                    purchasesPerItem: fc.integer({ min: 1, max: 10 }),
                    salesPerItem: fc.integer({ min: 0, max: 10 })
                }),
                (testData) => {
                    const { itemCount, purchasesPerItem, salesPerItem } = testData;

                    // Generate data for multiple items
                    for (let itemIdx = 0; itemIdx < itemCount; itemIdx++) {
                        const itemId = `item_${itemIdx}`;

                        for (let i = 0; i < purchasesPerItem; i++) {
                            engine.data.purchases.push({
                                id: `purchase_${itemIdx}_${i}`,
                                itemId,
                                itemName: `Item ${itemIdx}`,
                                itemDetails: { enchantments: [], attributes: {}, rarity: 'common' },
                                purchasePrice: 1000 + i * 100,
                                timestamp: new Date(Date.now() - i * 1000).toISOString(),
                                source: 'auction_house'
                            });
                        }

                        for (let i = 0; i < salesPerItem; i++) {
                            engine.data.sales.push({
                                id: `sale_${itemIdx}_${i}`,
                                purchaseId: null,
                                itemId,
                                salePrice: 1500 + i * 100,
                                profit: 500 + i * 50,
                                profitMargin: 0.5,
                                timestamp: new Date(Date.now() - i * 2000).toISOString(),
                                holdingTime: 3600000
                            });
                        }
                    }

                    // Call API method
                    const response = engine.getOverallStatistics();

                    // Verify all required fields are present
                    expect(response).toBeDefined();
                    expect(response).not.toBeNull();

                    // Required fields for overall statistics response
                    const requiredFields = [
                        'totalItems',
                        'totalPurchases',
                        'totalSales',
                        'totalProfit',
                        'averageSuccessRate',
                        'topItems'
                    ];

                    // Check that all required fields exist
                    for (const field of requiredFields) {
                        expect(response).toHaveProperty(field);
                        expect(response[field]).not.toBeUndefined();
                    }

                    // Verify field types
                    expect(typeof response.totalItems).toBe('number');
                    expect(typeof response.totalPurchases).toBe('number');
                    expect(typeof response.totalSales).toBe('number');
                    expect(typeof response.totalProfit).toBe('number');
                    expect(typeof response.averageSuccessRate).toBe('number');
                    expect(Array.isArray(response.topItems)).toBe(true);

                    // Verify field value constraints
                    expect(response.totalItems).toBeGreaterThanOrEqual(0);
                    expect(response.totalPurchases).toBeGreaterThanOrEqual(0);
                    expect(response.totalSales).toBeGreaterThanOrEqual(0);
                    expect(response.averageSuccessRate).toBeGreaterThanOrEqual(0);
                    expect(response.averageSuccessRate).toBeLessThanOrEqual(1);

                    // Verify consistency
                    expect(response.totalItems).toBe(itemCount);
                    expect(response.totalPurchases).toBe(itemCount * purchasesPerItem);
                    expect(response.totalSales).toBe(itemCount * salesPerItem);
                }
            );

            fc.assert(testProperty, { numRuns: 100 });
        });

        /**
         * Property 10 Extended: API Response Completeness - getTopItems
         * For any API request for top items, the response should contain all required fields
         * 
         * Validates: Requirements 5.3, 7.4
         * 
         * Feature: purchase-statistics, Property 10: API Response Completeness (Top Items)
         */
        test('Property 10: API Response Completeness - getTopItems returns complete item data', () => {
            const testProperty = fc.property(
                fc.record({
                    itemCount: fc.integer({ min: 5, max: 20 }),
                    limit: fc.integer({ min: 1, max: 10 })
                }),
                (testData) => {
                    const { itemCount, limit } = testData;

                    // Generate data for multiple items
                    for (let itemIdx = 0; itemIdx < itemCount; itemIdx++) {
                        const itemId = `item_${itemIdx}`;

                        // Create at least one purchase per item
                        engine.data.purchases.push({
                            id: `purchase_${itemIdx}`,
                            itemId,
                            itemName: `Item ${itemIdx}`,
                            itemDetails: { enchantments: [], attributes: {}, rarity: 'common' },
                            purchasePrice: 1000 + itemIdx * 100,
                            timestamp: new Date(Date.now() - itemIdx * 1000).toISOString(),
                            source: 'auction_house'
                        });

                        // Create sales with varying profits
                        engine.data.sales.push({
                            id: `sale_${itemIdx}`,
                            purchaseId: null,
                            itemId,
                            salePrice: 1500 + itemIdx * 150,
                            profit: 500 + itemIdx * 50,
                            profitMargin: 0.5,
                            timestamp: new Date(Date.now() - itemIdx * 2000).toISOString(),
                            holdingTime: 3600000
                        });
                    }

                    // Call API method
                    const response = engine.getTopItems('rating', limit);

                    // Verify response is an array
                    expect(Array.isArray(response)).toBe(true);

                    // Verify response length doesn't exceed limit
                    expect(response.length).toBeLessThanOrEqual(limit);

                    // Verify each item in response has all required fields
                    for (const item of response) {
                        expect(item).toBeDefined();
                        expect(item).not.toBeNull();

                        const requiredFields = [
                            'itemId',
                            'itemName',
                            'totalPurchases',
                            'totalSales',
                            'totalProfit',
                            'averageProfit',
                            'profitMargin',
                            'successRate',
                            'rating',
                            'missedPurchases',
                            'lastActivity'
                        ];

                        // Check that all required fields exist
                        for (const field of requiredFields) {
                            expect(item).toHaveProperty(field);
                            expect(item[field]).not.toBeUndefined();
                        }

                        // Verify field types
                        expect(typeof item.itemId).toBe('string');
                        expect(typeof item.itemName).toBe('string');
                        expect(typeof item.totalPurchases).toBe('number');
                        expect(typeof item.totalSales).toBe('number');
                        expect(typeof item.totalProfit).toBe('number');
                        expect(typeof item.rating).toBe('number');
                    }

                    // Verify items are sorted by rating (descending)
                    for (let i = 1; i < response.length; i++) {
                        expect(response[i - 1].rating).toBeGreaterThanOrEqual(response[i].rating);
                    }
                }
            );

            fc.assert(testProperty, { numRuns: 100 });
        });

        /**
         * Property 10 Extended: API Response Completeness - getStatisticsForPeriod
         * For any API request for period statistics, the response should contain all required fields
         * 
         * Validates: Requirements 5.3, 7.4
         * 
         * Feature: purchase-statistics, Property 10: API Response Completeness (Period)
         */
        test('Property 10: API Response Completeness - getStatisticsForPeriod returns complete data', () => {
            const testProperty = fc.property(
                fc.record({
                    itemCount: fc.integer({ min: 1, max: 10 }),
                    daysInPast: fc.integer({ min: 1, max: 30 })
                }),
                (testData) => {
                    const { itemCount, daysInPast } = testData;

                    // Generate data for multiple items within the period
                    const endDate = new Date();
                    const startDate = new Date(endDate.getTime() - daysInPast * 24 * 60 * 60 * 1000);

                    for (let itemIdx = 0; itemIdx < itemCount; itemIdx++) {
                        const itemId = `item_${itemIdx}`;

                        // Create purchases within the period
                        engine.data.purchases.push({
                            id: `purchase_${itemIdx}`,
                            itemId,
                            itemName: `Item ${itemIdx}`,
                            itemDetails: { enchantments: [], attributes: {}, rarity: 'common' },
                            purchasePrice: 1000 + itemIdx * 100,
                            timestamp: new Date(startDate.getTime() + itemIdx * 1000).toISOString(),
                            source: 'auction_house'
                        });

                        // Create sales within the period
                        engine.data.sales.push({
                            id: `sale_${itemIdx}`,
                            purchaseId: null,
                            itemId,
                            salePrice: 1500 + itemIdx * 150,
                            profit: 500 + itemIdx * 50,
                            profitMargin: 0.5,
                            timestamp: new Date(startDate.getTime() + itemIdx * 2000).toISOString(),
                            holdingTime: 3600000
                        });
                    }

                    // Call API method
                    const response = engine.getStatisticsForPeriod(startDate, endDate);

                    // Verify response structure
                    expect(response).toBeDefined();
                    expect(response).not.toBeNull();

                    // Required fields for period statistics response
                    const requiredFields = [
                        'period',
                        'totalPurchases',
                        'totalSales',
                        'totalProfit',
                        'totalMissed',
                        'uniqueItems',
                        'averageSuccessRate',
                        'items'
                    ];

                    // Check that all required fields exist
                    for (const field of requiredFields) {
                        expect(response).toHaveProperty(field);
                        expect(response[field]).not.toBeUndefined();
                    }

                    // Verify period object structure
                    expect(response.period).toHaveProperty('start');
                    expect(response.period).toHaveProperty('end');
                    expect(response.period).toHaveProperty('durationDays');

                    // Verify field types
                    expect(typeof response.totalPurchases).toBe('number');
                    expect(typeof response.totalSales).toBe('number');
                    expect(typeof response.totalProfit).toBe('number');
                    expect(typeof response.totalMissed).toBe('number');
                    expect(typeof response.uniqueItems).toBe('number');
                    expect(typeof response.averageSuccessRate).toBe('number');
                    expect(Array.isArray(response.items)).toBe(true);

                    // Verify field value constraints
                    expect(response.totalPurchases).toBeGreaterThanOrEqual(0);
                    expect(response.totalSales).toBeGreaterThanOrEqual(0);
                    expect(response.uniqueItems).toBeGreaterThanOrEqual(0);
                    expect(response.averageSuccessRate).toBeGreaterThanOrEqual(0);
                    expect(response.averageSuccessRate).toBeLessThanOrEqual(1);

                    // Verify each item in items array has required fields
                    for (const item of response.items) {
                        expect(item).toHaveProperty('itemId');
                        expect(item).toHaveProperty('itemName');
                        expect(item).toHaveProperty('purchases');
                        expect(item).toHaveProperty('sales');
                        expect(item).toHaveProperty('profit');
                        expect(item).toHaveProperty('profitMargin');
                        expect(item).toHaveProperty('successRate');
                        expect(item).toHaveProperty('missed');
                        expect(item).toHaveProperty('totalInvestment');
                    }

                    // Verify consistency
                    expect(response.uniqueItems).toBe(itemCount);
                }
            );

            fc.assert(testProperty, { numRuns: 100 });
        });
    });

    describe('API Response Validation', () => {
        test('API responses should not contain undefined values in required fields', () => {
            const testProperty = fc.property(
                fc.string({ minLength: 1, maxLength: 20 }),
                (itemId) => {
                    // Add test data
                    engine.data.purchases.push({
                        id: 'purchase_1',
                        itemId,
                        itemName: `Item ${itemId}`,
                        itemDetails: { enchantments: [], attributes: {}, rarity: 'common' },
                        purchasePrice: 1000,
                        timestamp: new Date().toISOString(),
                        source: 'auction_house'
                    });

                    engine.data.sales.push({
                        id: 'sale_1',
                        purchaseId: null,
                        itemId,
                        salePrice: 1500,
                        profit: 500,
                        profitMargin: 0.5,
                        timestamp: new Date().toISOString(),
                        holdingTime: 3600000
                    });

                    const response = engine.getItemStatistics(itemId);

                    // Check that no required field is undefined
                    expect(response.itemId).toBeDefined();
                    expect(response.itemName).toBeDefined();
                    expect(response.totalPurchases).toBeDefined();
                    expect(response.totalSales).toBeDefined();
                    expect(response.totalProfit).toBeDefined();
                    expect(response.averageProfit).toBeDefined();
                    expect(response.profitMargin).toBeDefined();
                    expect(response.successRate).toBeDefined();
                    expect(response.rating).toBeDefined();
                    expect(response.missedPurchases).toBeDefined();
                    expect(response.lastActivity).toBeDefined();
                }
            );

            fc.assert(testProperty, { numRuns: 50 });
        });

        test('API responses should have consistent data types across multiple calls', () => {
            const testProperty = fc.property(
                fc.string({ minLength: 1, maxLength: 20 }),
                (itemId) => {
                    // Add test data
                    for (let i = 0; i < 3; i++) {
                        engine.data.purchases.push({
                            id: `purchase_${i}`,
                            itemId,
                            itemName: `Item ${itemId}`,
                            itemDetails: { enchantments: [], attributes: {}, rarity: 'common' },
                            purchasePrice: 1000 + i * 100,
                            timestamp: new Date(Date.now() - i * 1000).toISOString(),
                            source: 'auction_house'
                        });
                    }

                    // Call API multiple times
                    const response1 = engine.getItemStatistics(itemId);
                    const response2 = engine.getItemStatistics(itemId);

                    // Verify types are consistent
                    expect(typeof response1.itemId).toBe(typeof response2.itemId);
                    expect(typeof response1.totalPurchases).toBe(typeof response2.totalPurchases);
                    expect(typeof response1.rating).toBe(typeof response2.rating);
                    expect(typeof response1.successRate).toBe(typeof response2.successRate);
                }
            );

            fc.assert(testProperty, { numRuns: 50 });
        });
    });
});

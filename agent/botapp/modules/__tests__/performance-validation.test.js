const { computeSmartPrice, computeSimplePrice, calculatePricesWithCoefficients } = require('../priceCalculator');
const CoefficientManager = require('../CoefficientManager');

describe('Performance and Validation Tests', () => {
    let coefficientManager;
    
    beforeEach(() => {
        // Reset coefficient manager to defaults for consistent testing
        coefficientManager = CoefficientManager.getInstance();
        coefficientManager.resetToDefaults();
    });
    
    describe('Performance Tests - Requirement 6.2', () => {
        test('coefficient lookup performance should be under 1ms for various price ranges', () => {
            const testPrices = [
                100, 500, 999,           // Cheap items
                1000, 5000, 9999,       // Medium items  
                10000, 50000, 99999,    // Expensive items
                100000, 500000, 999999, // Very expensive items
                1000000, 5000000        // Elite items
            ];
            
            // Warm up the coefficient manager
            testPrices.forEach(price => {
                coefficientManager.findCoefficientForPrice(price);
            });
            
            // Measure performance for each price range
            testPrices.forEach(price => {
                const iterations = 1000;
                const startTime = process.hrtime.bigint();
                
                for (let i = 0; i < iterations; i++) {
                    coefficientManager.findCoefficientForPrice(price);
                }
                
                const endTime = process.hrtime.bigint();
                const totalTimeMs = Number(endTime - startTime) / 1000000; // Convert to milliseconds
                const avgTimeMs = totalTimeMs / iterations;
                
                // Performance requirement: should be under 1ms average
                expect(avgTimeMs).toBeLessThan(1);
                
                // Log performance for monitoring
                console.log(`Price ${price}: ${avgTimeMs.toFixed(4)}ms avg (${iterations} iterations)`);
            });
        });
        
        test('price calculation performance should be acceptable for various lot sizes', () => {
            const lotSizes = [1, 10, 100, 1000];
            
            lotSizes.forEach(size => {
                // Generate test lots
                const lots = Array.from({ length: size }, (_, i) => ({
                    unitPrice: 1000 + Math.random() * 1000,
                    amount: Math.floor(Math.random() * 64) + 1,
                    seller: `Player${i}`,
                    timestamp: Date.now() - Math.random() * 86400000
                }));
                
                const iterations = 100;
                
                // Test smart price calculation performance
                const smartStartTime = process.hrtime.bigint();
                for (let i = 0; i < iterations; i++) {
                    computeSmartPrice(lots, 1500);
                }
                const smartEndTime = process.hrtime.bigint();
                const smartAvgTime = Number(smartEndTime - smartStartTime) / 1000000 / iterations;
                
                // Test simple price calculation performance
                const simpleStartTime = process.hrtime.bigint();
                for (let i = 0; i < iterations; i++) {
                    computeSimplePrice(lots, 1500);
                }
                const simpleEndTime = process.hrtime.bigint();
                const simpleAvgTime = Number(simpleEndTime - simpleStartTime) / 1000000 / iterations;
                
                // Performance requirements
                expect(smartAvgTime).toBeLessThan(10); // Should be under 10ms for reasonable lot sizes
                expect(simpleAvgTime).toBeLessThan(5);  // Simple should be faster
                
                // Smart calculation should not be more than 5x slower than simple
                const ratio = smartAvgTime / simpleAvgTime;
                expect(ratio).toBeLessThan(5);
                
                console.log(`${size} lots - Smart: ${smartAvgTime.toFixed(4)}ms, Simple: ${simpleAvgTime.toFixed(4)}ms, Ratio: ${ratio.toFixed(2)}x`);
            });
        });
        
        test('large dataset performance should be acceptable', () => {
            // Generate large lot dataset
            const largeLots = Array.from({ length: 5000 }, (_, i) => ({
                unitPrice: Math.floor(Math.random() * 1000000) + 100,
                amount: Math.floor(Math.random() * 64) + 1,
                seller: `Player${i}`,
                timestamp: Date.now() - Math.random() * 86400000
            }));
            
            const iterations = 10;
            const startTime = process.hrtime.bigint();
            
            for (let i = 0; i < iterations; i++) {
                computeSmartPrice(largeLots, 50000);
            }
            
            const endTime = process.hrtime.bigint();
            const avgTime = Number(endTime - startTime) / 1000000 / iterations;
            
            // Should handle large datasets within reasonable time
            expect(avgTime).toBeLessThan(100); // Under 100ms for 5000 lots
            
            console.log(`Large dataset (5000 lots): ${avgTime.toFixed(2)}ms avg`);
        });
    });
    
    describe('Mathematical Accuracy Validation - Requirements 2.4, 2.5, 2.6, 2.7', () => {
        test('should calculate correct prices for cheap items (1-999) - Requirement 2.4', () => {
            const testPrices = [1, 100, 500, 999];
            const expectedCoefficient = 'Дешевые предметы';
            const expectedBuyMultiplier = 0.8;
            const expectedSellMultiplier = 1.2;
            
            testPrices.forEach(price => {
                const result = computeSmartPrice([], price);
                
                expect(result.coefficient).toBe(expectedCoefficient);
                expect(result.absolutePrice).toBe(price);
                expect(result.buyPrice).toBe(Math.floor(price * expectedBuyMultiplier));
                expect(result.sellPrice).toBe(Math.floor(price * expectedSellMultiplier));
                
                // Validate profit calculations
                const expectedProfit = result.sellPrice - result.buyPrice;
                const expectedProfitPercent = (expectedProfit / result.buyPrice) * 100;
                expect(result.profit).toBe(expectedProfit);
                expect(Math.abs(result.profitPercent - expectedProfitPercent)).toBeLessThan(0.01);
                
                // Business rule validation
                expect(result.buyPrice).toBeLessThan(result.sellPrice);
                expect(result.profit).toBeGreaterThan(0);
            });
        });
        
        test('should calculate correct prices for medium items (1000-9999) - Requirement 2.5', () => {
            const testPrices = [1000, 2500, 5000, 7500, 9999];
            const expectedCoefficient = 'Средние предметы';
            const expectedBuyMultiplier = 0.75;
            const expectedSellMultiplier = 1.25;
            
            testPrices.forEach(price => {
                const result = computeSmartPrice([], price);
                
                expect(result.coefficient).toBe(expectedCoefficient);
                expect(result.absolutePrice).toBe(price);
                expect(result.buyPrice).toBe(Math.floor(price * expectedBuyMultiplier));
                expect(result.sellPrice).toBe(Math.floor(price * expectedSellMultiplier));
                
                // Validate profit calculations
                const expectedProfit = result.sellPrice - result.buyPrice;
                const expectedProfitPercent = (expectedProfit / result.buyPrice) * 100;
                expect(result.profit).toBe(expectedProfit);
                expect(Math.abs(result.profitPercent - expectedProfitPercent)).toBeLessThan(0.01);
                
                // Business rule validation
                expect(result.buyPrice).toBeLessThan(result.sellPrice);
                expect(result.profit).toBeGreaterThan(0);
            });
        });
        
        test('should calculate correct prices for expensive items (10000-99999) - Requirement 2.6', () => {
            const testPrices = [10000, 25000, 50000, 75000, 99999];
            const expectedCoefficient = 'Дорогие предметы';
            const expectedBuyMultiplier = 0.7;
            const expectedSellMultiplier = 1.3;
            
            testPrices.forEach(price => {
                const result = computeSmartPrice([], price);
                
                expect(result.coefficient).toBe(expectedCoefficient);
                expect(result.absolutePrice).toBe(price);
                expect(result.buyPrice).toBe(Math.floor(price * expectedBuyMultiplier));
                expect(result.sellPrice).toBe(Math.floor(price * expectedSellMultiplier));
                
                // Validate profit calculations
                const expectedProfit = result.sellPrice - result.buyPrice;
                const expectedProfitPercent = (expectedProfit / result.buyPrice) * 100;
                expect(result.profit).toBe(expectedProfit);
                expect(Math.abs(result.profitPercent - expectedProfitPercent)).toBeLessThan(0.01);
                
                // Business rule validation
                expect(result.buyPrice).toBeLessThan(result.sellPrice);
                expect(result.profit).toBeGreaterThan(0);
            });
        });
        
        test('should calculate correct prices for very expensive items (100000-999999) - Requirement 2.7', () => {
            const testPrices = [100000, 250000, 500000, 750000, 999999];
            const expectedCoefficient = 'Очень дорогие предметы';
            const expectedBuyMultiplier = 0.65;
            const expectedSellMultiplier = 1.35;
            
            testPrices.forEach(price => {
                const result = computeSmartPrice([], price);
                
                expect(result.coefficient).toBe(expectedCoefficient);
                expect(result.absolutePrice).toBe(price);
                expect(result.buyPrice).toBe(Math.floor(price * expectedBuyMultiplier));
                expect(result.sellPrice).toBe(Math.floor(price * expectedSellMultiplier));
                
                // Validate profit calculations
                const expectedProfit = result.sellPrice - result.buyPrice;
                const expectedProfitPercent = (expectedProfit / result.buyPrice) * 100;
                expect(result.profit).toBe(expectedProfit);
                expect(Math.abs(result.profitPercent - expectedProfitPercent)).toBeLessThan(0.01);
                
                // Business rule validation
                expect(result.buyPrice).toBeLessThan(result.sellPrice);
                expect(result.profit).toBeGreaterThan(0);
            });
        });
        
        test('should calculate correct prices for elite items (1000000+) - Requirement 2.7', () => {
            const testPrices = [1000000, 2500000, 5000000, 10000000];
            const expectedCoefficient = 'Элитные предметы';
            const expectedBuyMultiplier = 0.6;
            const expectedSellMultiplier = 1.4;
            
            testPrices.forEach(price => {
                const result = computeSmartPrice([], price);
                
                expect(result.coefficient).toBe(expectedCoefficient);
                expect(result.absolutePrice).toBe(price);
                expect(result.buyPrice).toBe(Math.floor(price * expectedBuyMultiplier));
                expect(result.sellPrice).toBe(Math.floor(price * expectedSellMultiplier));
                
                // Validate profit calculations
                const expectedProfit = result.sellPrice - result.buyPrice;
                const expectedProfitPercent = (expectedProfit / result.buyPrice) * 100;
                expect(result.profit).toBe(expectedProfit);
                expect(Math.abs(result.profitPercent - expectedProfitPercent)).toBeLessThan(0.01);
                
                // Business rule validation
                expect(result.buyPrice).toBeLessThan(result.sellPrice);
                expect(result.profit).toBeGreaterThan(0);
            });
        });
        
        test('should handle boundary values correctly', () => {
            const boundaryTests = [
                { price: 999, expectedCoeff: 'Дешевые предметы' },
                { price: 1000, expectedCoeff: 'Средние предметы' },
                { price: 9999, expectedCoeff: 'Средние предметы' },
                { price: 10000, expectedCoeff: 'Дорогие предметы' },
                { price: 99999, expectedCoeff: 'Дорогие предметы' },
                { price: 100000, expectedCoeff: 'Очень дорогие предметы' },
                { price: 999999, expectedCoeff: 'Очень дорогие предметы' },
                { price: 1000000, expectedCoeff: 'Элитные предметы' }
            ];
            
            boundaryTests.forEach(test => {
                const result = computeSmartPrice([], test.price);
                expect(result.coefficient).toBe(test.expectedCoeff);
                expect(result.absolutePrice).toBe(test.price);
                expect(result.buyPrice).toBeLessThan(result.sellPrice);
                expect(result.profit).toBeGreaterThan(0);
            });
        });
    });
    
    describe('Edge Case Validation', () => {
        test('should handle extreme price values', () => {
            const extremeTests = [
                { price: 1, desc: 'minimum price' },
                { price: 0.5, desc: 'fractional price' },
                { price: 100000000, desc: 'very large price' }
            ];
            
            extremeTests.forEach(test => {
                const result = computeSmartPrice([], test.price);
                expect(result).toBeDefined();
                expect(result.buyPrice).toBeGreaterThan(0);
                expect(result.sellPrice).toBeGreaterThan(result.buyPrice);
                expect(result.profit).toBeGreaterThan(0);
            });
        });
        
        test('should handle lots with extreme values', () => {
            const extremeLots = [
                [{ unitPrice: 0.1 }],
                [{ unitPrice: 999999999 }],
                [{ unitPrice: 1000 }, { unitPrice: 1000000 }], // Mixed ranges
            ];
            
            extremeLots.forEach((lots, index) => {
                const result = computeSmartPrice(lots, 5000);
                expect(result).toBeDefined();
                expect(result.buyPrice).toBeLessThan(result.sellPrice);
                expect(result.profit).toBeGreaterThan(0);
            });
        });
        
        test('should maintain precision in calculations', () => {
            // Test that all calculations result in integers (no floating point issues)
            const precisionTests = [1.1, 1.9, 999.99, 1000.01, 5000.5, 10000.1];
            
            precisionTests.forEach(price => {
                const result = computeSmartPrice([], price);
                
                // All monetary values should be integers
                expect(Number.isInteger(result.absolutePrice)).toBe(true);
                expect(Number.isInteger(result.buyPrice)).toBe(true);
                expect(Number.isInteger(result.sellPrice)).toBe(true);
                expect(Number.isInteger(result.profit)).toBe(true);
                
                // Profit percent can be decimal, but should be finite
                expect(Number.isFinite(result.profitPercent)).toBe(true);
            });
        });
        
        test('should be consistent with same inputs', () => {
            // Test that same input always produces same output
            const testPrice = 5000;
            const result1 = computeSmartPrice([], testPrice);
            const result2 = computeSmartPrice([], testPrice);
            
            expect(result1).toEqual(result2);
        });
    });
    
    describe('Advanced Function Validation', () => {
        test('calculatePricesWithCoefficients should provide detailed information', () => {
            const testPrices = [500, 5000, 50000, 500000, 5000000];
            
            testPrices.forEach(price => {
                const result = calculatePricesWithCoefficients(price, `TestItem_${price}`);
                
                expect(result).toHaveProperty('marketPrice', price);
                expect(result).toHaveProperty('coefficient');
                expect(result).toHaveProperty('buyPrice');
                expect(result).toHaveProperty('sellPrice');
                expect(result).toHaveProperty('profit');
                expect(result).toHaveProperty('profitPercent');
                
                // Validate coefficient object
                expect(result.coefficient).toBeDefined();
                expect(typeof result.coefficient.getName).toBe('function');
                expect(typeof result.coefficient.calculateBuyPrice).toBe('function');
                expect(typeof result.coefficient.calculateSellPrice).toBe('function');
                
                // Validate business rules
                expect(result.buyPrice).toBeLessThan(result.sellPrice);
                expect(result.profit).toBeGreaterThan(0);
                expect(result.profitPercent).toBeGreaterThan(0);
            });
        });
        
        test('calculatePricesWithCoefficients should handle errors properly', () => {
            const invalidInputs = [0, -100, null, undefined, 'invalid', NaN, Infinity];
            
            invalidInputs.forEach(input => {
                expect(() => {
                    calculatePricesWithCoefficients(input);
                }).toThrow();
            });
        });
    });
    
    describe('Stress Testing', () => {
        test('should handle concurrent calculations', async () => {
            const concurrentCalculations = 100;
            const promises = [];
            
            for (let i = 0; i < concurrentCalculations; i++) {
                const price = Math.random() * 1000000 + 100;
                const lots = Array.from({ length: 10 }, () => ({
                    unitPrice: price + Math.random() * 1000 - 500
                }));
                
                promises.push(
                    new Promise(resolve => {
                        const result = computeSmartPrice(lots, price);
                        resolve(result);
                    })
                );
            }
            
            const results = await Promise.all(promises);
            
            // All calculations should complete successfully
            expect(results).toHaveLength(concurrentCalculations);
            results.forEach(result => {
                expect(result).toBeDefined();
                expect(result.buyPrice).toBeLessThan(result.sellPrice);
                expect(result.profit).toBeGreaterThan(0);
            });
        });
        
        test('should handle memory efficiently with large datasets', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Process multiple large datasets
            for (let i = 0; i < 10; i++) {
                const largeLots = Array.from({ length: 1000 }, (_, j) => ({
                    unitPrice: Math.random() * 100000 + 100,
                    amount: Math.floor(Math.random() * 64) + 1,
                    seller: `Player${j}`,
                    timestamp: Date.now()
                }));
                
                computeSmartPrice(largeLots, 50000);
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // Memory increase should be reasonable (less than 50MB)
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        });
    });
});
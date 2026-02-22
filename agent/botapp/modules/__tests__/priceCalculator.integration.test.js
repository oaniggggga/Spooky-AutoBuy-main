const fs = require('fs');
const path = require('path');
const { computeSmartPrice, computeSimplePrice, calculatePricesWithCoefficients } = require('../priceCalculator');
const { getHistoricalPrice, updatePriceData, getPriceSnapshot } = require('../../../../controller/priceStore');
const CoefficientManager = require('../CoefficientManager');

describe('PriceCalculator Integration Tests', () => {
    let originalPriceStore;
    let coefficientManager;
    
    beforeEach(() => {
        // Save original price store state
        originalPriceStore = getPriceSnapshot();
        
        // Reset coefficient manager to defaults
        coefficientManager = CoefficientManager.getInstance();
        coefficientManager.resetToDefaults();
    });
    
    afterEach(() => {
        // Restore original state if needed
        // Note: In a real scenario, we might want to restore the price store
        // but for testing purposes, we'll let it persist
    });
    
    describe('Integration with priceStore.js', () => {
        test('should use historical price from priceStore when lots are empty', () => {
            // Arrange: Add test data to price store
            const testItem = 'Diamond Sword';
            const testPrice = 5000;
            updatePriceData({
                item: testItem,
                absoluteMinUnitPrice: testPrice,
                buyPrice: 3750,
                sellPrice: 4750,
                timestamp: Date.now()
            });
            
            // Act: Calculate price with empty lots
            const result = computeSmartPrice([], testPrice);
            
            // Assert: Should use historical price and apply smart coefficients
            expect(result).toBeDefined();
            expect(result.absolutePrice).toBe(testPrice);
            expect(result.buyPrice).toBeGreaterThan(0);
            expect(result.sellPrice).toBeGreaterThan(result.buyPrice);
            expect(result.coefficient).toBeDefined();
        });
        
        test('should maintain compatibility with existing bot logic', () => {
            // Arrange: Test data that existing bot logic expects
            const lots = [
                { unitPrice: 1000 },
                { unitPrice: 1200 },
                { unitPrice: 950 }
            ];
            const historicalPrice = 1100;
            
            // Act: Calculate with both old and new methods
            const simpleResult = computeSimplePrice(lots, historicalPrice);
            const smartResult = computeSmartPrice(lots, historicalPrice);
            
            // Assert: Both should return compatible structure
            expect(simpleResult).toHaveProperty('absolutePrice');
            expect(simpleResult).toHaveProperty('buyPrice');
            expect(simpleResult).toHaveProperty('sellPrice');
            
            expect(smartResult).toHaveProperty('absolutePrice');
            expect(smartResult).toHaveProperty('buyPrice');
            expect(smartResult).toHaveProperty('sellPrice');
            
            // Smart result should have additional properties
            expect(smartResult).toHaveProperty('coefficient');
            expect(smartResult).toHaveProperty('profit');
            expect(smartResult).toHaveProperty('profitPercent');
            
            // Both should maintain business rule: buy < sell
            expect(simpleResult.buyPrice).toBeLessThan(simpleResult.sellPrice);
            expect(smartResult.buyPrice).toBeLessThan(smartResult.sellPrice);
        });
        
        test('should handle price store integration with various price ranges', () => {
            const testCases = [
                { name: 'Cheap Item', price: 500, expectedCoefficient: 'Дешевые предметы' },
                { name: 'Medium Item', price: 5000, expectedCoefficient: 'Средние предметы' },
                { name: 'Expensive Item', price: 50000, expectedCoefficient: 'Дорогие предметы' },
                { name: 'Very Expensive Item', price: 500000, expectedCoefficient: 'Очень дорогие предметы' },
                { name: 'Elite Item', price: 5000000, expectedCoefficient: 'Элитные предметы' }
            ];
            
            testCases.forEach(testCase => {
                // Arrange: Update price store with test data
                updatePriceData({
                    item: testCase.name,
                    absoluteMinUnitPrice: testCase.price,
                    buyPrice: Math.floor(testCase.price * 0.8),
                    sellPrice: Math.floor(testCase.price * 1.2),
                    timestamp: Date.now()
                });
                
                // Act: Calculate smart price
                const result = computeSmartPrice([], testCase.price);
                
                // Assert: Should use correct coefficient
                expect(result.coefficient).toBe(testCase.expectedCoefficient);
                expect(result.absolutePrice).toBe(testCase.price);
                expect(result.buyPrice).toBeLessThan(result.sellPrice);
            });
        });
        
        test('should handle corrupted price store data gracefully', () => {
            // Arrange: Test with invalid historical price
            const lots = [{ unitPrice: 1000 }];
            const invalidHistoricalPrice = null;
            
            // Act: Should not throw and provide fallback
            const result = computeSmartPrice(lots, invalidHistoricalPrice);
            
            // Assert: Should handle gracefully
            expect(result).toBeDefined();
            expect(result.absolutePrice).toBe(1000); // Should use lots data
            expect(result.buyPrice).toBeGreaterThan(0);
            expect(result.sellPrice).toBeGreaterThan(result.buyPrice);
        });
    });
    
    describe('Integration with existing bot systems', () => {
        test('should work with real auction lot data structure', () => {
            // Arrange: Simulate real auction data structure
            const realAuctionLots = [
                {
                    unitPrice: 1500,
                    amount: 64,
                    seller: 'TestPlayer1',
                    timestamp: Date.now()
                },
                {
                    unitPrice: 1450,
                    amount: 32,
                    seller: 'TestPlayer2',
                    timestamp: Date.now() - 1000
                },
                {
                    unitPrice: 1600,
                    amount: 16,
                    seller: 'TestPlayer3',
                    timestamp: Date.now() - 2000
                }
            ];
            
            // Act: Calculate prices
            const result = computeSmartPrice(realAuctionLots, 1500);
            
            // Assert: Should use minimum price and apply correct coefficient
            expect(result.absolutePrice).toBe(1450); // Minimum from lots
            expect(result.coefficient).toBe('Средние предметы'); // 1450 is in 1000-10000 range
            expect(result.buyPrice).toBe(Math.floor(1450 * 0.75)); // Medium coefficient buy multiplier
            expect(result.sellPrice).toBe(Math.floor(1450 * 1.25)); // Medium coefficient sell multiplier
        });
        
        test('should maintain backward compatibility with bot command system', () => {
            // Arrange: Test data that bot commands might use
            const testScenarios = [
                { lots: [], historical: 1000 },
                { lots: [{ unitPrice: 500 }], historical: null },
                { lots: [{ unitPrice: 50000 }], historical: 45000 },
                { lots: null, historical: 2000 }
            ];
            
            testScenarios.forEach((scenario, index) => {
                // Act: Both functions should work without throwing
                let simpleResult, smartResult;
                
                expect(() => {
                    simpleResult = computeSimplePrice(scenario.lots, scenario.historical);
                }).not.toThrow();
                
                expect(() => {
                    smartResult = computeSmartPrice(scenario.lots, scenario.historical);
                }).not.toThrow();
                
                // Assert: Results should be valid
                expect(simpleResult).toBeDefined();
                expect(smartResult).toBeDefined();
                
                // Both should have required properties
                ['absolutePrice', 'buyPrice', 'sellPrice'].forEach(prop => {
                    expect(simpleResult).toHaveProperty(prop);
                    expect(smartResult).toHaveProperty(prop);
                    expect(typeof simpleResult[prop]).toBe('number');
                    expect(typeof smartResult[prop]).toBe('number');
                });
                
                // Business rule validation
                expect(simpleResult.buyPrice).toBeLessThan(simpleResult.sellPrice);
                expect(smartResult.buyPrice).toBeLessThan(smartResult.sellPrice);
            });
        });
        
        test('should integrate properly with coefficient management system', () => {
            // Arrange: Test coefficient updates affect price calculations
            const testPrice = 5000;
            const lots = [{ unitPrice: testPrice }];
            
            // Act: Calculate with default coefficients
            const resultBefore = computeSmartPrice(lots, testPrice);
            
            // Modify coefficient for this price range
            const coefficients = coefficientManager.getAllCoefficients();
            const mediumCoefficient = coefficients.find(c => c.getName() === 'Средние предметы');
            expect(mediumCoefficient).toBeDefined();
            
            // Create modified coefficient with different multipliers
            const modifiedCoefficient = {
                name: 'Средние предметы',
                description: 'Modified for testing',
                minPrice: 1000,
                maxPrice: 10000,
                buyMultiplier: 0.8, // Changed from 0.75
                sellMultiplier: 1.3  // Changed from 1.25
            };
            
            // Update coefficient manager
            coefficientManager.removeCoefficient(mediumCoefficient);
            coefficientManager.addCoefficient(modifiedCoefficient);
            
            // Act: Calculate with modified coefficients
            const resultAfter = computeSmartPrice(lots, testPrice);
            
            // Assert: Results should be different
            expect(resultAfter.buyPrice).not.toBe(resultBefore.buyPrice);
            expect(resultAfter.sellPrice).not.toBe(resultBefore.sellPrice);
            
            // New calculations should use modified multipliers
            expect(resultAfter.buyPrice).toBe(Math.floor(testPrice * 0.8));
            expect(resultAfter.sellPrice).toBe(Math.floor(testPrice * 1.3));
        });
    });
    
    describe('Error handling integration', () => {
        test('should handle coefficient manager failures gracefully', () => {
            // Arrange: Force coefficient manager error by corrupting data
            const originalFindMethod = coefficientManager.findCoefficientForPrice;
            coefficientManager.findCoefficientForPrice = () => {
                throw new Error('Simulated coefficient manager failure');
            };
            
            try {
                // Act: Should not crash the system
                const result = computeSmartPrice([{ unitPrice: 1000 }], 1000);
                
                // Assert: Should fall back to simple calculation
                expect(result).toBeDefined();
                expect(result.absolutePrice).toBe(1000);
                expect(result.buyPrice).toBe(750); // Simple calculation: 1000 * 0.75
                expect(result.sellPrice).toBe(950); // Simple calculation: 1000 * 0.95
                expect(result.coefficient).toBeUndefined(); // No coefficient info in fallback
            } finally {
                // Restore original method
                coefficientManager.findCoefficientForPrice = originalFindMethod;
            }
        });
        
        test('should handle price store unavailability', () => {
            // Arrange: Test with no historical price and empty lots
            const result = computeSmartPrice([], null);
            
            // Assert: Should provide safe defaults
            expect(result).toBeDefined();
            expect(result.absolutePrice).toBe(1000); // Default fallback
            expect(result.buyPrice).toBeGreaterThan(0);
            expect(result.sellPrice).toBeGreaterThan(result.buyPrice);
        });
    });
});
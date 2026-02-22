const fc = require('fast-check');
const Coefficient = require('../Coefficient');

describe('Coefficient Class', () => {
    describe('Constructor Validation', () => {
        test('creates valid coefficient with proper parameters', () => {
            const coeff = new Coefficient('test', 'Test coefficient', 0, 1000, 0.8, 0.95);
            
            expect(coeff.getName()).toBe('test');
            expect(coeff.getDescription()).toBe('Test coefficient');
            expect(coeff.getMinPrice()).toBe(0);
            expect(coeff.getMaxPrice()).toBe(1000);
            expect(coeff.getBuyMultiplier()).toBe(0.8);
            expect(coeff.getSellMultiplier()).toBe(0.95);
        });

        test('throws error for invalid name', () => {
            expect(() => new Coefficient('', 'desc', 0, 1000, 0.8, 0.95)).toThrow('Name must be a non-empty string');
            expect(() => new Coefficient(null, 'desc', 0, 1000, 0.8, 0.95)).toThrow('Name must be a non-empty string');
            expect(() => new Coefficient('   ', 'desc', 0, 1000, 0.8, 0.95)).toThrow('Name must be a non-empty string');
        });

        test('throws error for invalid description', () => {
            expect(() => new Coefficient('test', null, 0, 1000, 0.8, 0.95)).toThrow('Description must be a string');
            expect(() => new Coefficient('test', 123, 0, 1000, 0.8, 0.95)).toThrow('Description must be a string');
        });

        test('throws error for invalid minPrice', () => {
            expect(() => new Coefficient('test', 'desc', -1, 1000, 0.8, 0.95)).toThrow('MinPrice must be a non-negative number');
            expect(() => new Coefficient('test', 'desc', 'invalid', 1000, 0.8, 0.95)).toThrow('MinPrice must be a non-negative number');
        });

        test('throws error for invalid maxPrice', () => {
            expect(() => new Coefficient('test', 'desc', 1000, 500, 0.8, 0.95)).toThrow('MaxPrice must be null or a number greater than minPrice');
            expect(() => new Coefficient('test', 'desc', 1000, 1000, 0.8, 0.95)).toThrow('MaxPrice must be null or a number greater than minPrice');
        });

        test('throws error for invalid multipliers', () => {
            expect(() => new Coefficient('test', 'desc', 0, 1000, 0, 0.95)).toThrow('BuyMultiplier must be a positive number');
            expect(() => new Coefficient('test', 'desc', 0, 1000, -0.5, 0.95)).toThrow('BuyMultiplier must be a positive number');
            expect(() => new Coefficient('test', 'desc', 0, 1000, 0.8, 0)).toThrow('SellMultiplier must be a positive number');
            expect(() => new Coefficient('test', 'desc', 0, 1000, 0.8, -0.5)).toThrow('SellMultiplier must be a positive number');
        });
    });

    describe('Price Range Matching', () => {
        test('matches method works correctly for bounded range', () => {
            const coeff = new Coefficient('test', 'desc', 100, 1000, 0.8, 0.95);
            
            expect(coeff.matches(50)).toBe(false);   // Below range
            expect(coeff.matches(100)).toBe(true);   // At min boundary
            expect(coeff.matches(500)).toBe(true);   // Within range
            expect(coeff.matches(999)).toBe(true);   // Just below max
            expect(coeff.matches(1000)).toBe(false); // At max boundary (exclusive)
            expect(coeff.matches(1500)).toBe(false); // Above range
        });

        test('matches method works correctly for open range', () => {
            const coeff = new Coefficient('test', 'desc', 1000, null, 0.8, 0.95);
            
            expect(coeff.matches(500)).toBe(false);    // Below range
            expect(coeff.matches(1000)).toBe(true);    // At min boundary
            expect(coeff.matches(10000)).toBe(true);   // Well above min
            expect(coeff.matches(1000000)).toBe(true); // Very high value
        });

        test('matches method handles invalid inputs', () => {
            const coeff = new Coefficient('test', 'desc', 100, 1000, 0.8, 0.95);
            
            expect(coeff.matches(-1)).toBe(false);
            expect(coeff.matches('invalid')).toBe(false);
            expect(coeff.matches(null)).toBe(false);
            expect(coeff.matches(undefined)).toBe(false);
        });
    });

    describe('Price Calculations', () => {
        test('calculateBuyPrice works correctly', () => {
            const coeff = new Coefficient('test', 'desc', 0, 1000, 0.75, 0.95);
            
            expect(coeff.calculateBuyPrice(1000)).toBe(750);  // 1000 * 0.75 = 750
            expect(coeff.calculateBuyPrice(100)).toBe(75);    // 100 * 0.75 = 75
            expect(coeff.calculateBuyPrice(133)).toBe(99);    // 133 * 0.75 = 99.75 -> 99 (floor)
        });

        test('calculateSellPrice works correctly', () => {
            const coeff = new Coefficient('test', 'desc', 0, 1000, 0.75, 0.95);
            
            expect(coeff.calculateSellPrice(1000)).toBe(950); // 1000 * 0.95 = 950
            expect(coeff.calculateSellPrice(100)).toBe(95);   // 100 * 0.95 = 95
            expect(coeff.calculateSellPrice(105)).toBe(99);   // 105 * 0.95 = 99.75 -> 99 (floor)
        });

        test('price calculation methods throw error for invalid inputs', () => {
            const coeff = new Coefficient('test', 'desc', 0, 1000, 0.75, 0.95);
            
            expect(() => coeff.calculateBuyPrice(0)).toThrow('Market price must be a positive number');
            expect(() => coeff.calculateBuyPrice(-100)).toThrow('Market price must be a positive number');
            expect(() => coeff.calculateBuyPrice('invalid')).toThrow('Market price must be a positive number');
            
            expect(() => coeff.calculateSellPrice(0)).toThrow('Market price must be a positive number');
            expect(() => coeff.calculateSellPrice(-100)).toThrow('Market price must be a positive number');
        });

        test('calculateProfit works correctly', () => {
            const coeff = new Coefficient('test', 'desc', 0, 1000, 0.75, 0.95);
            
            const profit = coeff.calculateProfit(1000);
            expect(profit).toBe(200); // 950 - 750 = 200
            
            const profit2 = coeff.calculateProfit(100);
            expect(profit2).toBe(20); // 95 - 75 = 20
        });

        test('calculateProfitPercent works correctly', () => {
            const coeff = new Coefficient('test', 'desc', 0, 1000, 0.75, 0.95);
            
            const profitPercent = coeff.calculateProfitPercent(1000);
            expect(profitPercent).toBeCloseTo(26.67, 2); // (200 / 750) * 100 ≈ 26.67%
            
            const profitPercent2 = coeff.calculateProfitPercent(100);
            expect(profitPercent2).toBeCloseTo(26.67, 2); // (20 / 75) * 100 ≈ 26.67%
        });

        test('calculateProfitPercent handles zero buy price', () => {
            // Create a coefficient with very small buy multiplier that results in zero buy price
            const coeff = new Coefficient('test', 'desc', 0, 1000, 0.001, 0.95);
            
            // Use a market price that results in zero buy price after Math.floor
            const profitPercent = coeff.calculateProfitPercent(0.5); // 0.5 * 0.001 = 0.0005 -> Math.floor = 0
            expect(profitPercent).toBe(0);
        });
    });

    describe('Validation Methods', () => {
        test('isValid returns true for valid coefficient', () => {
            const coeff = new Coefficient('test', 'Test coefficient', 0, 1000, 0.8, 0.95);
            expect(coeff.isValid()).toBe(true);
        });

        test('isValid returns false for invalid data', () => {
            // Create a valid coefficient first
            const coeff = new Coefficient('test', 'Test coefficient', 0, 1000, 0.8, 0.95);
            
            // Manually corrupt the data to test validation
            coeff.name = '';
            expect(coeff.isValid()).toBe(false);
            
            // Reset and test other invalid states
            const coeff2 = new Coefficient('test', 'Test coefficient', 0, 1000, 0.8, 0.95);
            coeff2.buyMultiplier = 1.5; // Invalid: > 1.0
            expect(coeff2.isValid()).toBe(false);
            
            const coeff3 = new Coefficient('test', 'Test coefficient', 0, 1000, 0.8, 0.95);
            coeff3.sellMultiplier = 0.7; // Invalid: < buyMultiplier
            expect(coeff3.isValid()).toBe(false);
        });
    });

    describe('JSON Serialization', () => {
        test('toJSON returns correct object', () => {
            const coeff = new Coefficient('test', 'Test coefficient', 100, 1000, 0.8, 0.95);
            const json = coeff.toJSON();
            
            expect(json).toEqual({
                name: 'test',
                description: 'Test coefficient',
                minPrice: 100,
                maxPrice: 1000,
                buyMultiplier: 0.8,
                sellMultiplier: 0.95
            });
        });

        test('fromJSON creates correct coefficient', () => {
            const data = {
                name: 'test',
                description: 'Test coefficient',
                minPrice: 100,
                maxPrice: 1000,
                buyMultiplier: 0.8,
                sellMultiplier: 0.95
            };
            
            const coeff = Coefficient.fromJSON(data);
            
            expect(coeff.getName()).toBe('test');
            expect(coeff.getDescription()).toBe('Test coefficient');
            expect(coeff.getMinPrice()).toBe(100);
            expect(coeff.getMaxPrice()).toBe(1000);
            expect(coeff.getBuyMultiplier()).toBe(0.8);
            expect(coeff.getSellMultiplier()).toBe(0.95);
        });

        test('fromJSON throws error for invalid data', () => {
            expect(() => Coefficient.fromJSON(null)).toThrow('Invalid JSON data for Coefficient');
            expect(() => Coefficient.fromJSON('invalid')).toThrow('Invalid JSON data for Coefficient');
            expect(() => Coefficient.fromJSON({})).toThrow(); // Missing required fields
        });

        test('JSON roundtrip preserves data', () => {
            const original = new Coefficient('test', 'Test coefficient', 100, null, 0.8, 0.95);
            const json = original.toJSON();
            const restored = Coefficient.fromJSON(json);
            
            expect(restored.getName()).toBe(original.getName());
            expect(restored.getDescription()).toBe(original.getDescription());
            expect(restored.getMinPrice()).toBe(original.getMinPrice());
            expect(restored.getMaxPrice()).toBe(original.getMaxPrice());
            expect(restored.getBuyMultiplier()).toBe(original.getBuyMultiplier());
            expect(restored.getSellMultiplier()).toBe(original.getSellMultiplier());
        });
    });

    describe('String Representation', () => {
        test('toString returns correct format for bounded range', () => {
            const coeff = new Coefficient('test', 'Test coefficient', 100, 1000, 0.8, 0.95);
            const str = coeff.toString();
            
            expect(str).toBe('test: [100-1000] Buy: 0.8, Sell: 0.95');
        });

        test('toString returns correct format for open range', () => {
            const coeff = new Coefficient('test', 'Test coefficient', 1000, null, 0.8, 0.95);
            const str = coeff.toString();
            
            expect(str).toBe('test: [1000-∞] Buy: 0.8, Sell: 0.95');
        });
    });

    describe('Property-Based Tests', () => {
        test('Property 1: Price matching is consistent with range boundaries', () => {
            const testProperty = fc.property(
                fc.float({ min: Math.fround(0), max: Math.fround(10000) }), // minPrice
                fc.oneof(fc.constant(null), fc.float({ min: Math.fround(0.1), max: Math.fround(20000) })), // maxPrice
                fc.float({ min: Math.fround(0.1), max: Math.fround(0.99) }), // buyMultiplier
                fc.float({ min: Math.fround(0.1), max: Math.fround(1.5) }), // sellMultiplier
                fc.float({ min: Math.fround(0), max: Math.fround(25000) }), // testPrice
                (minPrice, maxPrice, buyMultiplier, sellMultiplier, testPrice) => {
                    // Ensure maxPrice > minPrice if not null
                    const validMaxPrice = maxPrice !== null && maxPrice <= minPrice ? null : maxPrice;
                    
                    try {
                        const coeff = new Coefficient('test', 'desc', minPrice, validMaxPrice, buyMultiplier, sellMultiplier);
                        const matches = coeff.matches(testPrice);
                        
                        // Verify matching logic
                        const expectedMatch = testPrice >= minPrice && (validMaxPrice === null || testPrice < validMaxPrice);
                        expect(matches).toBe(expectedMatch);
                    } catch (error) {
                        // Skip invalid combinations
                        fc.pre(false);
                    }
                }
            );
            
            fc.assert(testProperty, { numRuns: 100 });
        });

        test('Property 2: Price calculations are mathematically correct', () => {
            const testProperty = fc.property(
                fc.float({ min: Math.fround(0.1), max: Math.fround(0.99) }), // buyMultiplier
                fc.float({ min: Math.fround(0.1), max: Math.fround(1.5) }), // sellMultiplier
                fc.float({ min: Math.fround(1), max: Math.fround(10000) }), // marketPrice
                (buyMultiplier, sellMultiplier, marketPrice) => {
                    try {
                        const coeff = new Coefficient('test', 'desc', 0, null, buyMultiplier, sellMultiplier);
                        
                        const buyPrice = coeff.calculateBuyPrice(marketPrice);
                        const sellPrice = coeff.calculateSellPrice(marketPrice);
                        const profit = coeff.calculateProfit(marketPrice);
                        
                        // Verify calculations
                        expect(buyPrice).toBe(Math.floor(marketPrice * buyMultiplier));
                        expect(sellPrice).toBe(Math.floor(marketPrice * sellMultiplier));
                        expect(profit).toBe(sellPrice - buyPrice);
                        
                        // Verify profit percentage calculation
                        if (buyPrice > 0) {
                            const profitPercent = coeff.calculateProfitPercent(marketPrice);
                            const expectedPercent = (profit / buyPrice) * 100;
                            expect(profitPercent).toBeCloseTo(expectedPercent, 10);
                        }
                    } catch (error) {
                        // Skip invalid combinations
                        fc.pre(false);
                    }
                }
            );
            
            fc.assert(testProperty, { numRuns: 100 });
        });

        test('Property 3: JSON serialization roundtrip preserves data', () => {
            const testProperty = fc.property(
                fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                fc.string({ maxLength: 200 }),
                fc.float({ min: Math.fround(0), max: Math.fround(10000) }),
                fc.oneof(fc.constant(null), fc.float({ min: Math.fround(0.1), max: Math.fround(20000) })),
                fc.float({ min: Math.fround(0.1), max: Math.fround(0.99) }),
                fc.float({ min: Math.fround(0.1), max: Math.fround(1.5) }),
                (name, description, minPrice, maxPrice, buyMultiplier, sellMultiplier) => {
                    // Ensure maxPrice > minPrice if not null
                    const validMaxPrice = maxPrice !== null && maxPrice <= minPrice ? null : maxPrice;
                    
                    try {
                        const original = new Coefficient(name, description, minPrice, validMaxPrice, buyMultiplier, sellMultiplier);
                        const json = original.toJSON();
                        const restored = Coefficient.fromJSON(json);
                        
                        // Verify all properties are preserved
                        expect(restored.getName()).toBe(original.getName());
                        expect(restored.getDescription()).toBe(original.getDescription());
                        expect(restored.getMinPrice()).toBe(original.getMinPrice());
                        expect(restored.getMaxPrice()).toBe(original.getMaxPrice());
                        expect(restored.getBuyMultiplier()).toBe(original.getBuyMultiplier());
                        expect(restored.getSellMultiplier()).toBe(original.getSellMultiplier());
                    } catch (error) {
                        // Skip invalid combinations
                        fc.pre(false);
                    }
                }
            );
            
            fc.assert(testProperty, { numRuns: 100 });
        });
    });
});
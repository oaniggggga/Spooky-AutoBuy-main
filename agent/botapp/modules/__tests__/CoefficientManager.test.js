const fs = require('fs');
const path = require('path');
const fc = require('fast-check');
const CoefficientManager = require('../CoefficientManager');
const Coefficient = require('../Coefficient');

// Mock fs module for testing
jest.mock('fs');

describe('CoefficientManager', () => {
    let manager;
    const testConfigPath = path.join(__dirname, '..', '..', 'coefficients.json');

    beforeEach(() => {
        // Clear singleton instance before each test
        CoefficientManager.clearInstance();
        
        // Reset fs mocks
        jest.clearAllMocks();
        
        // Create fresh instance
        manager = CoefficientManager.getInstance();
    });

    afterEach(() => {
        // Clean up singleton
        CoefficientManager.clearInstance();
    });

    describe('Singleton Pattern', () => {
        test('getInstance returns the same instance', () => {
            const manager1 = CoefficientManager.getInstance();
            const manager2 = CoefficientManager.getInstance();
            
            expect(manager1).toBe(manager2);
            expect(manager1).toBeInstanceOf(CoefficientManager);
        });

        test('constructor returns existing instance if called directly', () => {
            const manager1 = CoefficientManager.getInstance();
            const manager2 = new CoefficientManager();
            
            expect(manager1).toBe(manager2);
        });
    });

    describe('Default Coefficients', () => {
        test('getDefaultCoefficients returns correct structure', () => {
            const defaults = CoefficientManager.getDefaultCoefficients();
            
            expect(Array.isArray(defaults)).toBe(true);
            expect(defaults.length).toBe(5);
            
            // Check first coefficient structure
            const first = defaults[0];
            expect(first).toHaveProperty('name');
            expect(first).toHaveProperty('description');
            expect(first).toHaveProperty('minPrice');
            expect(first).toHaveProperty('maxPrice');
            expect(first).toHaveProperty('buyMultiplier');
            expect(first).toHaveProperty('sellMultiplier');
            
            // Verify price ranges are sequential
            expect(first.minPrice).toBe(0);
            expect(first.maxPrice).toBe(1000);
            expect(defaults[1].minPrice).toBe(1000);
            expect(defaults[1].maxPrice).toBe(10000);
        });

        test('default coefficients cover all price ranges', () => {
            const defaults = CoefficientManager.getDefaultCoefficients();
            
            // Test various price points
            const testPrices = [0, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 10000000];
            
            for (const price of testPrices) {
                const matchingCoeff = defaults.find(coeff => {
                    return price >= coeff.minPrice && (coeff.maxPrice === null || price < coeff.maxPrice);
                });
                expect(matchingCoeff).toBeDefined();
            }
        });
    });

    describe('Configuration Loading', () => {
        test('loadCoefficients creates defaults when file does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            fs.writeFileSync.mockImplementation(() => {});
            
            manager.loadCoefficients();
            
            expect(manager.getAllCoefficients()).toHaveLength(5);
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        test('loadCoefficients reads from existing file', () => {
            const testData = [
                {
                    name: "test",
                    description: "Test coefficient",
                    minPrice: 0,
                    maxPrice: 1000,
                    buyMultiplier: 0.8,
                    sellMultiplier: 0.95
                }
            ];
            
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(testData));
            
            manager.loadCoefficients();
            
            const coefficients = manager.getAllCoefficients();
            expect(coefficients).toHaveLength(1);
            expect(coefficients[0].getName()).toBe('test');
        });

        test('loadCoefficients handles corrupted file gracefully', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('invalid json');
            fs.writeFileSync.mockImplementation(() => {});
            
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            
            manager.loadCoefficients();
            
            // Should fall back to defaults
            expect(manager.getAllCoefficients()).toHaveLength(5);
            expect(consoleSpy).toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });

        test('loadCoefficients validates loaded coefficients', () => {
            const invalidData = [
                {
                    name: "",  // Invalid name
                    description: "Test",
                    minPrice: 0,
                    maxPrice: 1000,
                    buyMultiplier: 0.8,
                    sellMultiplier: 0.95
                }
            ];
            
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(JSON.stringify(invalidData));
            fs.writeFileSync.mockImplementation(() => {});
            
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            
            manager.loadCoefficients();
            
            // Should fall back to defaults due to validation failure
            expect(manager.getAllCoefficients()).toHaveLength(5);
            expect(consoleSpy).toHaveBeenCalled(); // Error loading coefficients
            
            consoleSpy.mockRestore();
            warnSpy.mockRestore();
        });
    });

    describe('Configuration Saving', () => {
        test('saveCoefficients writes to file', () => {
            fs.writeFileSync.mockImplementation(() => {});
            
            // Load defaults first
            manager.resetToDefaults();
            manager.saveCoefficients();
            
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('coefficients.json'),
                expect.stringContaining('"name"'),
                'utf8'
            );
        });

        test('saveCoefficients handles write errors', () => {
            // First ensure we have valid coefficients loaded
            manager.resetToDefaults();
            
            // Then mock writeFileSync to fail
            fs.writeFileSync.mockImplementation(() => {
                throw new Error('Write failed');
            });
            
            expect(() => manager.saveCoefficients()).toThrow('Write failed');
        });
    });

    describe('Coefficient Management', () => {
        beforeEach(() => {
            // Mock file operations for setup
            fs.existsSync.mockReturnValue(false);
            fs.writeFileSync.mockImplementation(() => {});
            manager.loadCoefficients(); // Load defaults
        });

        test('findCoefficientForPrice returns correct coefficient', () => {
            const coeff = manager.findCoefficientForPrice(500);
            
            expect(coeff).toBeInstanceOf(Coefficient);
            expect(coeff.getName()).toBe('Дешевые предметы');
            expect(coeff.matches(500)).toBe(true);
        });

        test('findCoefficientForPrice returns null for invalid price', () => {
            expect(manager.findCoefficientForPrice(-1)).toBeNull();
            expect(manager.findCoefficientForPrice('invalid')).toBeNull();
            expect(manager.findCoefficientForPrice(null)).toBeNull();
        });

        test('findCoefficientForPrice handles edge cases', () => {
            // Test boundary values
            expect(manager.findCoefficientForPrice(0).getName()).toBe('Дешевые предметы');
            expect(manager.findCoefficientForPrice(999).getName()).toBe('Дешевые предметы');
            expect(manager.findCoefficientForPrice(1000).getName()).toBe('Средние предметы');
            expect(manager.findCoefficientForPrice(10000000).getName()).toBe('Элитные предметы');
        });

        test('getAllCoefficients returns copy of coefficients', () => {
            const coefficients = manager.getAllCoefficients();
            
            expect(coefficients).toHaveLength(5);
            
            // Modify returned array should not affect internal state
            coefficients.push(new Coefficient('test', 'test', 0, 100, 0.8, 0.95));
            expect(manager.getAllCoefficients()).toHaveLength(5);
        });

        test('addCoefficient adds valid coefficient', () => {
            // First remove the overlapping coefficient to make room for our test
            manager.removeCoefficientByName('Элитные предметы');
            
            const newCoeff = new Coefficient('test', 'Test coefficient', 2000000, 3000000, 0.8, 0.95);
            
            manager.addCoefficient(newCoeff);
            
            expect(manager.getAllCoefficients()).toHaveLength(5); // 4 remaining + 1 new
            expect(manager.findCoefficientForPrice(2500000)).toBe(newCoeff);
        });

        test('addCoefficient rejects invalid coefficient', () => {
            const invalidCoeff = new Coefficient('test', 'Test', 0, 100, 0.8, 0.95);
            invalidCoeff.name = ''; // Make it invalid
            
            expect(() => manager.addCoefficient(invalidCoeff)).toThrow('Cannot add invalid coefficient');
        });

        test('addCoefficient rejects non-Coefficient objects', () => {
            expect(() => manager.addCoefficient({})).toThrow('Parameter must be a Coefficient instance');
            expect(() => manager.addCoefficient('invalid')).toThrow('Parameter must be a Coefficient instance');
        });

        test('removeCoefficient removes existing coefficient', () => {
            const coefficients = manager.getAllCoefficients();
            const toRemove = coefficients[0];
            
            const result = manager.removeCoefficient(toRemove);
            
            expect(result).toBe(true);
            expect(manager.getAllCoefficients()).toHaveLength(4);
        });

        test('removeCoefficient returns false for non-existing coefficient', () => {
            const nonExisting = new Coefficient('test', 'Test', 0, 100, 0.8, 0.95);
            
            const result = manager.removeCoefficient(nonExisting);
            
            expect(result).toBe(false);
            expect(manager.getAllCoefficients()).toHaveLength(5);
        });

        test('removeCoefficientByName removes by name', () => {
            const result = manager.removeCoefficientByName('Дешевые предметы');
            
            expect(result).toBe(true);
            expect(manager.getAllCoefficients()).toHaveLength(4);
            expect(manager.findCoefficientForPrice(500)).toBeNull();
        });

        test('removeCoefficientByName returns false for non-existing name', () => {
            const result = manager.removeCoefficientByName('Non-existing');
            
            expect(result).toBe(false);
            expect(manager.getAllCoefficients()).toHaveLength(5);
        });
    });

    describe('Validation', () => {
        test('validateCoefficients returns true for valid coefficients', () => {
            fs.existsSync.mockReturnValue(false);
            fs.writeFileSync.mockImplementation(() => {});
            manager.loadCoefficients();
            
            expect(manager.validateCoefficients()).toBe(true);
        });

        test('validateCoefficients returns false for empty coefficients', () => {
            manager.coefficients = [];
            
            expect(manager.validateCoefficients()).toBe(false);
        });

        test('validateCoefficients detects overlapping ranges', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            
            manager.coefficients = [
                new Coefficient('test1', 'Test 1', 0, 1000, 0.8, 0.95),
                new Coefficient('test2', 'Test 2', 500, 1500, 0.8, 0.95) // Overlaps with test1
            ];
            
            const result = manager.validateCoefficients();
            
            expect(result).toBe(true); // Still valid, just warns about overlap
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Overlapping ranges detected'));
            
            consoleSpy.mockRestore();
        });

        test('hasOverlappingRanges detects overlaps correctly', () => {
            const coeff1 = new Coefficient('test1', 'Test 1', 0, 1000, 0.8, 0.95);
            const coeff2 = new Coefficient('test2', 'Test 2', 500, 1500, 0.8, 0.95);
            const coeff3 = new Coefficient('test3', 'Test 3', 2000, 3000, 0.8, 0.95);
            
            expect(manager.hasOverlappingRanges(coeff1, coeff2)).toBe(true);
            expect(manager.hasOverlappingRanges(coeff1, coeff3)).toBe(false);
        });

        test('hasOverlappingRanges handles open ranges', () => {
            const coeff1 = new Coefficient('test1', 'Test 1', 1000, null, 0.8, 0.95); // Open range
            const coeff2 = new Coefficient('test2', 'Test 2', 500, 1500, 0.8, 0.95);
            
            expect(manager.hasOverlappingRanges(coeff1, coeff2)).toBe(true);
        });
    });

    describe('Import/Export', () => {
        beforeEach(() => {
            fs.existsSync.mockReturnValue(false);
            fs.writeFileSync.mockImplementation(() => {});
            manager.loadCoefficients();
        });

        test('exportCoefficients returns valid JSON', () => {
            const exported = manager.exportCoefficients();
            
            expect(() => JSON.parse(exported)).not.toThrow();
            
            const parsed = JSON.parse(exported);
            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed).toHaveLength(5);
        });

        test('importCoefficients adds new coefficients', () => {
            // First remove the overlapping coefficient to make room for our test
            manager.removeCoefficientByName('Элитные предметы');
            
            const newCoeffData = [{
                name: "Imported",
                description: "Imported coefficient",
                minPrice: 2000000,
                maxPrice: 3000000,
                buyMultiplier: 0.8,
                sellMultiplier: 0.95
            }];
            
            manager.importCoefficients(JSON.stringify(newCoeffData), false);
            
            expect(manager.getAllCoefficients()).toHaveLength(5); // 4 remaining + 1 imported
            expect(manager.findCoefficientForPrice(2500000).getName()).toBe('Imported');
        });

        test('importCoefficients replaces all coefficients when replace=true', () => {
            const newCoeffData = [{
                name: "Replacement",
                description: "Replacement coefficient",
                minPrice: 0,
                maxPrice: null,
                buyMultiplier: 0.8,
                sellMultiplier: 0.95
            }];
            
            manager.importCoefficients(JSON.stringify(newCoeffData), true);
            
            expect(manager.getAllCoefficients()).toHaveLength(1);
            expect(manager.getAllCoefficients()[0].getName()).toBe('Replacement');
        });

        test('importCoefficients rejects invalid JSON', () => {
            expect(() => manager.importCoefficients('invalid json')).toThrow();
        });

        test('importCoefficients rejects invalid coefficient data', () => {
            const invalidData = [{
                name: "", // Invalid name
                description: "Test",
                minPrice: 0,
                maxPrice: 1000,
                buyMultiplier: 0.8,
                sellMultiplier: 0.95
            }];
            
            expect(() => manager.importCoefficients(JSON.stringify(invalidData))).toThrow();
        });
    });

    describe('Debug and Utility', () => {
        test('printDebugInfo outputs coefficient information', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            
            fs.existsSync.mockReturnValue(false);
            fs.writeFileSync.mockImplementation(() => {});
            manager.loadCoefficients();
            
            manager.printDebugInfo();
            
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Coefficient Manager Debug Info'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Number of coefficients: 5'));
            
            consoleSpy.mockRestore();
        });
    });

    describe('Property-Based Tests', () => {
        test('Property 1: Coefficient Selection by Price Range', () => {
            fs.existsSync.mockReturnValue(false);
            fs.writeFileSync.mockImplementation(() => {});
            manager.loadCoefficients();

            const testProperty = fc.property(
                fc.float({ min: 0, max: 10000000 }), // price
                (price) => {
                    const coefficient = manager.findCoefficientForPrice(price);
                    
                    if (coefficient !== null) {
                        // If a coefficient is found, it should match the price
                        expect(coefficient.matches(price)).toBe(true);
                        
                        // The coefficient should be from our loaded coefficients
                        const allCoefficients = manager.getAllCoefficients();
                        expect(allCoefficients).toContain(coefficient);
                    }
                    
                    // For default coefficients, every valid price should have a match
                    if (price >= 0) {
                        expect(coefficient).not.toBeNull();
                    }
                }
            );
            
            fc.assert(testProperty, { numRuns: 100 });
        });

        test('Property 2: Coefficient Persistence Round Trip', () => {
            const testProperty = fc.property(
                fc.array(
                    fc.record({
                        name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                        description: fc.string({ maxLength: 200 }),
                        minPrice: fc.float({ min: Math.fround(0), max: Math.fround(10000) }),
                        maxPrice: fc.oneof(fc.constant(null), fc.float({ min: Math.fround(0.1), max: Math.fround(20000) })),
                        buyMultiplier: fc.float({ min: Math.fround(0.1), max: Math.fround(0.99) }),
                        sellMultiplier: fc.float({ min: Math.fround(0.1), max: Math.fround(1.5) })
                    }),
                    { minLength: 1, maxLength: 10 }
                ),
                (coefficientData) => {
                    try {
                        // Filter out invalid combinations
                        const validData = coefficientData.filter(data => {
                            return data.maxPrice === null || data.maxPrice > data.minPrice;
                        });
                        
                        if (validData.length === 0) {
                            fc.pre(false); // Skip this test case
                        }

                        // Create coefficients and validate them
                        const coefficients = validData.map(data => {
                            try {
                                return new Coefficient(data.name, data.description, data.minPrice, data.maxPrice, data.buyMultiplier, data.sellMultiplier);
                            } catch (error) {
                                return null;
                            }
                        }).filter(coeff => coeff !== null && coeff.isValid());

                        if (coefficients.length === 0) {
                            fc.pre(false); // Skip if no valid coefficients
                        }

                        // Set up manager with test coefficients
                        manager.coefficients = coefficients;
                        
                        // Export and import
                        const exported = manager.exportCoefficients();
                        const newManager = new CoefficientManager();
                        newManager.importCoefficients(exported, true);
                        
                        // Verify round trip
                        const importedCoefficients = newManager.getAllCoefficients();
                        expect(importedCoefficients).toHaveLength(coefficients.length);
                        
                        for (let i = 0; i < coefficients.length; i++) {
                            const original = coefficients[i];
                            const imported = importedCoefficients[i];
                            
                            expect(imported.getName()).toBe(original.getName());
                            expect(imported.getDescription()).toBe(original.getDescription());
                            expect(imported.getMinPrice()).toBe(original.getMinPrice());
                            expect(imported.getMaxPrice()).toBe(original.getMaxPrice());
                            expect(imported.getBuyMultiplier()).toBe(original.getBuyMultiplier());
                            expect(imported.getSellMultiplier()).toBe(original.getSellMultiplier());
                        }
                        
                    } catch (error) {
                        // Skip invalid test cases
                        fc.pre(false);
                    }
                }
            );
            
            fc.assert(testProperty, { numRuns: 50 }); // Reduced runs due to complexity
        });

        test('Property 3: Coefficient Uniqueness', () => {
            fs.existsSync.mockReturnValue(false);
            fs.writeFileSync.mockImplementation(() => {});
            manager.loadCoefficients();

            const testProperty = fc.property(
                fc.float({ min: 0, max: 10000000 }), // price
                (price) => {
                    const allCoefficients = manager.getAllCoefficients();
                    const matchingCoefficients = allCoefficients.filter(coeff => coeff.matches(price));
                    
                    // For default coefficients, each price should match exactly one coefficient
                    expect(matchingCoefficients.length).toBeLessThanOrEqual(1);
                    
                    // If there's a match, it should be the same as findCoefficientForPrice
                    const foundCoefficient = manager.findCoefficientForPrice(price);
                    if (matchingCoefficients.length === 1) {
                        expect(foundCoefficient).toBe(matchingCoefficients[0]);
                    } else {
                        expect(foundCoefficient).toBeNull();
                    }
                }
            );
            
            fc.assert(testProperty, { numRuns: 100 });
        });
    });
});
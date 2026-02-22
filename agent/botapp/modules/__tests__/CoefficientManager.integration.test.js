const fs = require('fs');
const path = require('path');
const CoefficientManager = require('../CoefficientManager');
const Coefficient = require('../Coefficient');

describe('CoefficientManager Integration Tests', () => {
    const testConfigPath = path.join(__dirname, '..', 'test-coefficients.json');
    let manager;

    beforeEach(() => {
        // Clear singleton instance
        CoefficientManager.clearInstance();
        
        // Clean up any existing test file
        if (fs.existsSync(testConfigPath)) {
            fs.unlinkSync(testConfigPath);
        }
        
        // Create manager with test config path
        manager = CoefficientManager.getInstance();
        manager.configPath = testConfigPath;
    });

    afterEach(() => {
        // Clean up test file
        if (fs.existsSync(testConfigPath)) {
            fs.unlinkSync(testConfigPath);
        }
        
        CoefficientManager.clearInstance();
    });

    describe('Configuration File Persistence', () => {
        test('creates default configuration file when none exists', () => {
            expect(fs.existsSync(testConfigPath)).toBe(false);
            
            manager.loadCoefficients();
            
            expect(fs.existsSync(testConfigPath)).toBe(true);
            expect(manager.getAllCoefficients()).toHaveLength(5);
        });

        test('saves and loads coefficients correctly', () => {
            // Create and save custom coefficients
            const customCoeffs = [
                new Coefficient('test1', 'Test 1', 0, 1000, 0.8, 0.95),
                new Coefficient('test2', 'Test 2', 1000, null, 0.9, 1.05)
            ];
            
            manager.coefficients = customCoeffs;
            manager.saveCoefficients();
            
            // Verify file exists and has correct content
            expect(fs.existsSync(testConfigPath)).toBe(true);
            const fileContent = fs.readFileSync(testConfigPath, 'utf8');
            const parsedData = JSON.parse(fileContent);
            
            expect(parsedData).toHaveLength(2);
            expect(parsedData[0].name).toBe('test1');
            expect(parsedData[1].name).toBe('test2');
        });

        test('loads existing configuration file correctly', () => {
            // Create test configuration file
            const testData = [
                {
                    name: "Custom coefficient",
                    description: "Custom test coefficient",
                    minPrice: 500,
                    maxPrice: 1500,
                    buyMultiplier: 0.85,
                    sellMultiplier: 1.1
                }
            ];
            
            fs.writeFileSync(testConfigPath, JSON.stringify(testData, null, 2), 'utf8');
            
            // Load coefficients
            manager.loadCoefficients();
            
            const coefficients = manager.getAllCoefficients();
            expect(coefficients).toHaveLength(1);
            expect(coefficients[0].getName()).toBe('Custom coefficient');
            expect(coefficients[0].getMinPrice()).toBe(500);
            expect(coefficients[0].getMaxPrice()).toBe(1500);
        });

        test('handles corrupted configuration file gracefully', () => {
            // Create corrupted file
            fs.writeFileSync(testConfigPath, 'invalid json content', 'utf8');
            
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            
            manager.loadCoefficients();
            
            // Should fall back to defaults
            expect(manager.getAllCoefficients()).toHaveLength(5);
            expect(consoleSpy).toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });

        test('validates loaded coefficients and falls back to defaults', () => {
            // Create file with invalid coefficient data
            const invalidData = [
                {
                    name: "", // Invalid name
                    description: "Test",
                    minPrice: 0,
                    maxPrice: 1000,
                    buyMultiplier: 0.8,
                    sellMultiplier: 0.95
                }
            ];
            
            fs.writeFileSync(testConfigPath, JSON.stringify(invalidData, null, 2), 'utf8');
            
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            
            manager.loadCoefficients();
            
            // Should fall back to defaults due to validation failure
            expect(manager.getAllCoefficients()).toHaveLength(5);
            expect(consoleSpy).toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });

        test('round-trip persistence preserves all data', () => {
            // Load defaults
            manager.loadCoefficients();
            const originalCoefficients = manager.getAllCoefficients();
            
            // Save and reload
            manager.saveCoefficients();
            
            // Create new manager instance to test loading
            CoefficientManager.clearInstance();
            const newManager = CoefficientManager.getInstance();
            newManager.configPath = testConfigPath;
            newManager.loadCoefficients();
            
            const reloadedCoefficients = newManager.getAllCoefficients();
            
            // Verify all data is preserved
            expect(reloadedCoefficients).toHaveLength(originalCoefficients.length);
            
            for (let i = 0; i < originalCoefficients.length; i++) {
                const original = originalCoefficients[i];
                const reloaded = reloadedCoefficients[i];
                
                expect(reloaded.getName()).toBe(original.getName());
                expect(reloaded.getDescription()).toBe(original.getDescription());
                expect(reloaded.getMinPrice()).toBe(original.getMinPrice());
                expect(reloaded.getMaxPrice()).toBe(original.getMaxPrice());
                expect(reloaded.getBuyMultiplier()).toBe(original.getBuyMultiplier());
                expect(reloaded.getSellMultiplier()).toBe(original.getSellMultiplier());
            }
        });

        test('automatic coefficient initialization works correctly', () => {
            // Ensure no config file exists
            expect(fs.existsSync(testConfigPath)).toBe(false);
            
            // Access coefficients should trigger automatic loading
            const coefficients = manager.getAllCoefficients();
            
            expect(coefficients).toHaveLength(5);
            expect(fs.existsSync(testConfigPath)).toBe(true);
            
            // Verify default coefficient names
            const names = coefficients.map(c => c.getName());
            expect(names).toContain('Дешевые предметы');
            expect(names).toContain('Средние предметы');
            expect(names).toContain('Дорогие предметы');
            expect(names).toContain('Очень дорогие предметы');
            expect(names).toContain('Элитные предметы');
        });

        test('coefficient finding works after persistence operations', () => {
            manager.loadCoefficients();
            
            // Test coefficient finding
            expect(manager.findCoefficientForPrice(500).getName()).toBe('Дешевые предметы');
            expect(manager.findCoefficientForPrice(5000).getName()).toBe('Средние предметы');
            expect(manager.findCoefficientForPrice(50000).getName()).toBe('Дорогие предметы');
            expect(manager.findCoefficientForPrice(500000).getName()).toBe('Очень дорогие предметы');
            expect(manager.findCoefficientForPrice(5000000).getName()).toBe('Элитные предметы');
        });
    });

    describe('Configuration Management', () => {
        test('resetToDefaults creates and saves default configuration', () => {
            // Start with empty coefficients
            manager.coefficients = [];
            
            manager.resetToDefaults();
            
            expect(manager.getAllCoefficients()).toHaveLength(5);
            expect(fs.existsSync(testConfigPath)).toBe(true);
            
            // Verify file content
            const fileContent = fs.readFileSync(testConfigPath, 'utf8');
            const parsedData = JSON.parse(fileContent);
            expect(parsedData).toHaveLength(5);
        });

        test('import/export functionality works with persistence', () => {
            manager.loadCoefficients();
            
            // Export coefficients
            const exported = manager.exportCoefficients();
            
            // Clear and import
            manager.coefficients = [];
            manager.importCoefficients(exported, true);
            
            // Save and reload to test persistence
            manager.saveCoefficients();
            
            CoefficientManager.clearInstance();
            const newManager = CoefficientManager.getInstance();
            newManager.configPath = testConfigPath;
            newManager.loadCoefficients();
            
            expect(newManager.getAllCoefficients()).toHaveLength(5);
        });
    });
});
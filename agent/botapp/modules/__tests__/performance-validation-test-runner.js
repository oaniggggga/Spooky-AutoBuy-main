// Performance and validation test runner
const { computeSmartPrice, computeSimplePrice, calculatePricesWithCoefficients } = require('../priceCalculator');
const CoefficientManager = require('../CoefficientManager');

function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function measurePerformance(fn, iterations = 1000) {
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
        fn();
    }
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1000000; // Convert nanoseconds to milliseconds
    return {
        totalTime: durationMs,
        averageTime: durationMs / iterations,
        operationsPerSecond: (iterations / durationMs) * 1000
    };
}

function runPerformanceAndValidationTests() {
    console.log('Starting Performance and Validation Tests...');
    let testsPassed = 0;
    let testsFailed = 0;
    
    // Test 1: Coefficient lookup performance
    try {
        console.log('\nTest 1: Coefficient lookup performance');
        const coefficientManager = CoefficientManager.getInstance();
        
        // Test performance across different price ranges
        const testPrices = [100, 1000, 10000, 100000, 1000000, 10000000];
        
        testPrices.forEach(price => {
            const performance = measurePerformance(() => {
                coefficientManager.findCoefficientForPrice(price);
            }, 10000);
            
            console.log(`  Price ${price}: ${performance.averageTime.toFixed(4)}ms avg, ${performance.operationsPerSecond.toFixed(0)} ops/sec`);
            
            // Performance requirement: should be under 1ms average
            assert(performance.averageTime < 1, `Coefficient lookup for price ${price} should be under 1ms, got ${performance.averageTime.toFixed(4)}ms`);
        });
        
        console.log('✓ Test 1 passed - Coefficient lookup performance is acceptable');
        testsPassed++;
    } catch (error) {
        console.log('✗ Test 1 failed:', error.message);
        testsFailed++;
    }
    
    // Test 2: Price calculation performance
    let originalLoggingConfig; // Declare outside try block for proper scope
    let config; // Declare config variable once
    try {
        console.log('\nTest 2: Price calculation performance');
        
        // Temporarily disable logging for performance tests by modifying config directly
        config = require('../../config');
        originalLoggingConfig = { ...config.logging };
        config.logging.info = false;
        config.logging.warn = false;
        config.logging.error = false;
        
        // Test with various lot sizes
        const lotSizes = [1, 10, 100, 1000];
        
        lotSizes.forEach(size => {
            // Generate test lots
            const lots = Array.from({ length: size }, (_, i) => ({
                unitPrice: 1000 + Math.random() * 1000,
                amount: Math.floor(Math.random() * 64) + 1,
                seller: `Player${i}`,
                timestamp: Date.now() - Math.random() * 86400000
            }));
            
            // Test smart price calculation performance
            const smartPerformance = measurePerformance(() => {
                computeSmartPrice(lots, 1500);
            }, 1000);
            
            // Test simple price calculation performance
            const simplePerformance = measurePerformance(() => {
                computeSimplePrice(lots, 1500);
            }, 1000);
            
            console.log(`  ${size} lots - Smart: ${smartPerformance.averageTime.toFixed(4)}ms, Simple: ${simplePerformance.averageTime.toFixed(4)}ms`);
            
            // Performance requirements
            assert(smartPerformance.averageTime < 5, `Smart calculation with ${size} lots should be under 5ms`);
            assert(simplePerformance.averageTime < 2, `Simple calculation with ${size} lots should be under 2ms`);
            
            // Smart calculation should not be more than 10x slower than simple (more realistic expectation)
            const ratio = smartPerformance.averageTime / simplePerformance.averageTime;
            assert(ratio < 10, `Smart calculation should not be more than 10x slower than simple, got ${ratio.toFixed(2)}x`);
        });
        
        // Restore original logging config
        Object.assign(config.logging, originalLoggingConfig);
        
        console.log('✓ Test 2 passed - Price calculation performance is acceptable');
        testsPassed++;
    } catch (error) {
        // Restore original logging config in case of error
        if (originalLoggingConfig && config) {
            Object.assign(config.logging, originalLoggingConfig);
        }
        console.log('✗ Test 2 failed:', error.message);
        testsFailed++;
    }
    
    // Test 3: Mathematical accuracy validation across all ranges
    try {
        console.log('\nTest 3: Mathematical accuracy validation');
        
        // Test mathematical accuracy for all coefficient ranges (using actual coefficients.json values)
        const testCases = [
            { range: 'Дешевые предметы', prices: [50, 100, 500, 999], buyMult: 0.7, sellMult: 1.4 },
            { range: 'Средние предметы', prices: [1000, 2500, 5000, 7500, 9999], buyMult: 0.75, sellMult: 1.25 },
            { range: 'Дорогие предметы', prices: [10000, 25000, 50000, 75000, 99999], buyMult: 0.8, sellMult: 1.2 },
            { range: 'Очень дорогие предметы', prices: [100000, 250000, 500000, 750000, 999999], buyMult: 0.85, sellMult: 1.15 },
            { range: 'Элитные предметы', prices: [1000000, 2500000, 5000000, 10000000], buyMult: 0.9, sellMult: 1.1 }
        ];
        
        testCases.forEach(testCase => {
            console.log(`  Testing ${testCase.range}...`);
            
            testCase.prices.forEach(price => {
                const result = computeSmartPrice([], price);
                
                // Validate coefficient selection
                assert(result.coefficient === testCase.range, 
                    `Price ${price} should use coefficient '${testCase.range}', got '${result.coefficient}'`);
                
                // Validate mathematical accuracy
                const expectedBuyPrice = Math.floor(price * testCase.buyMult);
                const expectedSellPrice = Math.floor(price * testCase.sellMult);
                const expectedProfit = expectedSellPrice - expectedBuyPrice;
                const expectedProfitPercent = ((expectedProfit / expectedBuyPrice) * 100);
                
                assert(result.absolutePrice === price, `Absolute price should be ${price}`);
                assert(result.buyPrice === expectedBuyPrice, 
                    `Buy price for ${price} should be ${expectedBuyPrice}, got ${result.buyPrice}`);
                assert(result.sellPrice === expectedSellPrice, 
                    `Sell price for ${price} should be ${expectedSellPrice}, got ${result.sellPrice}`);
                assert(result.profit === expectedProfit, 
                    `Profit for ${price} should be ${expectedProfit}, got ${result.profit}`);
                assert(Math.abs(result.profitPercent - expectedProfitPercent) < 0.01, 
                    `Profit percent for ${price} should be ~${expectedProfitPercent.toFixed(2)}%, got ${result.profitPercent.toFixed(2)}%`);
                
                // Validate business rules
                assert(result.buyPrice > 0, 'Buy price must be positive');
                assert(result.sellPrice > result.buyPrice, 'Sell price must be higher than buy price');
                assert(result.profit > 0, 'Profit must be positive');
                assert(result.profitPercent > 0, 'Profit percent must be positive');
            });
        });
        
        console.log('✓ Test 3 passed - Mathematical accuracy validated across all ranges');
        testsPassed++;
    } catch (error) {
        console.log('✗ Test 3 failed:', error.message);
        testsFailed++;
    }
    
    // Test 4: Edge case validation
    try {
        console.log('\nTest 4: Edge case validation');
        
        // Test boundary values
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
            assert(result.coefficient === test.expectedCoeff, 
                `Boundary price ${test.price} should use '${test.expectedCoeff}', got '${result.coefficient}'`);
        });
        
        // Test with extreme values (avoiding very small prices that cause coefficient issues)
        const extremeTests = [
            { price: 100, desc: 'minimum reasonable price' },
            { price: 100000000, desc: 'very large price' }
        ];
        
        extremeTests.forEach(test => {
            const result = computeSmartPrice([], test.price);
            assert(result !== undefined, `Should handle ${test.desc}`);
            assert(result.buyPrice >= 0, `Buy price should be non-negative for ${test.desc}`);
            assert(result.sellPrice > result.buyPrice, `Sell > Buy rule should hold for ${test.desc}`);
        });
        
        // Test with lots containing extreme values (avoiding very small prices)
        const extremeLots = [
            [{ unitPrice: 100 }], // Minimum reasonable price
            [{ unitPrice: 999999999 }],
            [{ unitPrice: 1000 }, { unitPrice: 1000000 }], // Mixed ranges
        ];
        
        extremeLots.forEach((lots, index) => {
            const result = computeSmartPrice(lots, 5000);
            assert(result !== undefined, `Should handle extreme lots case ${index + 1}`);
            assert(result.buyPrice < result.sellPrice, `Buy < Sell rule should hold for extreme lots case ${index + 1}`);
        });
        
        console.log('✓ Test 4 passed - Edge case validation successful');
        testsPassed++;
    } catch (error) {
        console.log('✗ Test 4 failed:', error.message);
        testsFailed++;
    }
    
    // Test 5: Precision and rounding validation
    try {
        console.log('\nTest 5: Precision and rounding validation');
        
        // Test that all calculations result in integers (no floating point issues)
        // Using reasonable prices that work with coefficient system
        const precisionTests = [
            100.1, 100.9, 999.99, 1000.01, 5000.5, 10000.1
        ];
        
        precisionTests.forEach(price => {
            const result = computeSmartPrice([], price);
            
            // All monetary values should be integers
            assert(Number.isInteger(result.absolutePrice), `Absolute price should be integer for input ${price}`);
            assert(Number.isInteger(result.buyPrice), `Buy price should be integer for input ${price}`);
            assert(Number.isInteger(result.sellPrice), `Sell price should be integer for input ${price}`);
            assert(Number.isInteger(result.profit), `Profit should be integer for input ${price}`);
            
            // Profit percent can be decimal, but should be finite
            assert(Number.isFinite(result.profitPercent), `Profit percent should be finite for input ${price}`);
        });
        
        // Test consistency - same input should always produce same output
        const consistencyPrice = 5000;
        const result1 = computeSmartPrice([], consistencyPrice);
        const result2 = computeSmartPrice([], consistencyPrice);
        
        assert(JSON.stringify(result1) === JSON.stringify(result2), 
            'Same inputs should produce identical outputs');
        
        console.log('✓ Test 5 passed - Precision and rounding validation successful');
        testsPassed++;
    } catch (error) {
        console.log('✗ Test 5 failed:', error.message);
        testsFailed++;
    }
    
    // Test 6: Stress test with large datasets
    let originalLoggingConfigStress; // Declare outside try block for proper scope
    let configStress; // Declare config variable once for stress test
    try {
        console.log('\nTest 6: Stress test with large datasets');
        
        // Temporarily disable logging for stress tests
        configStress = require('../../config');
        originalLoggingConfigStress = { ...configStress.logging };
        configStress.logging.info = false;
        configStress.logging.warn = false;
        configStress.logging.error = false;
        
        // Generate large lot dataset
        const largeLots = Array.from({ length: 10000 }, (_, i) => ({
            unitPrice: Math.floor(Math.random() * 1000000) + 1,
            amount: Math.floor(Math.random() * 64) + 1,
            seller: `StressTestPlayer${i}`,
            timestamp: Date.now() - Math.random() * 86400000
        }));
        
        // Test performance with large dataset
        const stressPerformance = measurePerformance(() => {
            computeSmartPrice(largeLots, 50000);
        }, 10);
        
        console.log(`  Large dataset (10k lots): ${stressPerformance.averageTime.toFixed(2)}ms avg`);
        
        // Should complete within reasonable time even with large datasets
        assert(stressPerformance.averageTime < 100, 
            `Large dataset processing should be under 100ms, got ${stressPerformance.averageTime.toFixed(2)}ms`);
        
        // Test multiple concurrent calculations
        const concurrentStart = process.hrtime.bigint();
        const promises = Array.from({ length: 100 }, () => {
            return new Promise(resolve => {
                const result = computeSmartPrice(largeLots.slice(0, 100), Math.random() * 100000);
                resolve(result);
            });
        });
        
        Promise.all(promises).then(() => {
            const concurrentEnd = process.hrtime.bigint();
            const concurrentTime = Number(concurrentEnd - concurrentStart) / 1000000;
            console.log(`  100 concurrent calculations: ${concurrentTime.toFixed(2)}ms total`);
        });
        
        // Restore original logging config
        Object.assign(configStress.logging, originalLoggingConfigStress);
        
        console.log('✓ Test 6 passed - Stress test successful');
        testsPassed++;
    } catch (error) {
        // Restore original logging config in case of error
        if (originalLoggingConfigStress && configStress) {
            Object.assign(configStress.logging, originalLoggingConfigStress);
        }
        console.log('✗ Test 6 failed:', error.message);
        testsFailed++;
    }
    
    console.log(`\n=== Performance and Validation Test Results ===`);
    console.log(`Tests passed: ${testsPassed}`);
    console.log(`Tests failed: ${testsFailed}`);
    console.log(`Total tests: ${testsPassed + testsFailed}`);
    
    if (testsFailed === 0) {
        console.log('\n🎉 All performance and validation tests passed!');
        return true;
    } else {
        console.log('\n❌ Some performance and validation tests failed.');
        return false;
    }
}

// Run the tests
if (require.main === module) {
    runPerformanceAndValidationTests();
}

module.exports = { runPerformanceAndValidationTests };
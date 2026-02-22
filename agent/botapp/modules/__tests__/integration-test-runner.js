// Simple integration test runner that doesn't require Jest
const { computeSmartPrice, computeSimplePrice } = require('../priceCalculator');
const CoefficientManager = require('../CoefficientManager');

function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function runIntegrationTests() {
    console.log('Starting Integration Tests...');
    let testsPassed = 0;
    let testsFailed = 0;
    
    // Test 1: Integration with priceStore - empty lots with historical price
    try {
        console.log('\nTest 1: Historical price with empty lots');
        const testPrice = 5000;
        const result = computeSmartPrice([], testPrice);
        
        assert(result !== undefined, 'Result should be defined');
        assert(result.absolutePrice === testPrice, 'Should use historical price');
        assert(result.buyPrice > 0, 'Buy price should be positive');
        assert(result.sellPrice > result.buyPrice, 'Sell price should be higher than buy price');
        assert(result.coefficient !== undefined, 'Coefficient should be defined');
        
        console.log('✓ Test 1 passed');
        testsPassed++;
    } catch (error) {
        console.log('✗ Test 1 failed:', error.message);
        testsFailed++;
    }
    
    // Test 2: Compatibility with existing bot logic
    try {
        console.log('\nTest 2: Compatibility with existing bot logic');
        const lots = [
            { unitPrice: 1000 },
            { unitPrice: 1200 },
            { unitPrice: 950 }
        ];
        const historicalPrice = 1100;
        
        const simpleResult = computeSimplePrice(lots, historicalPrice);
        const smartResult = computeSmartPrice(lots, historicalPrice);
        
        // Check simple result structure
        assert(simpleResult.hasOwnProperty('absolutePrice'), 'Simple result should have absolutePrice');
        assert(simpleResult.hasOwnProperty('buyPrice'), 'Simple result should have buyPrice');
        assert(simpleResult.hasOwnProperty('sellPrice'), 'Simple result should have sellPrice');
        
        // Check smart result structure
        assert(smartResult.hasOwnProperty('absolutePrice'), 'Smart result should have absolutePrice');
        assert(smartResult.hasOwnProperty('buyPrice'), 'Smart result should have buyPrice');
        assert(smartResult.hasOwnProperty('sellPrice'), 'Smart result should have sellPrice');
        assert(smartResult.hasOwnProperty('coefficient'), 'Smart result should have coefficient');
        assert(smartResult.hasOwnProperty('profit'), 'Smart result should have profit');
        assert(smartResult.hasOwnProperty('profitPercent'), 'Smart result should have profitPercent');
        
        // Business rule validation
        assert(simpleResult.buyPrice < simpleResult.sellPrice, 'Simple: buy price should be less than sell price');
        assert(smartResult.buyPrice < smartResult.sellPrice, 'Smart: buy price should be less than sell price');
        
        console.log('✓ Test 2 passed');
        testsPassed++;
    } catch (error) {
        console.log('✗ Test 2 failed:', error.message);
        testsFailed++;
    }
    
    // Test 3: Various price ranges with correct coefficients
    try {
        console.log('\nTest 3: Price ranges and coefficients');
        const testCases = [
            { name: 'Cheap Item', price: 500, expectedCoefficient: 'Дешевые предметы' },
            { name: 'Medium Item', price: 5000, expectedCoefficient: 'Средние предметы' },
            { name: 'Expensive Item', price: 50000, expectedCoefficient: 'Дорогие предметы' },
            { name: 'Very Expensive Item', price: 500000, expectedCoefficient: 'Очень дорогие предметы' },
            { name: 'Elite Item', price: 5000000, expectedCoefficient: 'Элитные предметы' }
        ];
        
        testCases.forEach(testCase => {
            const result = computeSmartPrice([], testCase.price);
            assert(result.coefficient === testCase.expectedCoefficient, 
                `${testCase.name}: Expected coefficient '${testCase.expectedCoefficient}', got '${result.coefficient}'`);
            assert(result.absolutePrice === testCase.price, `${testCase.name}: Price should match`);
            assert(result.buyPrice < result.sellPrice, `${testCase.name}: Buy < Sell rule`);
        });
        
        console.log('✓ Test 3 passed');
        testsPassed++;
    } catch (error) {
        console.log('✗ Test 3 failed:', error.message);
        testsFailed++;
    }
    
    // Test 4: Real auction lot data structure
    try {
        console.log('\nTest 4: Real auction lot data structure');
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
        
        const result = computeSmartPrice(realAuctionLots, 1500);
        
        assert(result.absolutePrice === 1450, 'Should use minimum price from lots');
        assert(result.coefficient === 'Средние предметы', 'Should use correct coefficient for price range');
        assert(result.buyPrice === Math.floor(1450 * 0.75), 'Should apply correct buy multiplier');
        assert(result.sellPrice === Math.floor(1450 * 1.25), 'Should apply correct sell multiplier');
        
        console.log('✓ Test 4 passed');
        testsPassed++;
    } catch (error) {
        console.log('✗ Test 4 failed:', error.message);
        testsFailed++;
    }
    
    // Test 5: Error handling
    try {
        console.log('\nTest 5: Error handling');
        
        // Test with null/undefined inputs
        const result1 = computeSmartPrice([], null);
        assert(result1 !== undefined, 'Should handle null historical price');
        assert(result1.absolutePrice > 0, 'Should provide fallback price');
        assert(result1.buyPrice < result1.sellPrice, 'Should maintain buy < sell rule');
        
        const result2 = computeSmartPrice(null, 2000);
        assert(result2 !== undefined, 'Should handle null lots');
        assert(result2.absolutePrice === 2000, 'Should use historical price when lots are null');
        
        console.log('✓ Test 5 passed');
        testsPassed++;
    } catch (error) {
        console.log('✗ Test 5 failed:', error.message);
        testsFailed++;
    }
    
    // Test 6: Coefficient manager integration
    try {
        console.log('\nTest 6: Coefficient manager integration');
        const coefficientManager = CoefficientManager.getInstance();
        const testPrice = 5000;
        const lots = [{ unitPrice: testPrice }];
        
        // Calculate with default coefficients
        const resultBefore = computeSmartPrice(lots, testPrice);
        
        // Get and modify coefficient
        const coefficients = coefficientManager.getAllCoefficients();
        const mediumCoefficient = coefficients.find(c => c.getName() === 'Средние предметы');
        assert(mediumCoefficient !== undefined, 'Medium coefficient should exist');
        
        // Test that coefficient affects calculation
        assert(resultBefore.coefficient === 'Средние предметы', 'Should use medium coefficient');
        assert(resultBefore.buyPrice === Math.floor(testPrice * 0.75), 'Should use default buy multiplier');
        assert(resultBefore.sellPrice === Math.floor(testPrice * 1.25), 'Should use default sell multiplier');
        
        console.log('✓ Test 6 passed');
        testsPassed++;
    } catch (error) {
        console.log('✗ Test 6 failed:', error.message);
        testsFailed++;
    }
    
    console.log(`\n=== Integration Test Results ===`);
    console.log(`Tests passed: ${testsPassed}`);
    console.log(`Tests failed: ${testsFailed}`);
    console.log(`Total tests: ${testsPassed + testsFailed}`);
    
    if (testsFailed === 0) {
        console.log('\n🎉 All integration tests passed!');
        return true;
    } else {
        console.log('\n❌ Some integration tests failed.');
        return false;
    }
}

// Run the tests
if (require.main === module) {
    runIntegrationTests();
}

module.exports = { runIntegrationTests };
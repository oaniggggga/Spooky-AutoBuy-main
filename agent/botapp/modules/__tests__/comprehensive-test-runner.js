// Comprehensive test runner for Smart Price Calculator
// Combines integration tests and performance validation tests

const { runIntegrationTests } = require('./integration-test-runner');
const { runPerformanceAndValidationTests } = require('./performance-validation-test-runner');

function runComprehensiveTests() {
    console.log('=== Smart Price Calculator - Comprehensive Test Suite ===\n');
    
    let allTestsPassed = true;
    
    // Run integration tests
    console.log('Phase 1: Integration Testing');
    console.log('==========================');
    const integrationPassed = runIntegrationTests();
    
    console.log('\n');
    
    // Run performance and validation tests
    console.log('Phase 2: Performance and Validation Testing');
    console.log('==========================================');
    const performancePassed = runPerformanceAndValidationTests();
    
    console.log('\n');
    
    // Final summary
    console.log('=== COMPREHENSIVE TEST RESULTS ===');
    console.log(`Integration Tests: ${integrationPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Performance Tests: ${performancePassed ? '✅ PASSED' : '❌ FAILED'}`);
    
    allTestsPassed = integrationPassed && performancePassed;
    
    if (allTestsPassed) {
        console.log('\n🎉 ALL TESTS PASSED! Smart Price Calculator is ready for production.');
        console.log('\nKey Features Validated:');
        console.log('• ✅ Integration with existing systems (priceStore.js, bot logic)');
        console.log('• ✅ Coefficient-based price calculations across all ranges');
        console.log('• ✅ Mathematical accuracy and business rule validation');
        console.log('• ✅ Performance optimization and stress testing');
        console.log('• ✅ Error handling and edge case management');
        console.log('• ✅ Precision and rounding consistency');
    } else {
        console.log('\n❌ SOME TESTS FAILED. Please review the output above for details.');
    }
    
    return allTestsPassed;
}

// Run the comprehensive tests
if (require.main === module) {
    const success = runComprehensiveTests();
    process.exit(success ? 0 : 1);
}

module.exports = { runComprehensiveTests };
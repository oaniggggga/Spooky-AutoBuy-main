// Jest setup file
// Configure fast-check for property-based testing
const fc = require('fast-check');

// Set default number of runs for property tests to minimum 100 as per requirements
fc.configureGlobal({
  numRuns: 100,
  verbose: false
});

// Make fast-check available globally
global.fc = fc;
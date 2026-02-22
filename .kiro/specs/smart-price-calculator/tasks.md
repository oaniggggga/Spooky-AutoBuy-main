# Implementation Plan: Smart Price Calculator

## Overview

Реализация улучшенной системы автоматического расчета цен с динамическими коэффициентами в зависимости от ценового диапазона. План включает создание классов Coefficient и CoefficientManager, обновление PriceCalculator и обеспечение обратной совместимости с существующим API.

## Tasks

- [x] 1. Create core Coefficient class and data structures
  - Create Coefficient class with price range matching and calculation methods
  - Implement mathematical calculations for buy/sell prices and profit margins
  - Add validation methods for coefficient data integrity
  - _Requirements: 2.4, 2.5, 2.6, 2.7_

- [x]* 1.1 Write property test for Coefficient mathematical calculations
  - **Property 2: Mathematical Calculation Correctness**
  - **Validates: Requirements 2.4, 2.5, 2.6, 2.7**

- [x]* 1.2 Write unit tests for Coefficient edge cases
  - Test boundary conditions for price ranges
  - Test invalid multiplier values
  - _Requirements: 2.4, 2.5, 2.6, 2.7_

- [x] 2. Implement CoefficientManager with persistence
  - [x] 2.1 Create CoefficientManager singleton class
    - Implement coefficient storage and retrieval
    - Add methods for finding coefficients by price
    - _Requirements: 2.1, 2.3_

  - [x]* 2.2 Write property test for coefficient selection
    - **Property 1: Coefficient Selection by Price Range**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

  - [x] 2.3 Implement configuration file persistence
    - Add JSON save/load functionality for coefficients
    - Create default coefficient initialization
    - _Requirements: 3.1, 2.1, 2.2_

  - [x]* 2.4 Write property test for persistence round trip
    - **Property 3: Coefficient Persistence Round Trip**
    - **Validates: Requirements 3.1, 3.5**

- [x] 3. Add error handling and validation
  - [x] 3.1 Implement coefficient validation logic
    - Validate coefficient ranges and multipliers
    - Add overlap detection for price ranges
    - _Requirements: 3.2, 5.4_

  - [ ]* 3.2 Write property test for coefficient validation
    - **Property 9: Coefficient Validation**
    - **Validates: Requirements 3.2**

  - [x] 3.3 Add error recovery mechanisms
    - Implement fallback to default coefficients
    - Add graceful handling of corrupted config files
    - _Requirements: 3.3, 5.3_

  - [ ]* 3.4 Write unit tests for error scenarios
    - Test missing config file handling
    - Test corrupted data recovery
    - _Requirements: 3.3, 5.3_

- [x] 4. Checkpoint - Ensure coefficient system works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update PriceCalculator with smart logic
  - [x] 5.1 Create enhanced computeSmartPrice function
    - Integrate CoefficientManager for price calculations
    - Maintain backward compatibility with existing API
    - _Requirements: 4.1, 4.4_

  - [ ]* 5.2 Write property test for input processing
    - **Property 4: Input Processing Consistency**
    - **Validates: Requirements 4.2, 4.4**

  - [x] 5.3 Add fallback logic for edge cases
    - Handle empty lots arrays and invalid prices
    - Implement historical price fallback mechanism
    - _Requirements: 4.3, 5.1_

  - [ ]* 5.4 Write property test for business rule invariant
    - **Property 5: Business Rule Invariant**
    - **Validates: Requirements 5.4**

- [x] 6. Ensure API compatibility and integration
  - [x] 6.1 Update priceCalculator.js exports
    - Replace computeSimplePrice with computeSmartPrice
    - Ensure return format compatibility
    - _Requirements: 4.1_

  - [ ]* 6.2 Write property test for API compatibility
    - **Property 10: API Compatibility**
    - **Validates: Requirements 4.1**

  - [x] 6.3 Add enhanced error handling
    - Implement safe fallback values for all error conditions
    - Add logging for debugging and monitoring
    - _Requirements: 5.2, 5.5_

  - [ ]* 6.4 Write property test for error recovery
    - **Property 7: Error Recovery Consistency**
    - **Validates: Requirements 5.2**

- [x] 7. Add advanced features and optimizations
  - [x] 7.1 Implement coefficient caching and updates
    - Add in-memory caching for loaded coefficients
    - Ensure immediate cache updates on configuration changes
    - _Requirements: 6.1, 6.3_

  - [ ]* 7.2 Write property test for cache consistency
    - **Property 8: Cache Consistency**
    - **Validates: Requirements 6.3**

  - [x] 7.3 Add coefficient management utilities
    - Implement add/remove/modify coefficient methods
    - Add export/import functionality for coefficient sets
    - _Requirements: 3.4, 3.5_

  - [ ]* 7.4 Write unit tests for coefficient management
    - Test add/remove operations
    - Test export/import functionality
    - _Requirements: 3.4, 3.5_

- [x] 8. Integration testing and validation
  - [x] 8.1 Create integration tests with existing systems
    - Test integration with priceStore.js
    - Verify compatibility with existing bot logic
    - _Requirements: 4.1, 4.4_

  - [ ]* 8.2 Write property test for coefficient uniqueness
    - **Property 6: Coefficient Uniqueness**
    - **Validates: Requirements 2.3**

  - [x] 8.3 Add performance and validation tests
    - Test coefficient lookup performance
    - Validate mathematical accuracy across all ranges
    - _Requirements: 6.2, 2.4, 2.5, 2.6, 2.7_

- [x] 9. Final checkpoint - Comprehensive system validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check library
- Unit tests validate specific examples and edge cases
- Integration tests ensure compatibility with existing codebase
- The system maintains backward compatibility while providing enhanced functionality
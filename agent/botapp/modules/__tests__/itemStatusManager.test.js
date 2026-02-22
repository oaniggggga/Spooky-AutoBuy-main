const fs = require('fs');
const path = require('path');
const os = require('os');
const fc = require('fast-check');
const ItemStatusManager = require('../itemStatusManager');

describe('ItemStatusManager Property Tests', () => {
  let tempDir;
  let tempFilePath;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'itemstatus-test-'));
    tempFilePath = path.join(tempDir, 'test-status.json');
  });

  afterEach(() => {
    // Clean up temporary files
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      fs.rmdirSync(tempDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Feature: item-management-ui, Property 3: Status Toggle Persistence
   * Validates: Requirements 2.1, 2.2, 2.3, 2.5
   */
  test('Property 3: Status Toggle Persistence - For any item status change, toggling the purchase status should persist the change and be reflected in subsequent system behavior', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary item IDs (non-empty strings that are not whitespace-only)
        fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 20 }),
        // Generate arbitrary boolean status values
        fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
        (itemIds, statuses) => {
          // Create a new ItemStatusManager instance for this test
          const manager = new ItemStatusManager(tempFilePath);
          
          // Apply status changes
          const expectedStatuses = new Map();
          for (let i = 0; i < Math.min(itemIds.length, statuses.length); i++) {
            const itemId = itemIds[i];
            const status = statuses[i];
            
            manager.setItemStatus(itemId, status);
            expectedStatuses.set(itemId, status);
          }
          
          // Verify persistence by creating a new manager instance
          const newManager = new ItemStatusManager(tempFilePath);
          
          // Check that all statuses are persisted correctly
          for (const [itemId, expectedStatus] of expectedStatuses) {
            const actualStatus = newManager.isItemEnabled(itemId);
            
            // The status should match exactly what was set
            if (expectedStatus === false) {
              // If we explicitly set false, it should be false
              expect(actualStatus).toBe(false);
            } else {
              // If we set true, it should be true
              expect(actualStatus).toBe(true);
            }
          }
          
          // Verify that the file exists and contains the correct data
          expect(fs.existsSync(tempFilePath)).toBe(true);
          
          const fileContent = JSON.parse(fs.readFileSync(tempFilePath, 'utf8'));
          for (const [itemId, expectedStatus] of expectedStatuses) {
            expect(fileContent[itemId]).toBe(expectedStatus);
          }
          
          // Verify getAllStatuses returns the correct data
          const allStatuses = newManager.getAllStatuses();
          for (const [itemId, expectedStatus] of expectedStatuses) {
            expect(allStatuses.get(itemId)).toBe(expectedStatus);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 3 Extension: Status changes should be immediately reflected in the same instance', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.boolean(),
        fc.boolean(),
        (itemId, initialStatus, newStatus) => {
          const manager = new ItemStatusManager(tempFilePath);
          
          // Set initial status
          manager.setItemStatus(itemId, initialStatus);
          expect(manager.isItemEnabled(itemId)).toBe(initialStatus);
          
          // Change status
          manager.setItemStatus(itemId, newStatus);
          expect(manager.isItemEnabled(itemId)).toBe(newStatus);
          
          // Verify the change is reflected in getAllStatuses
          const allStatuses = manager.getAllStatuses();
          expect(allStatuses.get(itemId)).toBe(newStatus);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 3 Extension: Default behavior for unknown items should be consistent', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 10 }),
        (unknownItemIds) => {
          const manager = new ItemStatusManager(tempFilePath);
          
          // All unknown items should default to enabled (true)
          for (const itemId of unknownItemIds) {
            expect(manager.isItemEnabled(itemId)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 3 Extension: File system persistence should survive multiple save/load cycles', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            itemId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            status: fc.boolean()
          }),
          { minLength: 1, maxLength: 15 }
        ),
        (statusUpdates) => {
          // Remove duplicates by itemId (keep last occurrence)
          const uniqueUpdates = new Map();
          statusUpdates.forEach(update => {
            uniqueUpdates.set(update.itemId, update.status);
          });
          
          // Apply all status changes
          const manager1 = new ItemStatusManager(tempFilePath);
          for (const [itemId, status] of uniqueUpdates) {
            manager1.setItemStatus(itemId, status);
          }
          
          // Create multiple new instances to test persistence
          for (let cycle = 0; cycle < 3; cycle++) {
            const managerN = new ItemStatusManager(tempFilePath);
            
            // Verify all statuses are still correct
            for (const [itemId, expectedStatus] of uniqueUpdates) {
              expect(managerN.isItemEnabled(itemId)).toBe(expectedStatus);
            }
            
            // Make a small change and save
            if (uniqueUpdates.size > 0) {
              const firstItem = uniqueUpdates.keys().next().value;
              const currentStatus = uniqueUpdates.get(firstItem);
              const newStatus = !currentStatus;
              managerN.setItemStatus(firstItem, newStatus);
              uniqueUpdates.set(firstItem, newStatus);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('ItemStatusManager Unit Tests', () => {
  let tempDir;
  let tempFilePath;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'itemstatus-unit-test-'));
    tempFilePath = path.join(tempDir, 'test-status.json');
  });

  afterEach(() => {
    // Clean up temporary files
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      fs.rmdirSync(tempDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Loading and Saving Statuses', () => {
    test('should create empty file when status file does not exist', () => {
      const manager = new ItemStatusManager(tempFilePath);
      
      expect(fs.existsSync(tempFilePath)).toBe(true);
      expect(manager.getStatusCount()).toBe(0);
      
      const fileContent = JSON.parse(fs.readFileSync(tempFilePath, 'utf8'));
      expect(fileContent).toEqual({});
    });

    test('should load existing statuses from file', () => {
      // Create a test file with some statuses
      const testStatuses = {
        'netherite_helmet': true,
        'diamond_sword': false,
        'iron_ingot': true
      };
      fs.writeFileSync(tempFilePath, JSON.stringify(testStatuses, null, 2));

      const manager = new ItemStatusManager(tempFilePath);
      
      expect(manager.getStatusCount()).toBe(3);
      expect(manager.isItemEnabled('netherite_helmet')).toBe(true);
      expect(manager.isItemEnabled('diamond_sword')).toBe(false);
      expect(manager.isItemEnabled('iron_ingot')).toBe(true);
    });

    test('should handle corrupted JSON file gracefully', () => {
      // Create a corrupted JSON file
      fs.writeFileSync(tempFilePath, '{ invalid json content');

      const manager = new ItemStatusManager(tempFilePath);
      
      expect(manager.getStatusCount()).toBe(0);
      expect(manager.isItemEnabled('any_item')).toBe(true); // Default behavior
    });

    test('should save statuses to file correctly', () => {
      const manager = new ItemStatusManager(tempFilePath);
      
      manager.setItemStatus('test_item_1', true);
      manager.setItemStatus('test_item_2', false);
      
      // Read file directly to verify content
      const fileContent = JSON.parse(fs.readFileSync(tempFilePath, 'utf8'));
      expect(fileContent).toEqual({
        'test_item_1': true,
        'test_item_2': false
      });
    });

    test('should create directory if it does not exist', () => {
      const nestedPath = path.join(tempDir, 'nested', 'deep', 'status.json');
      const manager = new ItemStatusManager(nestedPath);
      
      manager.setItemStatus('test_item', true);
      
      expect(fs.existsSync(nestedPath)).toBe(true);
      expect(fs.existsSync(path.dirname(nestedPath))).toBe(true);
    });
  });

  describe('Input Data Validation', () => {
    let manager;

    beforeEach(() => {
      manager = new ItemStatusManager(tempFilePath);
    });

    test('should throw error for empty itemId', () => {
      expect(() => {
        manager.setItemStatus('', true);
      }).toThrow('itemId должен быть непустой строкой');
    });

    test('should throw error for whitespace-only itemId', () => {
      expect(() => {
        manager.setItemStatus('   ', false);
      }).toThrow('itemId должен быть непустой строкой');
    });

    test('should throw error for non-string itemId', () => {
      expect(() => {
        manager.setItemStatus(123, true);
      }).toThrow('itemId должен быть непустой строкой');

      expect(() => {
        manager.setItemStatus(null, true);
      }).toThrow('itemId должен быть непустой строкой');

      expect(() => {
        manager.setItemStatus(undefined, true);
      }).toThrow('itemId должен быть непустой строкой');
    });

    test('should throw error for non-boolean enabled parameter', () => {
      expect(() => {
        manager.setItemStatus('valid_item', 'true');
      }).toThrow('enabled должен быть boolean');

      expect(() => {
        manager.setItemStatus('valid_item', 1);
      }).toThrow('enabled должен быть boolean');

      expect(() => {
        manager.setItemStatus('valid_item', null);
      }).toThrow('enabled должен быть boolean');
    });

    test('should accept valid itemId and boolean values', () => {
      expect(() => {
        manager.setItemStatus('valid_item', true);
        manager.setItemStatus('another_item', false);
      }).not.toThrow();
    });

    test('should handle invalid itemId in isItemEnabled gracefully', () => {
      expect(manager.isItemEnabled('')).toBe(true);
      expect(manager.isItemEnabled('   ')).toBe(true);
      expect(manager.isItemEnabled(null)).toBe(true);
      expect(manager.isItemEnabled(undefined)).toBe(true);
    });
  });

  describe('Status Management Operations', () => {
    let manager;

    beforeEach(() => {
      manager = new ItemStatusManager(tempFilePath);
    });

    test('should return true for unknown items (default behavior)', () => {
      expect(manager.isItemEnabled('unknown_item')).toBe(true);
    });

    test('should return correct status for known items', () => {
      manager.setItemStatus('enabled_item', true);
      manager.setItemStatus('disabled_item', false);
      
      expect(manager.isItemEnabled('enabled_item')).toBe(true);
      expect(manager.isItemEnabled('disabled_item')).toBe(false);
    });

    test('should update existing item status', () => {
      manager.setItemStatus('test_item', true);
      expect(manager.isItemEnabled('test_item')).toBe(true);
      
      manager.setItemStatus('test_item', false);
      expect(manager.isItemEnabled('test_item')).toBe(false);
    });

    test('should return all statuses correctly', () => {
      manager.setItemStatus('item1', true);
      manager.setItemStatus('item2', false);
      
      const allStatuses = manager.getAllStatuses();
      expect(allStatuses.get('item1')).toBe(true);
      expect(allStatuses.get('item2')).toBe(false);
      expect(allStatuses.size).toBe(2);
    });

    test('should remove item status correctly', () => {
      manager.setItemStatus('test_item', false);
      expect(manager.isItemEnabled('test_item')).toBe(false);
      
      manager.removeItemStatus('test_item');
      expect(manager.isItemEnabled('test_item')).toBe(true); // Default behavior
      expect(manager.getStatusCount()).toBe(0);
    });

    test('should clear all statuses', () => {
      manager.setItemStatus('item1', true);
      manager.setItemStatus('item2', false);
      expect(manager.getStatusCount()).toBe(2);
      
      manager.clearAllStatuses();
      expect(manager.getStatusCount()).toBe(0);
      expect(manager.isItemEnabled('item1')).toBe(true); // Default behavior
    });

    test('should handle removing non-existent item status', () => {
      expect(() => {
        manager.removeItemStatus('non_existent_item');
      }).not.toThrow();
      
      expect(manager.getStatusCount()).toBe(0);
    });
  });

  describe('File System Error Handling', () => {
    test('should throw error when save fails due to invalid path', () => {
      // Create a path that will cause write failure (invalid characters on Windows)
      const invalidPath = path.join(tempDir, 'invalid<>path.json');
      const manager = new ItemStatusManager(invalidPath);
      
      expect(() => {
        manager.setItemStatus('test_item', true);
      }).toThrow();
    });
  });
});
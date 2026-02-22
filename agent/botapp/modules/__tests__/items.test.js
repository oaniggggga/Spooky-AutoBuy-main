const fc = require('fast-check');
const items = require('../items');
const ItemStatusManager = require('../itemStatusManager');

// Mock the logging module
jest.mock('../logging', () => ({
    logInfo: jest.fn()
}));

describe('Items Module', () => {
    let originalTargetItems;
    
    beforeEach(() => {
        // Store original items to restore later
        originalTargetItems = [...items.targetItems];
        
        // Clear any existing status manager state
        const statusManager = items.getStatusManager();
        if (statusManager && statusManager.clearAll) {
            statusManager.clearAll();
        }
    });
    
    afterEach(() => {
        // Restore original items
        items.targetItems.length = 0;
        items.targetItems.push(...originalTargetItems);
    });

    describe('Property 9: API Response Structure', () => {
        test('getItemsWithStatus returns items with all required fields', () => {
            const testProperty = fc.property(
                fc.array(
                    fc.record({
                        id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                        name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                        displayName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                        searchKeyword: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
                        absoluteMinUnitPrice: fc.oneof(fc.constant(null), fc.float({ min: 0, max: 1000000 })),
                        previousAbsoluteMinUnitPrice: fc.oneof(fc.constant(null), fc.float({ min: 0, max: 1000000 })),
                        buyPrice: fc.oneof(fc.constant(null), fc.float({ min: 0, max: 1000000 })),
                        sellPrice: fc.oneof(fc.constant(null), fc.float({ min: 0, max: 1000000 })),
                        lastUpdated: fc.oneof(fc.constant(null), fc.date())
                    }),
                    { minLength: 1, maxLength: 10 }
                ),
                fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
                (testItems, enabledStatuses) => {
                    // Setup: Replace targetItems with test data
                    items.targetItems.length = 0;
                    items.targetItems.push(...testItems);
                    
                    // Setup: Set random enabled statuses for items
                    const statusManager = items.getStatusManager();
                    testItems.forEach((item, index) => {
                        const enabled = enabledStatuses[index % enabledStatuses.length];
                        statusManager.setItemStatus(item.id, enabled);
                    });
                    
                    // Act: Get items with status
                    const result = items.getItemsWithStatus();
                    
                    // Assert: Result should have same length as input
                    expect(result).toHaveLength(testItems.length);
                    
                    // Assert: Each item should have all required fields
                    result.forEach((item, index) => {
                        const originalItem = testItems[index];
                        const expectedEnabled = enabledStatuses[index % enabledStatuses.length];
                        
                        // Required fields from original item
                        expect(item).toHaveProperty('id', originalItem.id);
                        expect(item).toHaveProperty('name', originalItem.name);
                        expect(item).toHaveProperty('displayName', originalItem.displayName);
                        expect(item).toHaveProperty('searchKeyword', originalItem.searchKeyword);
                        
                        // Price fields (can be null)
                        expect(item).toHaveProperty('absoluteMinUnitPrice');
                        expect(item).toHaveProperty('previousAbsoluteMinUnitPrice');
                        expect(item).toHaveProperty('buyPrice');
                        expect(item).toHaveProperty('sellPrice');
                        expect(item).toHaveProperty('lastUpdated');
                        
                        // Status field (added by getItemsWithStatus)
                        expect(item).toHaveProperty('enabled');
                        expect(typeof item.enabled).toBe('boolean');
                        expect(item.enabled).toBe(expectedEnabled);
                        
                        // Verify price fields are correct type when not null
                        if (item.absoluteMinUnitPrice !== null) {
                            expect(typeof item.absoluteMinUnitPrice).toBe('number');
                        }
                        if (item.buyPrice !== null) {
                            expect(typeof item.buyPrice).toBe('number');
                        }
                        if (item.sellPrice !== null) {
                            expect(typeof item.sellPrice).toBe('number');
                        }
                    });
                }
            );
            
            fc.assert(testProperty, { numRuns: 100 });
        });
    });

    describe('shouldPurchaseItem function', () => {
        test('returns correct purchase status based on ItemStatusManager', () => {
            const testProperty = fc.property(
                fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                fc.boolean(),
                (itemId, enabled) => {
                    // Setup: Create a test item
                    const testItem = {
                        id: itemId,
                        name: 'test_item',
                        displayName: 'Test Item',
                        searchKeyword: 'test'
                    };
                    
                    // Setup: Set the item status
                    const statusManager = items.getStatusManager();
                    statusManager.setItemStatus(itemId, enabled);
                    
                    // Act: Check if item should be purchased
                    const result = items.shouldPurchaseItem(testItem);
                    
                    // Assert: Result should match the enabled status
                    expect(result).toBe(enabled);
                }
            );
            
            fc.assert(testProperty, { numRuns: 100 });
        });
    });

    describe('setItemPurchaseStatus function', () => {
        test('updates item status and triggers logging', () => {
            const testProperty = fc.property(
                fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                fc.boolean(),
                fc.boolean(),
                (itemId, initialStatus, newStatus) => {
                    // Setup: Create a test item in targetItems
                    const testItem = {
                        id: itemId,
                        name: 'test_item',
                        displayName: 'Test Item',
                        searchKeyword: 'test'
                    };
                    
                    items.targetItems.length = 0;
                    items.targetItems.push(testItem);
                    
                    // Setup: Set initial status
                    const statusManager = items.getStatusManager();
                    statusManager.setItemStatus(itemId, initialStatus);
                    
                    // Clear any previous logging calls
                    const { logInfo } = require('../logging');
                    logInfo.mockClear();
                    
                    // Act: Change the status
                    items.setItemPurchaseStatus(itemId, newStatus);
                    
                    // Assert: Status should be updated
                    expect(statusManager.isItemEnabled(itemId)).toBe(newStatus);
                    
                    // Assert: Logging should be called
                    expect(logInfo).toHaveBeenCalledWith(
                        expect.stringContaining(`Item status changed: Test Item (${itemId}) from ${initialStatus ? 'enabled' : 'disabled'} to ${newStatus ? 'enabled' : 'disabled'}`),
                        'audit'
                    );
                }
            );
            
            fc.assert(testProperty, { numRuns: 100 });
        });
    });

    describe('Unit Tests', () => {
        test('getItemsWithStatus returns empty array for empty targetItems', () => {
            items.targetItems.length = 0;
            const result = items.getItemsWithStatus();
            expect(result).toEqual([]);
        });

        test('getItemsWithStatus preserves all original item properties', () => {
            const testItem = {
                id: 'test_1',
                name: 'diamond',
                displayName: 'Diamond',
                searchKeyword: 'diamond',
                absoluteMinUnitPrice: 100,
                buyPrice: 150,
                sellPrice: 120,
                lastUpdated: new Date('2024-01-01'),
                customProperty: 'custom_value'
            };
            
            items.targetItems.length = 0;
            items.targetItems.push(testItem);
            
            const statusManager = items.getStatusManager();
            statusManager.setItemStatus('test_1', true);
            
            const result = items.getItemsWithStatus();
            
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                ...testItem,
                enabled: true
            });
        });

        test('shouldPurchaseItem returns false for unknown items', () => {
            const unknownItem = { id: 'unknown_item' };
            const result = items.shouldPurchaseItem(unknownItem);
            expect(result).toBe(false); // Default status is disabled
        });

        test('setItemPurchaseStatus handles items not in targetItems', () => {
            const { logInfo } = require('../logging');
            logInfo.mockClear();
            
            items.setItemPurchaseStatus('unknown_item', true);
            
            expect(logInfo).toHaveBeenCalledWith(
                expect.stringContaining('Item status changed: unknown_item (unknown_item)'),
                'audit'
            );
        });

        test('getStatusManager returns ItemStatusManager instance', () => {
            const statusManager = items.getStatusManager();
            expect(statusManager).toBeInstanceOf(ItemStatusManager);
        });
    });
});
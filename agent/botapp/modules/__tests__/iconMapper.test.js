const fs = require('fs');
const path = require('path');
const fc = require('fast-check');
const {
    hasMinecraftIcon,
    getMinecraftIconPath,
    getDefaultIconPath,
    getAllIconMappings,
    addIconMapping,
    removeIconMapping,
    ICONS_DIRECTORY,
    DEFAULT_ICON
} = require('../iconMapper');

describe('Icon Mapping System Property Tests', () => {

    /**
     * Feature: item-management-ui, Property 7: Icon Mapping Consistency
     * Validates: Requirements 1.5, 6.2, 6.3
     */
    test('Property 7: Icon Mapping Consistency - For any item with a standard Minecraft name, the system should display the corresponding icon, and fallback to default icon for unknown items', () => {
        fc.assert(
            fc.property(
                // Generate a mix of known and unknown item names
                fc.array(
                    fc.oneof(
                        // Known Minecraft item names (from our mapping)
                        fc.constantFrom(
                            'netherite_sword',
                            'splash_potion', 
                            'diamond'
                        ),
                        // Unknown/random item names
                        fc.string({ minLength: 1, maxLength: 30 }).filter(s => 
                            !['netherite_sword', 'splash_potion', 'diamond'].includes(s)
                        )
                    ),
                    { minLength: 1, maxLength: 10 }
                ),
                (itemNames) => {
                    const allMappings = getAllIconMappings();
                    
                    for (const itemName of itemNames) {
                        const hasIcon = hasMinecraftIcon(itemName);
                        const iconPath = getMinecraftIconPath(itemName);
                        
                        if (allMappings[itemName]) {
                            // For known items with mappings
                            if (fs.existsSync(path.join(ICONS_DIRECTORY, allMappings[itemName]))) {
                                // If the mapped file exists, hasIcon should be true
                                expect(hasIcon).toBe(true);
                                expect(iconPath).toBeTruthy();
                                expect(iconPath).toContain(allMappings[itemName]);
                            } else {
                                // If the mapped file doesn't exist, hasIcon should be false
                                expect(hasIcon).toBe(false);
                                expect(iconPath).toBeNull();
                            }
                        } else {
                            // For unknown items without mappings
                            expect(hasIcon).toBe(false);
                            expect(iconPath).toBeNull();
                        }
                    }
                    
                    // Test default icon path is always available
                    const defaultPath = getDefaultIconPath();
                    expect(defaultPath).toBeTruthy();
                    expect(defaultPath).toContain(DEFAULT_ICON);
                }
            ),
            { numRuns: 50 }
        );
    });

    test('Property 7 Extension: Invalid input handling', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.constant(null),
                    fc.constant(undefined),
                    fc.constant(''),
                    fc.integer(),
                    fc.array(fc.string()),
                    fc.object()
                ),
                (invalidInput) => {
                    // Invalid inputs should always return false/null consistently
                    expect(hasMinecraftIcon(invalidInput)).toBe(false);
                    expect(getMinecraftIconPath(invalidInput)).toBeNull();
                }
            ),
            { numRuns: 50 }
        );
    });

    test('Property 7 Extension: Default icon path consistency', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 10 }),
                (iterations) => {
                    // Default icon path should always be the same
                    const paths = [];
                    for (let i = 0; i < iterations; i++) {
                        paths.push(getDefaultIconPath());
                    }
                    
                    // All paths should be identical
                    const uniquePaths = [...new Set(paths)];
                    expect(uniquePaths.length).toBe(1);
                    
                    // Path should contain the default icon filename
                    expect(paths[0]).toContain(DEFAULT_ICON);
                    expect(paths[0]).toContain(ICONS_DIRECTORY);
                }
            ),
            { numRuns: 50 }
        );
    });

    test('Property 7 Extension: Mapping retrieval immutability', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.string({ minLength: 1, maxLength: 30 }),
                (key, value) => {
                    // Get mappings
                    const mappings1 = getAllIconMappings();
                    const mappings2 = getAllIconMappings();
                    
                    // They should be equal but not the same object
                    expect(mappings1).toEqual(mappings2);
                    expect(mappings1).not.toBe(mappings2);
                    
                    // Modifying one shouldn't affect the other
                    mappings1[key] = value;
                    expect(mappings2[key]).toBeUndefined();
                    
                    // Getting a new copy shouldn't have the modification
                    const mappings3 = getAllIconMappings();
                    expect(mappings3[key]).toBeUndefined();
                }
            ),
            { numRuns: 50 }
        );
    });
});
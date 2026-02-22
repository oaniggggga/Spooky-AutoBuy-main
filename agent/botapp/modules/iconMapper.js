const fs = require('fs');
const path = require('path');

/**
 * Mapping of Minecraft item names to their icon file names
 * This maps the 'name' field from targetItems to actual icon files
 */
const MINECRAFT_ICON_MAPPING = {
    // Weapons and Tools (we have netherite_sword icon)
    'netherite_sword': 'netherite_sword.png',
    'netherite_pickaxe': 'netherite_sword.png', // Use sword icon as fallback for tools
    'golden_pickaxe': 'netherite_sword.png',   // Use sword icon as fallback for tools
    'trident': 'netherite_sword.png',          // Use sword icon as fallback for weapons
    
    // Armor (use sword icon as fallback since we don't have armor icons)
    'netherite_helmet': 'netherite_sword.png',
    'netherite_chestplate': 'netherite_sword.png',
    'netherite_leggings': 'netherite_sword.png',
    'netherite_boots': 'netherite_sword.png',
    
    // Potions (we have splash_potion icon)
    'splash_potion': 'splash_potion.png',
    'experience_bottle': 'splash_potion.png', // Use potion icon for experience bottles
    
    // Items (use diamond icon for valuable items, unknown for others)
    'iron_nugget': 'diamond.png',              // Use diamond for valuable items
    'dried_kelp': 'unknown_item.png',
    'ender_eye': 'diamond.png',                // Use diamond for valuable items
    'sugar': 'unknown_item.png',
    'soul_lantern': 'unknown_item.png',
    'netherite_scrap': 'diamond.png',          // Use diamond for valuable items
    'enchanted_golden_apple': 'diamond.png',   // Use diamond for valuable items
    'diamond': 'diamond.png',
    'totem_of_undying': 'diamond.png',         // Use diamond for valuable items
    'player_head': 'unknown_item.png',
    
    // Default fallback items
    'no': 'barrier.png' // Special case for the 'no' item
};

/**
 * Directory where Minecraft icons are stored
 * This should be relative to the project root
 */
const ICONS_DIRECTORY = path.join(__dirname, '..', '..', '..', 'assets', 'minecraft-icons');

/**
 * Default icon file name for unknown items
 */
const DEFAULT_ICON = 'unknown_item.png';

/**
 * Checks if a Minecraft icon exists for the given item name
 * @param {string} itemName - The Minecraft item name (e.g., 'netherite_sword')
 * @returns {boolean} - True if an icon mapping exists and the file exists
 */
function hasMinecraftIcon(itemName) {
    if (!itemName || typeof itemName !== 'string') {
        return false;
    }
    
    // Check if we have a mapping for this item
    const iconFileName = MINECRAFT_ICON_MAPPING[itemName];
    if (!iconFileName) {
        return false;
    }
    
    // Check if the actual icon file exists
    const iconPath = path.join(ICONS_DIRECTORY, iconFileName);
    try {
        return fs.existsSync(iconPath);
    } catch (error) {
        return false;
    }
}

/**
 * Gets the full path to the icon file for a given item name
 * @param {string} itemName - The Minecraft item name
 * @returns {string|null} - Full path to the icon file, or null if not found
 */
function getMinecraftIconPath(itemName) {
    if (!itemName || typeof itemName !== 'string') {
        return null;
    }
    
    const iconFileName = MINECRAFT_ICON_MAPPING[itemName];
    if (!iconFileName) {
        return null;
    }
    
    const iconPath = path.join(ICONS_DIRECTORY, iconFileName);
    
    // Verify the file exists before returning the path
    try {
        if (fs.existsSync(iconPath)) {
            return iconPath;
        }
    } catch (error) {
        // File system error, return null
    }
    
    return null;
}

/**
 * Gets the full path to the default icon file
 * @returns {string} - Full path to the default icon file
 */
function getDefaultIconPath() {
    return path.join(ICONS_DIRECTORY, DEFAULT_ICON);
}

/**
 * Gets all available icon mappings
 * @returns {Object} - Copy of the icon mapping object
 */
function getAllIconMappings() {
    return { ...MINECRAFT_ICON_MAPPING };
}

/**
 * Adds or updates an icon mapping
 * @param {string} itemName - The Minecraft item name
 * @param {string} iconFileName - The icon file name (e.g., 'item.png')
 * @returns {boolean} - True if mapping was added successfully
 */
function addIconMapping(itemName, iconFileName) {
    if (!itemName || !iconFileName || typeof itemName !== 'string' || typeof iconFileName !== 'string') {
        return false;
    }
    
    MINECRAFT_ICON_MAPPING[itemName] = iconFileName;
    return true;
}

/**
 * Removes an icon mapping
 * @param {string} itemName - The Minecraft item name to remove
 * @returns {boolean} - True if mapping was removed
 */
function removeIconMapping(itemName) {
    if (!itemName || typeof itemName !== 'string') {
        return false;
    }
    
    if (itemName in MINECRAFT_ICON_MAPPING) {
        delete MINECRAFT_ICON_MAPPING[itemName];
        return true;
    }
    
    return false;
}

module.exports = {
    hasMinecraftIcon,
    getMinecraftIconPath,
    getDefaultIconPath,
    getAllIconMappings,
    addIconMapping,
    removeIconMapping,
    ICONS_DIRECTORY,
    DEFAULT_ICON
};
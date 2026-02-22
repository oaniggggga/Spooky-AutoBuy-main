const fs = require('fs');
const path = require('path');
const Coefficient = require('./Coefficient');

/**
 * CoefficientManager - Singleton class for managing price coefficients
 * Handles loading, saving, and finding coefficients for price calculations
 */
class CoefficientManager {
    constructor() {
        if (CoefficientManager.instance) {
            return CoefficientManager.instance;
        }

        this.coefficients = [];
        this.configPath = path.join(__dirname, '..', 'coefficients.json');
        this.loaded = false;
        
        // Enhanced caching system
        this.cache = {
            priceToCoefficient: new Map(), // Cache for price -> coefficient lookups
            lastModified: null,            // Track file modification time
            cacheHits: 0,                  // Performance metrics
            cacheMisses: 0,
            enabled: true                  // Allow disabling cache for testing
        };

        CoefficientManager.instance = this;
    }

    /**
     * Gets the singleton instance of CoefficientManager
     * @returns {CoefficientManager} The singleton instance
     */
    static getInstance() {
        if (!CoefficientManager.instance) {
            CoefficientManager.instance = new CoefficientManager();
        }
        return CoefficientManager.instance;
    }

    /**
     * Gets the default coefficient configuration
     * @returns {Array} Array of default coefficient objects
     */
    static getDefaultCoefficients() {
        return [
            {
                name: "Дешевые предметы",
                description: "Предметы до 1000 монет - высокий процент прибыли",
                minPrice: 0,
                maxPrice: 1000,
                buyMultiplier: 0.70,
                sellMultiplier: 1.40
            },
            {
                name: "Средние предметы",
                description: "Предметы 1000-10000 монет - умеренная прибыль",
                minPrice: 1000,
                maxPrice: 10000,
                buyMultiplier: 0.75,
                sellMultiplier: 1.25
            },
            {
                name: "Дорогие предметы",
                description: "Предметы 10000-100000 монет - стабильная прибыль",
                minPrice: 10000,
                maxPrice: 100000,
                buyMultiplier: 0.80,
                sellMultiplier: 1.20
            },
            {
                name: "Очень дорогие предметы",
                description: "Предметы 100000-1000000 монет - консервативная торговля",
                minPrice: 100000,
                maxPrice: 1000000,
                buyMultiplier: 0.85,
                sellMultiplier: 1.15
            },
            {
                name: "Элитные предметы",
                description: "Предметы свыше 1000000 монет - минимальный риск",
                minPrice: 1000000,
                maxPrice: null,
                buyMultiplier: 0.90,
                sellMultiplier: 1.10
            }
        ];
    }

    /**
     * Loads coefficients from configuration file
     * Creates default configuration if file doesn't exist
     */
    loadCoefficients() {
        try {
            // Check if we need to reload due to file changes
            if (this.loaded && !this.isConfigurationModified()) {
                console.log('Configuration unchanged, using cached coefficients');
                return;
            }

            // Clear cache when reloading
            this.clearCache();

            if (fs.existsSync(this.configPath)) {
                console.log(`Loading coefficients from: ${this.configPath}`);
                const data = fs.readFileSync(this.configPath, 'utf8');
                
                // Update last modified timestamp
                this.updateLastModified();
                
                // Handle empty or whitespace-only files
                if (!data || data.trim() === '') {
                    console.warn('Configuration file is empty, creating default coefficients');
                    this.resetToDefaults();
                    this.loaded = true;
                    return;
                }

                let coefficientData;
                try {
                    coefficientData = JSON.parse(data);
                } catch (parseError) {
                    console.error('Configuration file contains invalid JSON:', parseError.message);
                    console.log('Backing up corrupted file and creating defaults');
                    this.backupCorruptedConfig();
                    this.resetToDefaults();
                    this.loaded = true;
                    return;
                }
                
                if (!Array.isArray(coefficientData)) {
                    console.error('Configuration file must contain an array of coefficients');
                    console.log('Backing up invalid file and creating defaults');
                    this.backupCorruptedConfig();
                    this.resetToDefaults();
                    this.loaded = true;
                    return;
                }

                // Attempt to load coefficients with error recovery
                const loadedCoefficients = [];
                const loadErrors = [];

                for (let i = 0; i < coefficientData.length; i++) {
                    try {
                        const coeff = Coefficient.fromJSON(coefficientData[i]);
                        if (coeff.isValid()) {
                            loadedCoefficients.push(coeff);
                        } else {
                            const errors = coeff.getValidationErrors();
                            loadErrors.push(`Coefficient ${i}: ${errors.join(', ')}`);
                        }
                    } catch (coeffError) {
                        loadErrors.push(`Coefficient ${i}: ${coeffError.message}`);
                    }
                }

                // Check if we have any valid coefficients
                if (loadedCoefficients.length === 0) {
                    console.error('No valid coefficients found in configuration file');
                    console.log('Load errors:', loadErrors);
                    console.log('Backing up invalid file and creating defaults');
                    this.backupCorruptedConfig();
                    this.resetToDefaults();
                } else {
                    this.coefficients = loadedCoefficients;
                    
                    if (loadErrors.length > 0) {
                        console.warn(`Loaded ${loadedCoefficients.length} valid coefficients, skipped ${loadErrors.length} invalid ones`);
                        console.warn('Load errors:', loadErrors);
                        
                        // Save the cleaned configuration
                        try {
                            this.saveCoefficients();
                            console.log('Saved cleaned configuration file');
                        } catch (saveError) {
                            console.error('Failed to save cleaned configuration:', saveError.message);
                        }
                    }

                    // Final validation check
                    if (!this.validateCoefficients()) {
                        console.warn('Loaded coefficients failed validation, falling back to defaults');
                        this.backupCorruptedConfig();
                        this.resetToDefaults();
                    } else {
                        console.log(`Successfully loaded ${this.coefficients.length} coefficients from configuration`);
                    }
                }
            } else {
                console.log('Configuration file not found, creating default coefficients');
                this.resetToDefaults();
            }
        } catch (error) {
            console.error('Unexpected error loading coefficients:', error.message);
            console.log('Attempting to recover with default coefficients');
            
            try {
                this.resetToDefaults();
            } catch (resetError) {
                console.error('Failed to reset to defaults:', resetError.message);
                // Last resort: create minimal working configuration
                this.createEmergencyDefaults();
            }
        }
        
        this.loaded = true;
    }

    /**
     * Saves current coefficients to configuration file
     */
    saveCoefficients() {
        try {
            // Validate coefficients before saving
            if (!this.validateCoefficients()) {
                throw new Error('Cannot save invalid coefficients');
            }

            const data = this.coefficients.map(coeff => coeff.toJSON());
            
            // Create backup of existing file if it exists
            if (fs.existsSync(this.configPath)) {
                const backupPath = this.configPath + '.backup';
                try {
                    fs.copyFileSync(this.configPath, backupPath);
                } catch (backupError) {
                    console.warn('Failed to create backup:', backupError.message);
                }
            }

            // Write new configuration
            fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2), 'utf8');
            
            // Update last modified timestamp and clear cache
            this.updateLastModified();
            this.clearCache();
            
            console.log(`Saved ${this.coefficients.length} coefficients to configuration`);
        } catch (error) {
            console.error('Error saving coefficients:', error.message);
            throw error;
        }
    }

    /**
     * Resets coefficients to default values and saves them
     */
    resetToDefaults() {
        try {
            const defaultData = CoefficientManager.getDefaultCoefficients();
            this.coefficients = defaultData.map(data => Coefficient.fromJSON(data));
            
            // Clear cache immediately when coefficients change
            this.clearCache();
            
            this.saveCoefficients();
            console.log('Reset to default coefficients');
        } catch (error) {
            console.error('Error resetting to defaults:', error.message);
            // If we can't save, at least load the defaults in memory
            try {
                const defaultData = CoefficientManager.getDefaultCoefficients();
                this.coefficients = defaultData.map(data => Coefficient.fromJSON(data));
                this.clearCache();
                console.log('Loaded default coefficients in memory (could not save to file)');
            } catch (memoryError) {
                console.error('Failed to load defaults in memory:', memoryError.message);
                this.createEmergencyDefaults();
            }
        }
    }

    /**
     * Creates emergency fallback coefficients when all else fails
     */
    createEmergencyDefaults() {
        console.log('Creating emergency fallback coefficients');
        try {
            // Create a single, safe coefficient that covers all prices
            this.coefficients = [
                new Coefficient(
                    'Emergency Fallback',
                    'Emergency coefficient when configuration fails',
                    0,
                    null,
                    0.75, // Safe buy multiplier
                    0.95  // Safe sell multiplier (minimal profit)
                )
            ];
            console.log('Emergency coefficients created successfully');
        } catch (error) {
            console.error('Failed to create emergency coefficients:', error.message);
            // Absolute last resort - empty array (will cause findCoefficientForPrice to return null)
            this.coefficients = [];
        }
    }

    /**
     * Backs up a corrupted configuration file
     */
    backupCorruptedConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupPath = this.configPath + `.corrupted.${timestamp}`;
                fs.copyFileSync(this.configPath, backupPath);
                console.log(`Backed up corrupted configuration to: ${backupPath}`);
            }
        } catch (error) {
            console.error('Failed to backup corrupted configuration:', error.message);
        }
    }

    /**
     * Attempts to recover from a corrupted configuration by trying backup files
     * @returns {boolean} True if recovery was successful
     */
    recoverFromBackup() {
        try {
            const backupPath = this.configPath + '.backup';
            if (fs.existsSync(backupPath)) {
                console.log('Attempting to recover from backup file');
                const data = fs.readFileSync(backupPath, 'utf8');
                const coefficientData = JSON.parse(data);
                
                if (Array.isArray(coefficientData)) {
                    const recoveredCoefficients = coefficientData.map(data => Coefficient.fromJSON(data));
                    
                    // Validate recovered coefficients
                    const tempManager = new CoefficientManager();
                    tempManager.coefficients = recoveredCoefficients;
                    
                    if (tempManager.validateCoefficients()) {
                        this.coefficients = recoveredCoefficients;
                        this.saveCoefficients(); // Save the recovered configuration
                        console.log('Successfully recovered from backup');
                        return true;
                    }
                }
            }
        } catch (error) {
            console.error('Failed to recover from backup:', error.message);
        }
        
        return false;
    }

    /**
     * Finds the appropriate coefficient for a given price
     * @param {number} price - The price to find coefficient for
     * @returns {Coefficient|null} The matching coefficient or null if none found
     */
    findCoefficientForPrice(price) {
        if (!this.loaded) {
            this.loadCoefficients();
        }

        if (typeof price !== 'number' || price < 0) {
            console.warn(`Invalid price provided: ${price}`);
            return null;
        }

        // Check cache first if enabled
        if (this.cache.enabled && this.cache.priceToCoefficient.has(price)) {
            this.cache.cacheHits++;
            return this.cache.priceToCoefficient.get(price);
        }

        // If no coefficients are loaded, try to recover
        if (this.coefficients.length === 0) {
            console.warn('No coefficients available, attempting recovery');
            
            if (this.recoverFromBackup()) {
                console.log('Recovery successful, retrying coefficient search');
            } else {
                console.warn('Recovery failed, creating emergency defaults');
                this.createEmergencyDefaults();
            }
        }

        // Find the first coefficient that matches the price
        let foundCoefficient = null;
        for (const coefficient of this.coefficients) {
            try {
                if (coefficient.matches(price)) {
                    foundCoefficient = coefficient;
                    break;
                }
            } catch (error) {
                console.error(`Error checking coefficient match for ${coefficient.getName()}:`, error.message);
                continue; // Skip this coefficient and try the next one
            }
        }

        // Cache the result if caching is enabled
        if (this.cache.enabled) {
            this.cache.priceToCoefficient.set(price, foundCoefficient);
            this.cache.cacheMisses++;
        }

        // If no coefficient matches, log a warning but don't fail
        if (foundCoefficient === null) {
            console.warn(`No coefficient found for price: ${price}`);
        }

        return foundCoefficient;
    }

    /**
     * Gets all loaded coefficients
     * @returns {Array<Coefficient>} Array of all coefficients
     */
    getAllCoefficients() {
        if (!this.loaded) {
            this.loadCoefficients();
        }
        return [...this.coefficients]; // Return a copy to prevent external modification
    }

    /**
     * Adds a new coefficient to the collection
     * @param {Coefficient} coefficient - The coefficient to add
     */
    addCoefficient(coefficient) {
        if (!(coefficient instanceof Coefficient)) {
            throw new Error('Parameter must be a Coefficient instance');
        }

        if (!coefficient.isValid()) {
            const errors = coefficient.getValidationErrors();
            throw new Error(`Cannot add invalid coefficient: ${errors.join(', ')}`);
        }

        // Check for overlapping ranges with existing coefficients
        const overlaps = [];
        for (const existingCoeff of this.coefficients) {
            if (this.hasOverlappingRanges(coefficient, existingCoeff)) {
                overlaps.push(existingCoeff.getName());
            }
        }

        if (overlaps.length > 0) {
            console.warn(`Adding coefficient "${coefficient.getName()}" will create overlaps with: ${overlaps.join(', ')}`);
        }

        this.coefficients.push(coefficient);
        
        // Clear cache immediately when coefficients change
        this.clearCache();
        
        console.log(`Added coefficient: ${coefficient.getName()}`);

        // Attempt to save the updated configuration
        try {
            this.saveCoefficients();
        } catch (saveError) {
            console.error('Failed to save after adding coefficient:', saveError.message);
            console.warn('Coefficient added to memory but not persisted to file');
        }
    }

    /**
     * Removes a coefficient from the collection
     * @param {Coefficient} coefficient - The coefficient to remove
     * @returns {boolean} True if coefficient was found and removed
     */
    removeCoefficient(coefficient) {
        const index = this.coefficients.indexOf(coefficient);
        if (index !== -1) {
            const removed = this.coefficients.splice(index, 1)[0];
            
            // Clear cache immediately when coefficients change
            this.clearCache();
            
            console.log(`Removed coefficient: ${removed.getName()}`);
            
            // Attempt to save the updated configuration
            try {
                this.saveCoefficients();
            } catch (saveError) {
                console.error('Failed to save after removing coefficient:', saveError.message);
                console.warn('Coefficient removed from memory but change not persisted to file');
            }
            
            return true;
        }
        return false;
    }

    /**
     * Modifies an existing coefficient by name
     * @param {string} name - The name of the coefficient to modify
     * @param {Object} updates - Object containing the fields to update
     * @returns {boolean} True if coefficient was found and modified
     */
    modifyCoefficient(name, updates) {
        const coefficient = this.coefficients.find(coeff => coeff.getName() === name);
        if (!coefficient) {
            console.warn(`Coefficient "${name}" not found for modification`);
            return false;
        }

        try {
            // Create a new coefficient with the updates
            const currentData = coefficient.toJSON();
            const updatedData = { ...currentData, ...updates };
            const newCoefficient = Coefficient.fromJSON(updatedData);

            if (!newCoefficient.isValid()) {
                const errors = newCoefficient.getValidationErrors();
                throw new Error(`Modified coefficient would be invalid: ${errors.join(', ')}`);
            }

            // Check for overlapping ranges with other coefficients
            const overlaps = [];
            for (const existingCoeff of this.coefficients) {
                if (existingCoeff !== coefficient && this.hasOverlappingRanges(newCoefficient, existingCoeff)) {
                    overlaps.push(existingCoeff.getName());
                }
            }

            if (overlaps.length > 0) {
                console.warn(`Modifying coefficient "${name}" will create overlaps with: ${overlaps.join(', ')}`);
            }

            // Replace the old coefficient with the new one
            const index = this.coefficients.indexOf(coefficient);
            this.coefficients[index] = newCoefficient;

            // Clear cache immediately when coefficients change
            this.clearCache();

            console.log(`Modified coefficient: ${name}`);

            // Attempt to save the updated configuration
            try {
                this.saveCoefficients();
            } catch (saveError) {
                console.error('Failed to save after modifying coefficient:', saveError.message);
                console.warn('Coefficient modified in memory but not persisted to file');
            }

            return true;
        } catch (error) {
            console.error(`Error modifying coefficient "${name}":`, error.message);
            return false;
        }
    }

    /**
     * Finds a coefficient by name
     * @param {string} name - The name of the coefficient to find
     * @returns {Coefficient|null} The coefficient or null if not found
     */
    findCoefficientByName(name) {
        if (!this.loaded) {
            this.loadCoefficients();
        }
        
        return this.coefficients.find(coeff => coeff.getName() === name) || null;
    }

    /**
     * Gets coefficients that match a specific price range
     * @param {number} minPrice - Minimum price to search for
     * @param {number} maxPrice - Maximum price to search for (null for open range)
     * @returns {Array<Coefficient>} Array of matching coefficients
     */
    getCoefficientsByPriceRange(minPrice, maxPrice = null) {
        if (!this.loaded) {
            this.loadCoefficients();
        }

        return this.coefficients.filter(coeff => {
            const coeffMin = coeff.getMinPrice();
            const coeffMax = coeff.getMaxPrice();
            
            // Check if ranges overlap
            const actualMaxPrice = maxPrice === null ? Infinity : maxPrice;
            const actualCoeffMax = coeffMax === null ? Infinity : coeffMax;
            
            return coeffMin < actualMaxPrice && minPrice < actualCoeffMax;
        });
    }

    /**
     * Sorts coefficients by minimum price
     * @param {boolean} ascending - If true, sort ascending; if false, sort descending
     */
    sortCoefficientsByPrice(ascending = true) {
        if (!this.loaded) {
            this.loadCoefficients();
        }

        this.coefficients.sort((a, b) => {
            const comparison = a.getMinPrice() - b.getMinPrice();
            return ascending ? comparison : -comparison;
        });

        // Clear cache when order changes
        this.clearCache();

        console.log(`Sorted coefficients by price (${ascending ? 'ascending' : 'descending'})`);

        // Save the new order
        try {
            this.saveCoefficients();
        } catch (saveError) {
            console.error('Failed to save after sorting coefficients:', saveError.message);
            console.warn('Coefficients sorted in memory but not persisted to file');
        }
    }

    /**
     * Duplicates a coefficient with a new name
     * @param {string} sourceName - Name of the coefficient to duplicate
     * @param {string} newName - Name for the new coefficient
     * @param {Object} modifications - Optional modifications to apply to the duplicate
     * @returns {boolean} True if duplication was successful
     */
    duplicateCoefficient(sourceName, newName, modifications = {}) {
        const sourceCoeff = this.findCoefficientByName(sourceName);
        if (!sourceCoeff) {
            console.warn(`Source coefficient "${sourceName}" not found for duplication`);
            return false;
        }

        try {
            const sourceData = sourceCoeff.toJSON();
            const newData = { ...sourceData, name: newName, ...modifications };
            const newCoefficient = Coefficient.fromJSON(newData);

            if (!newCoefficient.isValid()) {
                const errors = newCoefficient.getValidationErrors();
                throw new Error(`Duplicated coefficient would be invalid: ${errors.join(', ')}`);
            }

            this.addCoefficient(newCoefficient);
            console.log(`Duplicated coefficient "${sourceName}" as "${newName}"`);
            return true;
        } catch (error) {
            console.error(`Error duplicating coefficient "${sourceName}":`, error.message);
            return false;
        }
    }

    /**
     * Removes a coefficient by name
     * @param {string} name - The name of the coefficient to remove
     * @returns {boolean} True if coefficient was found and removed
     */
    removeCoefficientByName(name) {
        const index = this.coefficients.findIndex(coeff => coeff.getName() === name);
        if (index !== -1) {
            const removed = this.coefficients.splice(index, 1)[0];
            
            // Clear cache immediately when coefficients change
            this.clearCache();
            
            console.log(`Removed coefficient: ${removed.getName()}`);
            
            // Attempt to save the updated configuration
            try {
                this.saveCoefficients();
            } catch (saveError) {
                console.error('Failed to save after removing coefficient:', saveError.message);
                console.warn('Coefficient removed from memory but change not persisted to file');
            }
            
            return true;
        }
        return false;
    }

    /**
     * Validates all loaded coefficients
     * @returns {boolean} True if all coefficients are valid
     */
    validateCoefficients() {
        if (!Array.isArray(this.coefficients) || this.coefficients.length === 0) {
            console.error('Coefficient validation failed: No coefficients loaded or invalid array');
            return false;
        }

        let isValid = true;
        const validationErrors = [];

        // Check if all coefficients are valid instances and have valid data
        for (let i = 0; i < this.coefficients.length; i++) {
            const coefficient = this.coefficients[i];
            
            if (!(coefficient instanceof Coefficient)) {
                validationErrors.push(`Coefficient at index ${i} is not a valid Coefficient instance`);
                isValid = false;
                continue;
            }

            if (!coefficient.isValid()) {
                validationErrors.push(`Coefficient "${coefficient.getName()}" at index ${i} has invalid data`);
                isValid = false;
                continue;
            }

            // Additional business rule validations
            const buyMultiplier = coefficient.getBuyMultiplier();
            const sellMultiplier = coefficient.getSellMultiplier();

            // Validate multiplier ranges
            if (buyMultiplier < 0.1 || buyMultiplier > 1.0) {
                validationErrors.push(`Coefficient "${coefficient.getName()}" has invalid buy multiplier: ${buyMultiplier} (must be between 0.1 and 1.0)`);
                isValid = false;
            }

            if (sellMultiplier < 0.5 || sellMultiplier > 10.0) {
                validationErrors.push(`Coefficient "${coefficient.getName()}" has invalid sell multiplier: ${sellMultiplier} (must be between 0.5 and 10.0)`);
                isValid = false;
            }

            // Ensure sell multiplier is greater than buy multiplier for profit
            if (sellMultiplier <= buyMultiplier) {
                validationErrors.push(`Coefficient "${coefficient.getName()}" has sell multiplier (${sellMultiplier}) not greater than buy multiplier (${buyMultiplier})`);
                isValid = false;
            }

            // Validate price ranges
            const minPrice = coefficient.getMinPrice();
            const maxPrice = coefficient.getMaxPrice();

            if (minPrice < 0) {
                validationErrors.push(`Coefficient "${coefficient.getName()}" has negative minimum price: ${minPrice}`);
                isValid = false;
            }

            if (maxPrice !== null && maxPrice > 1000000000) { // 1 billion coin limit
                validationErrors.push(`Coefficient "${coefficient.getName()}" has maximum price too high: ${maxPrice} (limit: 1,000,000,000)`);
                isValid = false;
            }
        }

        // Check for overlapping ranges
        const overlaps = this.detectOverlappingRanges();
        if (overlaps.length > 0) {
            overlaps.forEach(overlap => {
                validationErrors.push(`Overlapping price ranges detected: "${overlap.coeff1}" and "${overlap.coeff2}"`);
            });
            // Overlaps are warnings, not errors - don't set isValid to false
            console.warn('Overlapping ranges detected but validation will continue');
        }

        // Check for gaps in coverage
        const gaps = this.detectCoverageGaps();
        if (gaps.length > 0) {
            gaps.forEach(gap => {
                validationErrors.push(`Price range gap detected: ${gap.start} to ${gap.end}`);
            });
            console.warn('Price range gaps detected but validation will continue');
        }

        // Log all validation errors
        if (validationErrors.length > 0) {
            console.error('Coefficient validation errors:');
            validationErrors.forEach(error => console.error(`  - ${error}`));
        }

        return isValid;
    }

    /**
     * Detects overlapping price ranges between coefficients
     * @returns {Array} Array of overlap objects with coefficient names
     */
    detectOverlappingRanges() {
        const overlaps = [];
        
        for (let i = 0; i < this.coefficients.length; i++) {
            for (let j = i + 1; j < this.coefficients.length; j++) {
                if (this.hasOverlappingRanges(this.coefficients[i], this.coefficients[j])) {
                    overlaps.push({
                        coeff1: this.coefficients[i].getName(),
                        coeff2: this.coefficients[j].getName(),
                        range1: `[${this.coefficients[i].getMinPrice()}-${this.coefficients[i].getMaxPrice() || '∞'}]`,
                        range2: `[${this.coefficients[j].getMinPrice()}-${this.coefficients[j].getMaxPrice() || '∞'}]`
                    });
                }
            }
        }
        
        return overlaps;
    }

    /**
     * Detects gaps in price range coverage
     * @returns {Array} Array of gap objects with start and end prices
     */
    detectCoverageGaps() {
        if (this.coefficients.length === 0) {
            return [];
        }

        // Sort coefficients by minPrice
        const sortedCoeffs = [...this.coefficients].sort((a, b) => a.getMinPrice() - b.getMinPrice());
        const gaps = [];

        // Check if there's a gap before the first coefficient
        if (sortedCoeffs[0].getMinPrice() > 0) {
            gaps.push({
                start: 0,
                end: sortedCoeffs[0].getMinPrice() - 1
            });
        }

        // Check for gaps between coefficients
        for (let i = 0; i < sortedCoeffs.length - 1; i++) {
            const currentMax = sortedCoeffs[i].getMaxPrice();
            const nextMin = sortedCoeffs[i + 1].getMinPrice();

            // Skip if current coefficient has open range (null maxPrice)
            if (currentMax === null) {
                continue;
            }

            // Check if there's a gap
            if (currentMax < nextMin) {
                gaps.push({
                    start: currentMax,
                    end: nextMin - 1
                });
            }
        }

        return gaps;
    }

    /**
     * Checks if two coefficients have overlapping price ranges
     * @param {Coefficient} coeff1 - First coefficient
     * @param {Coefficient} coeff2 - Second coefficient
     * @returns {boolean} True if ranges overlap
     */
    hasOverlappingRanges(coeff1, coeff2) {
        const min1 = coeff1.getMinPrice();
        const max1 = coeff1.getMaxPrice();
        const min2 = coeff2.getMinPrice();
        const max2 = coeff2.getMaxPrice();

        // Handle open ranges (null maxPrice)
        const actualMax1 = max1 === null ? Infinity : max1;
        const actualMax2 = max2 === null ? Infinity : max2;

        // Check for overlap: ranges overlap if min1 < max2 and min2 < max1
        return min1 < actualMax2 && min2 < actualMax1;
    }

    /**
     * Prints debug information about loaded coefficients
     */
    printDebugInfo() {
        if (!this.loaded) {
            this.loadCoefficients();
        }

        console.log('\n=== Coefficient Manager Debug Info ===');
        console.log(`Configuration file: ${this.configPath}`);
        console.log(`Loaded: ${this.loaded}`);
        console.log(`Number of coefficients: ${this.coefficients.length}`);
        
        // Cache statistics
        const cacheStats = this.getCacheStats();
        console.log('\nCache Statistics:');
        console.log(`  Enabled: ${cacheStats.enabled}`);
        console.log(`  Cache hits: ${cacheStats.hits}`);
        console.log(`  Cache misses: ${cacheStats.misses}`);
        console.log(`  Hit rate: ${cacheStats.hitRate}`);
        console.log(`  Cache size: ${cacheStats.cacheSize} entries`);
        console.log(`  Last modified: ${cacheStats.lastModified ? new Date(cacheStats.lastModified).toISOString() : 'Unknown'}`);
        
        console.log('\nCoefficients:');
        
        this.coefficients.forEach((coeff, index) => {
            console.log(`  ${index + 1}. ${coeff.toString()}`);
        });
        
        console.log('=====================================\n');
    }

    /**
     * Exports coefficients to a JSON string
     * @param {Object} options - Export options
     * @param {Array<string>} options.names - Specific coefficient names to export (optional)
     * @param {boolean} options.includeMetadata - Whether to include metadata in export
     * @returns {string} JSON representation of coefficients
     */
    exportCoefficients(options = {}) {
        if (!this.loaded) {
            this.loadCoefficients();
        }
        
        let coefficientsToExport = this.coefficients;
        
        // Filter by names if specified
        if (options.names && Array.isArray(options.names)) {
            coefficientsToExport = this.coefficients.filter(coeff => 
                options.names.includes(coeff.getName())
            );
        }
        
        const data = coefficientsToExport.map(coeff => coeff.toJSON());
        
        // Add metadata if requested
        if (options.includeMetadata) {
            const exportData = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    version: '1.0',
                    totalCoefficients: data.length,
                    source: 'CoefficientManager'
                },
                coefficients: data
            };
            return JSON.stringify(exportData, null, 2);
        }
        
        return JSON.stringify(data, null, 2);
    }

    /**
     * Exports coefficients to a file
     * @param {string} filePath - Path to export file
     * @param {Object} options - Export options (same as exportCoefficients)
     */
    exportCoefficientsToFile(filePath, options = {}) {
        try {
            const jsonString = this.exportCoefficients(options);
            fs.writeFileSync(filePath, jsonString, 'utf8');
            console.log(`Exported coefficients to: ${filePath}`);
        } catch (error) {
            console.error('Error exporting coefficients to file:', error.message);
            throw error;
        }
    }

    /**
     * Imports coefficients from a JSON string
     * @param {string} jsonString - JSON string containing coefficient data
     * @param {Object} options - Import options
     * @param {boolean} options.replace - If true, replace all coefficients; if false, add to existing
     * @param {boolean} options.validateOnly - If true, only validate without importing
     * @param {boolean} options.skipDuplicates - If true, skip coefficients with duplicate names
     * @returns {Object} Import result with statistics
     */
    importCoefficients(jsonString, options = {}) {
        const { replace = false, validateOnly = false, skipDuplicates = false } = options;
        
        try {
            let data = JSON.parse(jsonString);
            
            // Handle metadata format
            if (data.metadata && data.coefficients) {
                console.log(`Importing from export created on: ${data.metadata.exportDate}`);
                data = data.coefficients;
            }
            
            if (!Array.isArray(data)) {
                throw new Error('Import data must be an array of coefficients');
            }

            const newCoefficients = [];
            const errors = [];
            const skipped = [];
            
            // Process each coefficient
            for (let i = 0; i < data.length; i++) {
                try {
                    const coeff = Coefficient.fromJSON(data[i]);
                    
                    if (!coeff.isValid()) {
                        errors.push(`Coefficient ${i} (${coeff.getName()}): Invalid data`);
                        continue;
                    }
                    
                    // Check for duplicates if skipDuplicates is enabled
                    if (skipDuplicates && !replace) {
                        const existing = this.findCoefficientByName(coeff.getName());
                        if (existing) {
                            skipped.push(coeff.getName());
                            continue;
                        }
                    }
                    
                    newCoefficients.push(coeff);
                } catch (coeffError) {
                    errors.push(`Coefficient ${i}: ${coeffError.message}`);
                }
            }

            const result = {
                total: data.length,
                valid: newCoefficients.length,
                errors: errors.length,
                skipped: skipped.length,
                errorDetails: errors,
                skippedNames: skipped
            };

            // If validation only, return results without importing
            if (validateOnly) {
                result.validationOnly = true;
                return result;
            }

            // Perform the import
            if (newCoefficients.length > 0) {
                if (replace) {
                    this.coefficients = newCoefficients;
                    console.log(`Replaced all coefficients with ${newCoefficients.length} imported coefficients`);
                } else {
                    this.coefficients.push(...newCoefficients);
                    console.log(`Added ${newCoefficients.length} imported coefficients`);
                }

                // Clear cache immediately when coefficients change
                this.clearCache();
                
                // Save the changes
                try {
                    this.saveCoefficients();
                } catch (saveError) {
                    console.error('Failed to save after import:', saveError.message);
                    result.saveError = saveError.message;
                }
            }

            return result;

        } catch (error) {
            console.error('Error importing coefficients:', error.message);
            throw error;
        }
    }

    /**
     * Imports coefficients from a file
     * @param {string} filePath - Path to import file
     * @param {Object} options - Import options (same as importCoefficients)
     * @returns {Object} Import result with statistics
     */
    importCoefficientsFromFile(filePath, options = {}) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`Import file not found: ${filePath}`);
            }
            
            const jsonString = fs.readFileSync(filePath, 'utf8');
            console.log(`Importing coefficients from: ${filePath}`);
            
            return this.importCoefficients(jsonString, options);
        } catch (error) {
            console.error('Error importing coefficients from file:', error.message);
            throw error;
        }
    }

    /**
     * Creates a backup of current coefficients
     * @param {string} backupName - Optional name for the backup (defaults to timestamp)
     * @returns {string} Path to the backup file
     */
    createBackup(backupName = null) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const name = backupName || `backup-${timestamp}`;
            const backupPath = path.join(path.dirname(this.configPath), `coefficients-${name}.json`);
            
            const exportData = this.exportCoefficients({ includeMetadata: true });
            fs.writeFileSync(backupPath, exportData, 'utf8');
            
            console.log(`Created backup: ${backupPath}`);
            return backupPath;
        } catch (error) {
            console.error('Error creating backup:', error.message);
            throw error;
        }
    }

    /**
     * Lists all available backup files
     * @returns {Array<Object>} Array of backup file information
     */
    listBackups() {
        try {
            const dir = path.dirname(this.configPath);
            const files = fs.readdirSync(dir);
            
            const backups = files
                .filter(file => file.startsWith('coefficients-') && file.endsWith('.json'))
                .map(file => {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    return {
                        name: file,
                        path: filePath,
                        size: stats.size,
                        created: stats.mtime,
                        isBackup: file.includes('backup-') || file.includes('corrupted.')
                    };
                })
                .sort((a, b) => b.created - a.created); // Sort by creation date, newest first
            
            return backups;
        } catch (error) {
            console.error('Error listing backups:', error.message);
            return [];
        }
    }

    /**
     * Restores coefficients from a backup file
     * @param {string} backupPath - Path to the backup file
     * @returns {Object} Restore result with statistics
     */
    restoreFromBackup(backupPath) {
        try {
            console.log(`Restoring coefficients from backup: ${backupPath}`);
            
            // Create a backup of current state before restoring
            const currentBackupPath = this.createBackup('pre-restore');
            console.log(`Created backup of current state: ${currentBackupPath}`);
            
            // Import from backup with replace option
            const result = this.importCoefficientsFromFile(backupPath, { replace: true });
            
            if (result.valid > 0) {
                console.log(`Successfully restored ${result.valid} coefficients from backup`);
            }
            
            return result;
        } catch (error) {
            console.error('Error restoring from backup:', error.message);
            throw error;
        }
    }

    /**
     * Clears all cached data
     */
    clearCache() {
        this.cache.priceToCoefficient.clear();
        this.cache.cacheHits = 0;
        this.cache.cacheMisses = 0;
        console.log('Coefficient cache cleared');
    }

    /**
     * Gets comprehensive statistics about the coefficient collection
     * @returns {Object} Statistics about coefficients
     */
    getStatistics() {
        if (!this.loaded) {
            this.loadCoefficients();
        }

        const stats = {
            total: this.coefficients.length,
            priceRanges: {
                lowest: null,
                highest: null,
                openRanges: 0
            },
            multipliers: {
                buyRange: { min: null, max: null },
                sellRange: { min: null, max: null },
                profitRange: { min: null, max: null }
            },
            validation: {
                valid: 0,
                invalid: 0,
                overlaps: 0,
                gaps: 0
            },
            cache: this.getCacheStats()
        };

        if (this.coefficients.length === 0) {
            return stats;
        }

        // Calculate price range statistics
        let minPrice = Infinity;
        let maxPrice = -Infinity;
        let buyMultipliers = [];
        let sellMultipliers = [];

        for (const coeff of this.coefficients) {
            // Price ranges
            const coeffMin = coeff.getMinPrice();
            const coeffMax = coeff.getMaxPrice();
            
            minPrice = Math.min(minPrice, coeffMin);
            if (coeffMax !== null) {
                maxPrice = Math.max(maxPrice, coeffMax);
            } else {
                stats.priceRanges.openRanges++;
            }

            // Multipliers
            buyMultipliers.push(coeff.getBuyMultiplier());
            sellMultipliers.push(coeff.getSellMultiplier());

            // Validation
            if (coeff.isValid()) {
                stats.validation.valid++;
            } else {
                stats.validation.invalid++;
            }
        }

        stats.priceRanges.lowest = minPrice === Infinity ? null : minPrice;
        stats.priceRanges.highest = maxPrice === -Infinity ? null : maxPrice;

        // Multiplier statistics
        stats.multipliers.buyRange.min = Math.min(...buyMultipliers);
        stats.multipliers.buyRange.max = Math.max(...buyMultipliers);
        stats.multipliers.sellRange.min = Math.min(...sellMultipliers);
        stats.multipliers.sellRange.max = Math.max(...sellMultipliers);

        // Calculate profit ranges
        const profitRanges = this.coefficients.map(coeff => {
            const testPrice = 1000; // Use a test price to calculate profit percentage
            return coeff.calculateProfitPercent(testPrice);
        });
        stats.multipliers.profitRange.min = Math.min(...profitRanges);
        stats.multipliers.profitRange.max = Math.max(...profitRanges);

        // Validation issues
        stats.validation.overlaps = this.detectOverlappingRanges().length;
        stats.validation.gaps = this.detectCoverageGaps().length;

        return stats;
    }

    /**
     * Prints a comprehensive summary of coefficient management status
     */
    printSummary() {
        const stats = this.getStatistics();
        
        console.log('\n=== Coefficient Management Summary ===');
        console.log(`Total coefficients: ${stats.total}`);
        
        if (stats.total > 0) {
            console.log(`\nPrice Coverage:`);
            console.log(`  Lowest price: ${stats.priceRanges.lowest || 'N/A'}`);
            console.log(`  Highest price: ${stats.priceRanges.highest || 'Unlimited'}`);
            console.log(`  Open ranges: ${stats.priceRanges.openRanges}`);
            
            console.log(`\nMultiplier Ranges:`);
            console.log(`  Buy multipliers: ${stats.multipliers.buyRange.min} - ${stats.multipliers.buyRange.max}`);
            console.log(`  Sell multipliers: ${stats.multipliers.sellRange.min} - ${stats.multipliers.sellRange.max}`);
            console.log(`  Profit range: ${stats.multipliers.profitRange.min.toFixed(1)}% - ${stats.multipliers.profitRange.max.toFixed(1)}%`);
            
            console.log(`\nValidation Status:`);
            console.log(`  Valid coefficients: ${stats.validation.valid}`);
            console.log(`  Invalid coefficients: ${stats.validation.invalid}`);
            console.log(`  Overlapping ranges: ${stats.validation.overlaps}`);
            console.log(`  Coverage gaps: ${stats.validation.gaps}`);
        }
        
        console.log(`\nCache Performance:`);
        console.log(`  Enabled: ${stats.cache.enabled}`);
        console.log(`  Hit rate: ${stats.cache.hitRate}`);
        console.log(`  Cache size: ${stats.cache.cacheSize} entries`);
        
        console.log('=====================================\n');
    }

    /**
     * Enables or disables caching
     * @param {boolean} enabled - Whether to enable caching
     */
    setCacheEnabled(enabled) {
        this.cache.enabled = enabled;
        if (!enabled) {
            this.clearCache();
        }
        console.log(`Coefficient caching ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Gets cache statistics
     * @returns {Object} Cache performance statistics
     */
    getCacheStats() {
        const total = this.cache.cacheHits + this.cache.cacheMisses;
        return {
            enabled: this.cache.enabled,
            hits: this.cache.cacheHits,
            misses: this.cache.cacheMisses,
            hitRate: total > 0 ? (this.cache.cacheHits / total * 100).toFixed(2) + '%' : '0%',
            cacheSize: this.cache.priceToCoefficient.size,
            lastModified: this.cache.lastModified
        };
    }

    /**
     * Checks if configuration file has been modified since last load
     * @returns {boolean} True if file has been modified
     */
    isConfigurationModified() {
        try {
            if (!fs.existsSync(this.configPath)) {
                return false;
            }
            
            const stats = fs.statSync(this.configPath);
            const currentModified = stats.mtime.getTime();
            
            if (this.cache.lastModified === null) {
                this.cache.lastModified = currentModified;
                return false;
            }
            
            return currentModified > this.cache.lastModified;
        } catch (error) {
            console.error('Error checking file modification time:', error.message);
            return false;
        }
    }

    /**
     * Updates the last modified timestamp
     */
    updateLastModified() {
        try {
            if (fs.existsSync(this.configPath)) {
                const stats = fs.statSync(this.configPath);
                if (stats && stats.mtime) {
                    this.cache.lastModified = stats.mtime.getTime();
                }
            }
        } catch (error) {
            console.error('Error updating last modified timestamp:', error.message);
        }
    }

    /**
     * Clears the singleton instance (mainly for testing)
     */
    static clearInstance() {
        CoefficientManager.instance = null;
    }
}

module.exports = CoefficientManager;
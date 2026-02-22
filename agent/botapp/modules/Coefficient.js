/**
 * Coefficient class for smart price calculation
 * Represents a coefficient with price range and multipliers for buy/sell calculations
 */
class Coefficient {
    /**
     * Creates a new Coefficient instance
     * @param {string} name - Name of the coefficient
     * @param {string} description - Description of the coefficient
     * @param {number} minPrice - Minimum price for this coefficient range
     * @param {number|null} maxPrice - Maximum price for this coefficient range (null for open range)
     * @param {number} buyMultiplier - Multiplier for buy price calculation
     * @param {number} sellMultiplier - Multiplier for sell price calculation
     */
    constructor(name, description, minPrice, maxPrice, buyMultiplier, sellMultiplier) {
        // Validate input parameters
        if (typeof name !== 'string' || name.trim() === '') {
            throw new Error('Name must be a non-empty string');
        }
        if (typeof description !== 'string') {
            throw new Error('Description must be a string');
        }
        if (typeof minPrice !== 'number' || minPrice < 0) {
            throw new Error('MinPrice must be a non-negative number');
        }
        if (maxPrice !== null && (typeof maxPrice !== 'number' || maxPrice <= minPrice)) {
            throw new Error('MaxPrice must be null or a number greater than minPrice');
        }
        if (typeof buyMultiplier !== 'number' || buyMultiplier <= 0) {
            throw new Error('BuyMultiplier must be a positive number');
        }
        if (typeof sellMultiplier !== 'number' || sellMultiplier <= 0) {
            throw new Error('SellMultiplier must be a positive number');
        }

        this.name = name.trim();
        this.description = description.trim();
        this.minPrice = minPrice;
        this.maxPrice = maxPrice;
        this.buyMultiplier = buyMultiplier;
        this.sellMultiplier = sellMultiplier;
    }

    /**
     * Checks if this coefficient matches the given price
     * @param {number} price - Price to check
     * @returns {boolean} True if price falls within this coefficient's range
     */
    matches(price) {
        if (typeof price !== 'number' || price < 0) {
            return false;
        }

        const withinMin = price >= this.minPrice;
        const withinMax = this.maxPrice === null || price < this.maxPrice;
        
        return withinMin && withinMax;
    }

    /**
     * Calculates buy price based on market price
     * @param {number} marketPrice - Market price
     * @returns {number} Calculated buy price (rounded down to integer)
     */
    calculateBuyPrice(marketPrice) {
        if (typeof marketPrice !== 'number' || marketPrice <= 0) {
            throw new Error('Market price must be a positive number');
        }
        
        return Math.floor(marketPrice * this.buyMultiplier);
    }

    /**
     * Calculates sell price based on market price
     * @param {number} marketPrice - Market price
     * @returns {number} Calculated sell price (rounded down to integer)
     */
    calculateSellPrice(marketPrice) {
        if (typeof marketPrice !== 'number' || marketPrice <= 0) {
            throw new Error('Market price must be a positive number');
        }
        
        return Math.floor(marketPrice * this.sellMultiplier);
    }

    /**
     * Calculates profit based on market price
     * @param {number} marketPrice - Market price
     * @returns {number} Calculated profit (sell price - buy price)
     */
    calculateProfit(marketPrice) {
        const buyPrice = this.calculateBuyPrice(marketPrice);
        const sellPrice = this.calculateSellPrice(marketPrice);
        
        return sellPrice - buyPrice;
    }

    /**
     * Calculates profit percentage based on market price
     * @param {number} marketPrice - Market price
     * @returns {number} Calculated profit percentage
     */
    calculateProfitPercent(marketPrice) {
        const buyPrice = this.calculateBuyPrice(marketPrice);
        const profit = this.calculateProfit(marketPrice);
        
        if (buyPrice === 0) {
            return 0;
        }
        
        return (profit / buyPrice) * 100;
    }

    /**
     * Gets the name of this coefficient
     * @returns {string} Coefficient name
     */
    getName() {
        return this.name;
    }

    /**
     * Gets the description of this coefficient
     * @returns {string} Coefficient description
     */
    getDescription() {
        return this.description;
    }

    /**
     * Gets the minimum price for this coefficient
     * @returns {number} Minimum price
     */
    getMinPrice() {
        return this.minPrice;
    }

    /**
     * Gets the maximum price for this coefficient
     * @returns {number|null} Maximum price or null for open range
     */
    getMaxPrice() {
        return this.maxPrice;
    }

    /**
     * Gets the buy multiplier for this coefficient
     * @returns {number} Buy multiplier
     */
    getBuyMultiplier() {
        return this.buyMultiplier;
    }

    /**
     * Gets the sell multiplier for this coefficient
     * @returns {number} Sell multiplier
     */
    getSellMultiplier() {
        return this.sellMultiplier;
    }

    /**
     * Validates coefficient data integrity
     * @returns {boolean} True if coefficient data is valid
     */
    isValid() {
        try {
            // Check basic data types and constraints
            if (typeof this.name !== 'string' || this.name.trim() === '') {
                return false;
            }
            if (typeof this.description !== 'string') {
                return false;
            }
            if (typeof this.minPrice !== 'number' || this.minPrice < 0) {
                return false;
            }
            if (this.maxPrice !== null && (typeof this.maxPrice !== 'number' || this.maxPrice <= this.minPrice)) {
                return false;
            }
            if (typeof this.buyMultiplier !== 'number' || this.buyMultiplier <= 0) {
                return false;
            }
            if (typeof this.sellMultiplier !== 'number' || this.sellMultiplier <= 0) {
                return false;
            }

            // Enhanced business logic validation
            // Ensure buy multiplier is reasonable (between 0.1 and 1.0)
            if (this.buyMultiplier < 0.1 || this.buyMultiplier > 1.0) {
                return false;
            }
            
            // Ensure sell multiplier is reasonable (between 0.5 and 10.0) and greater than buy multiplier
            if (this.sellMultiplier < 0.5 || this.sellMultiplier > 10.0) {
                return false;
            }

            if (this.sellMultiplier <= this.buyMultiplier) {
                return false;
            }

            // Validate price range constraints
            if (this.minPrice < 0) {
                return false;
            }

            // Maximum price should not exceed reasonable limits (1 billion coins)
            if (this.maxPrice !== null && this.maxPrice > 1000000000) {
                return false;
            }

            // Ensure price range is meaningful (at least 1 coin difference)
            if (this.maxPrice !== null && (this.maxPrice - this.minPrice) < 1) {
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Gets detailed validation errors for this coefficient
     * @returns {Array<string>} Array of validation error messages
     */
    getValidationErrors() {
        const errors = [];

        try {
            // Check basic data types and constraints
            if (typeof this.name !== 'string' || this.name.trim() === '') {
                errors.push('Name must be a non-empty string');
            }
            if (typeof this.description !== 'string') {
                errors.push('Description must be a string');
            }
            if (typeof this.minPrice !== 'number' || this.minPrice < 0) {
                errors.push('MinPrice must be a non-negative number');
            }
            if (this.maxPrice !== null && (typeof this.maxPrice !== 'number' || this.maxPrice <= this.minPrice)) {
                errors.push('MaxPrice must be null or a number greater than minPrice');
            }
            if (typeof this.buyMultiplier !== 'number' || this.buyMultiplier <= 0) {
                errors.push('BuyMultiplier must be a positive number');
            }
            if (typeof this.sellMultiplier !== 'number' || this.sellMultiplier <= 0) {
                errors.push('SellMultiplier must be a positive number');
            }

            // Enhanced business logic validation
            if (typeof this.buyMultiplier === 'number' && (this.buyMultiplier < 0.1 || this.buyMultiplier > 1.0)) {
                errors.push('BuyMultiplier must be between 0.1 and 1.0');
            }
            
            if (typeof this.sellMultiplier === 'number' && (this.sellMultiplier < 0.5 || this.sellMultiplier > 10.0)) {
                errors.push('SellMultiplier must be between 0.5 and 10.0');
            }

            if (typeof this.buyMultiplier === 'number' && typeof this.sellMultiplier === 'number' && 
                this.sellMultiplier <= this.buyMultiplier) {
                errors.push('SellMultiplier must be greater than buyMultiplier');
            }

            // Validate price range constraints
            if (typeof this.minPrice === 'number' && this.minPrice < 0) {
                errors.push('MinPrice cannot be negative');
            }

            if (this.maxPrice !== null && typeof this.maxPrice === 'number' && this.maxPrice > 1000000000) {
                errors.push('MaxPrice cannot exceed 1,000,000,000 coins');
            }

            if (this.maxPrice !== null && typeof this.minPrice === 'number' && typeof this.maxPrice === 'number' && 
                (this.maxPrice - this.minPrice) < 1) {
                errors.push('Price range must be at least 1 coin wide');
            }

        } catch (error) {
            errors.push(`Validation error: ${error.message}`);
        }

        return errors;
    }

    /**
     * Returns a string representation of this coefficient
     * @returns {string} String representation
     */
    toString() {
        const maxPriceStr = this.maxPrice === null ? '∞' : this.maxPrice.toString();
        return `${this.name}: [${this.minPrice}-${maxPriceStr}] Buy: ${this.buyMultiplier}, Sell: ${this.sellMultiplier}`;
    }

    /**
     * Returns a JSON representation of this coefficient
     * @returns {Object} JSON object representation
     */
    toJSON() {
        return {
            name: this.name,
            description: this.description,
            minPrice: this.minPrice,
            maxPrice: this.maxPrice,
            buyMultiplier: this.buyMultiplier,
            sellMultiplier: this.sellMultiplier
        };
    }

    /**
     * Creates a Coefficient instance from JSON data
     * @param {Object} data - JSON data
     * @returns {Coefficient} New Coefficient instance
     */
    static fromJSON(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid JSON data for Coefficient');
        }

        return new Coefficient(
            data.name,
            data.description,
            data.minPrice,
            data.maxPrice,
            data.buyMultiplier,
            data.sellMultiplier
        );
    }
}

module.exports = Coefficient;
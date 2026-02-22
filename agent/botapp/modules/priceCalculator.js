
const CoefficientManager = require('./CoefficientManager');
const { logInfo, logWarn, logError } = require('./logging');

// Упрощенный калькулятор цен без сложных формул


function computeSimplePrice(lots, historicalPrice) {
    if (!lots || lots.length === 0) {
        const fallback = historicalPrice || 0;
        return {
            absolutePrice: fallback,
            buyPrice: Math.floor(fallback * 0.75),
            sellPrice: Math.floor(fallback * 0.95)
        };
    }

    // Фильтруем лоты с разумными ценами (от $100 до $100M)
    const validLots = lots.filter(lot => lot.unitPrice >= 100 && lot.unitPrice <= 100_000_000);
    if (validLots.length === 0) {
        const fallback = historicalPrice || 0;
        return {
            absolutePrice: fallback,
            buyPrice: Math.floor(fallback * 0.75),
            sellPrice: Math.floor(fallback * 0.95)
        };
    }

    // Используем минимальную цену с аукциона как базовую
    let newPrice = Math.min(...validLots.map(lot => lot.unitPrice));

    // Упрощенная формула расчета цен
    const sellPrice = Math.floor(newPrice * 0.95);  // Продаем за 95% от рыночной цены
    const buyPrice = Math.floor(newPrice * 0.75);   // Покупаем за 75% от рыночной цены

    // Финальная проверка на разумность
    if (buyPrice < 1 || sellPrice < 1 || !isFinite(buyPrice) || !isFinite(sellPrice)) {
        const fallback = historicalPrice || 1000;
        return {
            absolutePrice: fallback,
            buyPrice: Math.floor(fallback * 0.75),
            sellPrice: Math.floor(fallback * 0.95)
        };
    }

    return {
        absolutePrice: newPrice,
        buyPrice,
        sellPrice
    };
}

/**
 * Enhanced price calculator with smart coefficient-based logic
 * Maintains backward compatibility with computeSimplePrice interface
 * @param {Array} lots - Array of auction lots with unitPrice property
 * @param {number} historicalPrice - Fallback price when lots are empty or invalid
 * @returns {Object} Price calculation result with absolutePrice, buyPrice, sellPrice
 */
function computeSmartPrice(lots, historicalPrice) {
    let coefficientManager;
    
    // Safe coefficient manager initialization with error handling
    try {
        coefficientManager = CoefficientManager.getInstance();
        if (!coefficientManager) {
            logError('CoefficientManager instance is null, using fallback calculation', 'priceCalculator');
            return computeSimplePrice(lots, historicalPrice);
        }
    } catch (error) {
        logError(`Failed to initialize CoefficientManager: ${error.message}, using fallback calculation`, 'priceCalculator');
        return computeSimplePrice(lots, historicalPrice);
    }
    
    // Validate and sanitize historical price input
    const validHistoricalPrice = validateHistoricalPrice(historicalPrice);
    
    // Extract market price from lots or use historical fallback
    let marketPrice;
    try {
        marketPrice = extractMarketPrice(lots, validHistoricalPrice);
    } catch (error) {
        logError(`Error extracting market price: ${error.message}`, 'priceCalculator');
        marketPrice = validHistoricalPrice;
    }
    
    // Find appropriate coefficient for this price
    let coefficient;
    try {
        coefficient = coefficientManager.findCoefficientForPrice(marketPrice);
    } catch (error) {
        logError(`Error finding coefficient for price ${marketPrice}: ${error.message}`, 'priceCalculator');
        coefficient = null;
    }
    
    if (coefficient) {
        try {
            // Use coefficient for calculations
            const buyPrice = coefficient.calculateBuyPrice(marketPrice);
            const sellPrice = coefficient.calculateSellPrice(marketPrice);
            const profit = coefficient.calculateProfit(marketPrice);
            const profitPercent = coefficient.calculateProfitPercent(marketPrice);
            
            // Validate business rule invariant: buy_price < sell_price
            if (buyPrice >= sellPrice) {
                logWarn(`Coefficient "${coefficient.getName()}" produced invalid prices: buy=${buyPrice}, sell=${sellPrice}. Using fallback.`, 'priceCalculator');
                return createFallbackResult(marketPrice, validHistoricalPrice);
            }
            
            // Additional validation for calculated prices
            if (buyPrice < 1 || sellPrice < 1 || !isFinite(buyPrice) || !isFinite(sellPrice)) {
                logWarn(`Coefficient "${coefficient.getName()}" produced invalid price values: buy=${buyPrice}, sell=${sellPrice}. Using fallback.`, 'priceCalculator');
                return createFallbackResult(marketPrice, validHistoricalPrice);
            }
            
            // Log successful calculation for monitoring (Requirements 5.5)
            logInfo(`Smart price calculation: market=${marketPrice}, coefficient="${coefficient.getName()}", buy=${buyPrice}, sell=${sellPrice}, profit=${profit} (${profitPercent.toFixed(2)}%)`, 'priceCalculator');
            
            // Return enhanced result with coefficient information
            return {
                absolutePrice: marketPrice,
                buyPrice,
                sellPrice,
                coefficient: coefficient.getName(),
                profit,
                profitPercent
            };
            
        } catch (error) {
            logError(`Error calculating prices with coefficient "${coefficient.getName()}": ${error.message}`, 'priceCalculator');
            return createFallbackResult(marketPrice, validHistoricalPrice);
        }
    } else {
        // No coefficient found, use fallback multipliers (Requirements 4.4)
        logWarn(`No coefficient found for price ${marketPrice}, using fallback multipliers`, 'priceCalculator');
        return createFallbackResult(marketPrice, validHistoricalPrice);
    }
}

/**
 * Extracts market price from lots array with validation and fallback logic
 * @param {Array} lots - Array of auction lots
 * @param {number} historicalPrice - Fallback price (IGNORED if lots exist)
 * @returns {number} Extracted market price
 */
function extractMarketPrice(lots, historicalPrice) {
    // Handle empty or invalid lots array
    if (!lots || lots.length === 0) {
        const fallback = Math.floor(historicalPrice || 1000);
        logWarn(`No lots provided, using fallback: ${fallback}`, 'priceCalculator');
        return fallback;
    }
    
    // Handle non-array input
    if (!Array.isArray(lots)) {
        const fallback = Math.floor(historicalPrice || 1000);
        logWarn(`Invalid lots input (not an array), using fallback: ${fallback}`, 'priceCalculator');
        return fallback;
    }
    
    // Handle extremely large arrays (potential memory issues)
    if (lots.length > 10000) {
        logWarn(`Very large lots array (${lots.length} items), processing first 10000 only`, 'priceCalculator');
        lots = lots.slice(0, 10000);
    }
    
    // Filter lots with reasonable prices (from 100 to 100M coins)
    const validLots = lots.filter((lot, index) => {
        try {
            // Handle null/undefined lots
            if (!lot) {
                if (index < 10) logWarn(`Lot at index ${index} is null/undefined`, 'priceCalculator');
                return false;
            }
            
            // Handle missing unitPrice property
            if (!lot.hasOwnProperty('unitPrice')) {
                if (index < 10) logWarn(`Lot at index ${index} missing unitPrice property`, 'priceCalculator');
                return false;
            }
            
            // Handle non-numeric unitPrice
            if (typeof lot.unitPrice !== 'number') {
                if (index < 10) logWarn(`Lot at index ${index} has non-numeric unitPrice: ${typeof lot.unitPrice}`, 'priceCalculator');
                return false;
            }
            
            // Handle invalid numeric values
            if (!isFinite(lot.unitPrice) || isNaN(lot.unitPrice)) {
                if (index < 10) logWarn(`Lot at index ${index} has invalid unitPrice: ${lot.unitPrice}`, 'priceCalculator');
                return false;
            }
            
            // Round fractional prices to integers for coefficient system compatibility
            const roundedPrice = Math.floor(lot.unitPrice);
            
            // Handle price range validation (using rounded price)
            const isValidRange = roundedPrice >= 100 && roundedPrice <= 100_000_000;
            if (!isValidRange && index < 10) {
                logWarn(`Lot at index ${index} has unitPrice outside valid range: ${lot.unitPrice} (rounded: ${roundedPrice})`, 'priceCalculator');
            }
            
            // Update lot with rounded price for consistency
            lot.unitPrice = roundedPrice;
            
            return isValidRange;
        } catch (error) {
            logError(`Error processing lot at index ${index}: ${error.message}`, 'priceCalculator');
            return false;
        }
    });
    
    if (validLots.length === 0) {
        const fallback = Math.floor(historicalPrice || 1000);
        logWarn(`No valid lots found after filtering (${lots.length} total lots), using fallback: ${fallback}`, 'priceCalculator');
        return fallback;
    }
    
    // Use minimum unit price as market price - IGNORE historicalPrice!
    let marketPrice;
    try {
        const prices = validLots.map(lot => lot.unitPrice);
        marketPrice = Math.min(...prices);
        
        // Log filtering results for monitoring
        if (validLots.length !== lots.length) {
            logInfo(`Filtered ${lots.length - validLots.length} invalid lots, ${validLots.length} valid lots remaining`, 'priceCalculator');
        }
        
        logInfo(`Market price extracted from lots: ${marketPrice} (ignoring historical price)`, 'priceCalculator');
    } catch (error) {
        const fallback = Math.floor(historicalPrice || 1000);
        logError(`Error calculating minimum price from valid lots: ${error.message}, using fallback: ${fallback}`, 'priceCalculator');
        return fallback;
    }
    
    // Final validation of extracted price
    if (marketPrice <= 0 || !isFinite(marketPrice) || isNaN(marketPrice)) {
        const fallback = Math.floor(historicalPrice || 1000);
        logWarn(`Invalid market price extracted: ${marketPrice}, using fallback: ${fallback}`, 'priceCalculator');
        return fallback;
    }
    
    // Ensure market price is an integer
    marketPrice = Math.floor(marketPrice);
    
    return marketPrice;
}

/**
 * Creates fallback price calculation result using legacy multipliers
 * @param {number} marketPrice - The market price to calculate from
 * @param {number} historicalPrice - Historical price for additional fallback
 * @returns {Object} Fallback price calculation result
 */
function createFallbackResult(marketPrice, historicalPrice) {
    // Use safe fallback multipliers (Requirements 4.4)
    const FALLBACK_BUY_MULTIPLIER = 0.75;
    const FALLBACK_SELL_MULTIPLIER = 0.95;
    
    // Validate market price and apply historical price fallback (Requirements 5.1)
    let basePrice = marketPrice;
    if (!basePrice || basePrice <= 0 || !isFinite(basePrice) || isNaN(basePrice)) {
        basePrice = historicalPrice || 1000;
        logWarn(`Invalid market price for fallback calculation, using historical/default: ${basePrice}`, 'priceCalculator');
    }
    
    // Handle invalid historical price
    if (!isFinite(basePrice) || isNaN(basePrice) || basePrice <= 0) {
        basePrice = 1000; // Safe default
        logWarn(`Invalid historical price, using safe default: ${basePrice}`, 'priceCalculator');
    }
    
    const buyPrice = Math.floor(basePrice * FALLBACK_BUY_MULTIPLIER);
    const sellPrice = Math.floor(basePrice * FALLBACK_SELL_MULTIPLIER);
    
    // Final safety check - ensure business rule invariant
    if (buyPrice < 1 || sellPrice < 1 || !isFinite(buyPrice) || !isFinite(sellPrice) || buyPrice >= sellPrice) {
        logError(`Fallback calculation produced invalid results: buy=${buyPrice}, sell=${sellPrice}`, 'priceCalculator');
        
        // Emergency fallback with safe values
        const emergencyBase = 1000;
        const emergencyBuy = Math.floor(emergencyBase * 0.75); // 750
        const emergencySell = Math.floor(emergencyBase * 0.95); // 950
        
        logInfo(`Using emergency fallback values: base=${emergencyBase}, buy=${emergencyBuy}, sell=${emergencySell}`, 'priceCalculator');
        
        return {
            absolutePrice: emergencyBase,
            buyPrice: emergencyBuy,
            sellPrice: emergencySell
        };
    }
    
    // Log fallback usage for monitoring (Requirements 5.5)
    logInfo(`Using fallback calculation: base=${basePrice}, buy=${buyPrice}, sell=${sellPrice}`, 'priceCalculator');
    
    return {
        absolutePrice: basePrice,
        buyPrice,
        sellPrice
    };
}

/**
 * Validates and sanitizes historical price input
 * @param {*} historicalPrice - Historical price input (may be any type)
 * @returns {number} Validated historical price or safe default
 */
function validateHistoricalPrice(historicalPrice) {
    // Handle null/undefined
    if (historicalPrice == null) {
        return 1000;
    }
    
    // Handle non-numeric input
    if (typeof historicalPrice !== 'number') {
        logWarn(`Invalid historical price type: ${typeof historicalPrice}, using default`, 'priceCalculator');
        return 1000;
    }
    
    // Handle invalid numeric values
    if (!isFinite(historicalPrice) || isNaN(historicalPrice)) {
        logWarn(`Invalid historical price value: ${historicalPrice}, using default`, 'priceCalculator');
        return 1000;
    }
    
    // Handle negative or zero prices
    if (historicalPrice <= 0) {
        logWarn(`Non-positive historical price: ${historicalPrice}, using default`, 'priceCalculator');
        return 1000;
    }
    
    // Handle extremely high prices (cap at 100M)
    if (historicalPrice > 100_000_000) {
        logWarn(`Historical price too high: ${historicalPrice}, capping at 100M`, 'priceCalculator');
        return 100_000_000;
    }
    
    // Round to integer for coefficient system compatibility
    return Math.floor(historicalPrice);
}

/**
 * Advanced price calculation function with detailed coefficient information
 * @param {number} marketPrice - The market price to calculate from
 * @param {string} itemName - Optional item name for logging
 * @returns {Object} Detailed price calculation result
 */
function calculatePricesWithCoefficients(marketPrice, itemName = 'unknown') {
    const coefficientManager = CoefficientManager.getInstance();
    
    // Validate and round input to integer
    if (typeof marketPrice !== 'number' || marketPrice <= 0 || !isFinite(marketPrice)) {
        const errorMsg = `Invalid market price: ${marketPrice}`;
        logError(errorMsg, 'priceCalculator');
        throw new Error(errorMsg);
    }
    
    // Round to integer for coefficient system compatibility
    const roundedMarketPrice = Math.floor(marketPrice);
    
    // Find coefficient
    let coefficient;
    try {
        coefficient = coefficientManager.findCoefficientForPrice(roundedMarketPrice);
    } catch (error) {
        const errorMsg = `Error finding coefficient for price ${roundedMarketPrice}: ${error.message}`;
        logError(errorMsg, 'priceCalculator');
        throw new Error(errorMsg);
    }
    
    if (!coefficient) {
        const errorMsg = `No coefficient found for price: ${roundedMarketPrice}`;
        logError(errorMsg, 'priceCalculator');
        throw new Error(errorMsg);
    }
    
    // Calculate prices
    let buyPrice, sellPrice, profit, profitPercent;
    try {
        buyPrice = coefficient.calculateBuyPrice(roundedMarketPrice);
        sellPrice = coefficient.calculateSellPrice(roundedMarketPrice);
        profit = coefficient.calculateProfit(roundedMarketPrice);
        profitPercent = coefficient.calculateProfitPercent(roundedMarketPrice);
    } catch (error) {
        const errorMsg = `Error calculating prices with coefficient "${coefficient.getName()}": ${error.message}`;
        logError(errorMsg, 'priceCalculator');
        throw new Error(errorMsg);
    }
    
    // Validate business rules
    if (buyPrice >= sellPrice) {
        const errorMsg = `Invalid price calculation: buy price (${buyPrice}) >= sell price (${sellPrice})`;
        logError(errorMsg, 'priceCalculator');
        throw new Error(errorMsg);
    }
    
    // Log detailed calculation for monitoring (Requirements 5.5)
    logInfo(`Advanced price calculation for ${itemName}: market=${roundedMarketPrice}, coefficient="${coefficient.getName()}", buy=${buyPrice}, sell=${sellPrice}, profit=${profit} (${profitPercent.toFixed(2)}%)`, 'priceCalculator');
    
    return {
        marketPrice: roundedMarketPrice,
        coefficient,
        buyPrice,
        sellPrice,
        profit,
        profitPercent
    };
}

module.exports = {
    computeSmartPrice,
    computeSimplePrice, // Maintained for backward compatibility
    calculatePricesWithCoefficients
};

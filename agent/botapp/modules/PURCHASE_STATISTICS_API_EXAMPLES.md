# Purchase Statistics API Examples

## Table of Contents
1. [Basic Usage](#basic-usage)
2. [Recording Events](#recording-events)
3. [Querying Statistics](#querying-statistics)
4. [Rating System](#rating-system)
5. [Data Management](#data-management)
6. [HTTP API Examples](#http-api-examples)
7. [Advanced Examples](#advanced-examples)

## Basic Usage

### Import the Module

```javascript
const {
    statisticsCollector,
    statisticsEngine,
    ratingCalculator,
    statisticsDataStore,
    profitCalculator
} = require('./modules/purchaseStatistics');
```

## Recording Events

### Record a Purchase

```javascript
// Simple purchase
statisticsCollector.recordPurchase(
    'diamond_sword_001',
    1000,
    new Date()
);

// Purchase with details
statisticsCollector.recordPurchase(
    'diamond_sword_001',
    1000,
    new Date(),
    {
        itemName: 'Diamond Sword',
        enchantments: ['Sharpness V', 'Unbreaking III'],
        attributes: { damage: 7 },
        rarity: 'legendary',
        source: 'auction_house'
    }
);
```

### Record a Sale

```javascript
statisticsCollector.recordSale(
    'diamond_sword_001',  // itemId
    1500,                 // sale price
    1000,                 // purchase price
    new Date()
);
```


### Record a Missed Purchase

```javascript
statisticsCollector.recordMissedPurchase(
    'diamond_sword_001',
    'already_sold',      // reason
    new Date(),
    1000                 // attempted price
);

// Common reasons:
// - 'already_sold'
// - 'too_slow'
// - 'insufficient_funds'
// - 'other'
```

## Querying Statistics

### Get Item Statistics

```javascript
const itemStats = statisticsEngine.getItemStatistics('diamond_sword_001');

console.log(itemStats);
// {
//   itemId: 'diamond_sword_001',
//   itemName: 'Diamond Sword',
//   totalPurchases: 15,
//   totalSales: 12,
//   totalProfit: 6000,
//   averageProfit: 500,
//   profitMargin: 0.4,
//   successRate: 0.75,
//   rating: 4.2,
//   missedPurchases: {
//     total: 5,
//     reasons: { already_sold: 3, too_slow: 2 }
//   },
//   lastActivity: '2026-01-10T15:00:00Z'
// }
```

### Get Overall Statistics

```javascript
const overallStats = statisticsEngine.getOverallStatistics();

console.log(overallStats);
// {
//   totalItems: 50,
//   totalPurchases: 200,
//   totalSales: 180,
//   totalProfit: 50000,
//   averageSuccessRate: 0.8
// }
```

### Get Top Items

```javascript
// Top 10 items by rating
const topByRating = statisticsEngine.getTopItems('rating', 10);

// Top 10 items by profit
const topByProfit = statisticsEngine.getTopItems('profit', 10);

// Top 10 items by purchase count
const topByPurchases = statisticsEngine.getTopItems('purchases', 10);

// Top 10 items by success rate
const topBySuccess = statisticsEngine.getTopItems('successRate', 10);
```

### Get Statistics for Time Period

```javascript
// Last 7 days
const last7Days = statisticsEngine.getStatisticsForPeriod(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    new Date()
);

// Specific month
const januaryStats = statisticsEngine.getStatisticsForPeriod(
    new Date('2026-01-01'),
    new Date('2026-01-31')
);

console.log(januaryStats);
// {
//   period: {
//     start: '2026-01-01T00:00:00Z',
//     end: '2026-01-31T23:59:59Z',
//     durationDays: 31
//   },
//   totalPurchases: 50,
//   totalSales: 45,
//   totalProfit: 15000,
//   totalMissed: 10,
//   uniqueItems: 20,
//   averageSuccessRate: 0.85,
//   items: [...]
// }
```

## Rating System

### Calculate Item Rating

```javascript
const itemStats = statisticsEngine.getItemStatistics('diamond_sword_001');
const rating = ratingCalculator.calculateItemRating(itemStats);

console.log(`Rating: ${rating} stars`); // Rating: 4.2 stars
```

### Get Top Rated Items

```javascript
const allItems = [
    statisticsEngine.getItemStatistics('item1'),
    statisticsEngine.getItemStatistics('item2'),
    statisticsEngine.getItemStatistics('item3')
];

const topRated = ratingCalculator.getTopRatedItems(allItems, 10);
```

### Sort Items by Criteria

```javascript
// Sort by profit (descending)
const sortedByProfit = ratingCalculator.sortItemsByCriteria(
    allItems,
    'profit',
    'desc'
);

// Sort by success rate (ascending)
const sortedBySuccess = ratingCalculator.sortItemsByCriteria(
    allItems,
    'successRate',
    'asc'
);

// Available criteria: 'rating', 'profit', 'purchases', 'successRate', 'profitMargin'
// Available orders: 'desc', 'asc'
```

## Data Management

### Save and Load

```javascript
// Load statistics (automatic on module initialization)
const data = statisticsDataStore.loadStatistics();

// Manual save (automatic on every update)
statisticsDataStore.saveStatistics(data);
```

### Backups

```javascript
// Create timestamped backup
const backupPath = statisticsDataStore.createBackup(true);
console.log(`Backup created: ${backupPath}`);

// Create simple backup
statisticsDataStore.createBackup(false);

// Restore from backup
const restoredData = statisticsDataStore.restoreFromBackup();

// Get available backups
const backups = statisticsDataStore.getAvailableBackups();
console.log('Available backups:', backups);
```

### Data Cleanup

```javascript
// Remove data older than 90 days
statisticsDataStore.cleanupOldData(90);

// Optimize data files (remove duplicates, compress)
const optimizationReport = statisticsDataStore.optimizeDataFiles();
console.log(optimizationReport);
// {
//   originalSize: 1000000,
//   optimizedSize: 800000,
//   spaceSaved: 200000,
//   duplicatesRemoved: 15,
//   timestamp: '2026-01-10T15:00:00Z'
// }
```

### Integrity Checks

```javascript
// Perform full integrity check
const integrityReport = statisticsDataStore.performIntegrityCheck();
console.log(integrityReport);

// Detect corruption and recover
const recoveredData = statisticsDataStore.detectCorruptionAndRecover();

// Validate specific file
const isValid = statisticsDataStore.validateFile(
    'agent/botapp/purchaseStatistics.json'
);
```

### Disk Usage

```javascript
const diskStats = statisticsDataStore.getDiskUsageStats();
console.log(diskStats);
// {
//   mainFile: { path: '...', size: 1000000, exists: true },
//   mainBackup: { path: '...', size: 1000000, exists: true },
//   timestampedBackups: [...],
//   archives: [...],
//   totalSize: 5000000,
//   timestamp: '2026-01-10T15:00:00Z'
// }
```

### Archiving

```javascript
// Archive data for a specific period
const archivePath = statisticsDataStore.archiveDataForPeriod(
    new Date('2025-01-01'),
    new Date('2025-12-31'),
    true  // remove from main file
);

console.log(`Archive created: ${archivePath}`);
```

## HTTP API Examples

### Using cURL

```bash
# Get overall statistics
curl http://localhost:4000/api/statistics/overall

# Get top 10 items by rating
curl http://localhost:4000/api/statistics/top-items?limit=10&criteria=rating

# Get top 5 items by profit
curl http://localhost:4000/api/statistics/top-items?limit=5&criteria=profit

# Get statistics for specific item
curl http://localhost:4000/api/statistics/item/diamond_sword_001

# Get statistics for time period
curl "http://localhost:4000/api/statistics/period?start=2026-01-01T00:00:00Z&end=2026-01-31T23:59:59Z"

# Get profit trends by day
curl http://localhost:4000/api/statistics/profit-trends?period=day

# Get profit trends by week
curl http://localhost:4000/api/statistics/profit-trends?period=week
```

### Using JavaScript fetch

```javascript
// Get overall statistics
fetch('http://localhost:4000/api/statistics/overall')
    .then(res => res.json())
    .then(data => console.log(data));

// Get top items
fetch('http://localhost:4000/api/statistics/top-items?limit=10&criteria=rating')
    .then(res => res.json())
    .then(items => {
        items.forEach(item => {
            console.log(`${item.itemName}: ${item.rating} stars, $${item.totalProfit} profit`);
        });
    });

// Get item statistics
fetch('http://localhost:4000/api/statistics/item/diamond_sword_001')
    .then(res => res.json())
    .then(stats => {
        console.log(`Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
        console.log(`Profit Margin: ${(stats.profitMargin * 100).toFixed(1)}%`);
    });

// Get period statistics
const startDate = new Date('2026-01-01').toISOString();
const endDate = new Date('2026-01-31').toISOString();

fetch(`http://localhost:4000/api/statistics/period?start=${startDate}&end=${endDate}`)
    .then(res => res.json())
    .then(data => console.log(data));
```

## Advanced Examples

### Profit Analysis

```javascript
// Calculate profit for a sale
const profit = profitCalculator.calculateProfit(1500, 1000); // 500

// Calculate profit margin
const margin = profitCalculator.calculateProfitMargin(500, 1000); // 50%

// Calculate ROI
const roi = profitCalculator.calculateROI(500, 1000); // 50%

// Get detailed profit statistics
const profitStats = statisticsEngine.getItemProfitStatistics(
    'diamond_sword_001',
    1200  // current market price
);

console.log(profitStats);
// {
//   totalPurchases: 15,
//   totalSales: 12,
//   totalProfit: 6000,
//   averageProfit: 500,
//   totalInvestment: 15000,
//   totalRevenue: 18000,
//   profitMargin: 40,
//   roi: 40,
//   unsoldItems: 3,
//   potentialProfit: 900
// }
```

### Profit Trends

```javascript
// Get daily profit trends
const dailyTrends = statisticsEngine.getProfitTrends('day');

// Get weekly profit trends
const weeklyTrends = statisticsEngine.getProfitTrends('week');

// Get monthly profit trends
const monthlyTrends = statisticsEngine.getProfitTrends('month');

console.log(dailyTrends);
// [
//   {
//     period: '2026-01-10',
//     totalProfit: 2500,
//     totalSales: 15,
//     averageProfit: 166.67,
//     profitMargin: 35.5
//   },
//   ...
// ]
```

### Potential Profit Calculation

```javascript
// Calculate potential profit for unsold items
const currentMarketPrices = {
    'diamond_sword_001': 1200,
    'iron_helmet_002': 800,
    'gold_ingot_003': 150
};

const potentialProfit = statisticsEngine.calculatePotentialProfit(
    currentMarketPrices
);

console.log(potentialProfit);
// {
//   totalUnsoldItems: 25,
//   totalInvestment: 20000,
//   potentialRevenue: 25000,
//   potentialProfit: 5000,
//   potentialROI: 25,
//   items: [...]
// }
```

### Compare Profitability Between Periods

```javascript
// Compare this month vs last month
const thisMonthStart = new Date('2026-01-01');
const thisMonthEnd = new Date('2026-01-31');
const lastMonthStart = new Date('2025-12-01');
const lastMonthEnd = new Date('2025-12-31');

const comparison = statisticsEngine.compareProfitabilityBetweenPeriods(
    thisMonthStart,
    thisMonthEnd,
    lastMonthStart,
    lastMonthEnd
);

console.log(comparison);
// {
//   current: { totalProfit: 15000, totalSales: 50, averageProfit: 300 },
//   previous: { totalProfit: 12000, totalSales: 45, averageProfit: 266.67 },
//   change: {
//     profitChange: 3000,
//     profitChangePercent: 25,
//     salesChange: 5,
//     salesChangePercent: 11.11
//   }
// }
```

### Custom Event Listeners

```javascript
// Add custom event listener for purchases
statisticsCollector.addEventListener('purchase', (purchaseRecord) => {
    console.log(`New purchase: ${purchaseRecord.itemName} for $${purchaseRecord.purchasePrice}`);
    
    // Send notification
    // Update external system
    // Trigger custom logic
});

// Add custom event listener for sales
statisticsCollector.addEventListener('sale', (saleRecord) => {
    console.log(`Item sold: ${saleRecord.itemId} for $${saleRecord.salePrice} (profit: $${saleRecord.profit})`);
});

// Add custom event listener for missed purchases
statisticsCollector.addEventListener('missed_purchase', (missedRecord) => {
    console.log(`Missed purchase: ${missedRecord.itemId} - ${missedRecord.reason}`);
});
```

### Cache Management

```javascript
// Clear cache to force recalculation
statisticsEngine.clearCache();

// Check if cache is valid for a specific key
const cacheKey = 'item_diamond_sword_001';
const isValid = statisticsEngine._isCacheValid(cacheKey);

// Set custom cache value
statisticsEngine._setCacheValue('custom_key', { data: 'value' });
```

### Batch Operations

```javascript
// Record multiple purchases
const purchases = [
    { itemId: 'item1', price: 1000, timestamp: new Date() },
    { itemId: 'item2', price: 1500, timestamp: new Date() },
    { itemId: 'item3', price: 800, timestamp: new Date() }
];

purchases.forEach(purchase => {
    statisticsCollector.recordPurchase(
        purchase.itemId,
        purchase.price,
        purchase.timestamp
    );
});

// Get statistics for multiple items
const itemIds = ['item1', 'item2', 'item3'];
const itemsStats = itemIds.map(itemId => 
    statisticsEngine.getItemStatistics(itemId)
);

// Calculate total profit across all items
const totalProfit = itemsStats.reduce((sum, stats) => 
    sum + stats.totalProfit, 0
);
```

### Error Handling

```javascript
try {
    // Record purchase with validation
    statisticsCollector.recordPurchase('item1', 1000, new Date());
} catch (error) {
    console.error('Failed to record purchase:', error.message);
    // Handle error appropriately
}

try {
    // Load statistics with automatic recovery
    const data = statisticsDataStore.loadStatistics();
} catch (error) {
    console.error('Failed to load statistics:', error.message);
    // Attempt recovery
    const recoveredData = statisticsDataStore.detectCorruptionAndRecover();
}

try {
    // Get statistics for invalid time period
    const stats = statisticsEngine.getStatisticsForPeriod(
        new Date('2026-01-31'),
        new Date('2026-01-01')  // End before start - will throw error
    );
} catch (error) {
    console.error('Invalid time period:', error.message);
}
```

## Integration Examples

### Integration with Bot Events

```javascript
// In ahParseBuy.js - Record purchase
bot.on('purchase_success', (itemData) => {
    statisticsCollector.recordPurchase(
        itemData.itemId,
        itemData.price,
        new Date(),
        {
            itemName: itemData.name,
            enchantments: itemData.enchantments,
            rarity: itemData.rarity
        }
    );
});

// In botapp.js - Record sale
bot.on('sale_complete', (saleData) => {
    statisticsCollector.recordSale(
        saleData.itemId,
        saleData.salePrice,
        saleData.purchasePrice,
        new Date()
    );
});

// Record missed purchase
bot.on('purchase_failed', (failData) => {
    statisticsCollector.recordMissedPurchase(
        failData.itemId,
        failData.reason,
        new Date(),
        failData.attemptedPrice
    );
});
```

### WebSocket Real-time Updates

```javascript
// In controller/index.js
const io = require('socket.io')(server);

// Listen for statistics updates
statisticsCollector.addEventListener('purchase', (record) => {
    io.emit('statistics:update', {
        type: 'purchase',
        data: record
    });
});

statisticsCollector.addEventListener('sale', (record) => {
    io.emit('statistics:update', {
        type: 'sale',
        data: record
    });
});

// Client-side (in statistics.html)
const socket = io();

socket.on('statistics:update', (update) => {
    console.log('Statistics updated:', update);
    // Refresh dashboard
    refreshStatistics();
});
```

## Performance Tips

1. **Use caching**: Statistics Engine caches results for 5 minutes
2. **Batch queries**: Get multiple items at once instead of individual queries
3. **Cleanup regularly**: Run `cleanupOldData()` monthly to maintain performance
4. **Optimize files**: Run `optimizeDataFiles()` to remove duplicates and compress
5. **Use time filters**: Query specific periods instead of all data
6. **Monitor disk usage**: Check `getDiskUsageStats()` periodically

## Common Patterns

### Daily Statistics Report

```javascript
function generateDailyReport() {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    const stats = statisticsEngine.getStatisticsForPeriod(yesterday, today);
    const topItems = statisticsEngine.getTopItems('profit', 5);
    
    console.log('=== Daily Statistics Report ===');
    console.log(`Total Purchases: ${stats.totalPurchases}`);
    console.log(`Total Sales: ${stats.totalSales}`);
    console.log(`Total Profit: $${stats.totalProfit}`);
    console.log(`Success Rate: ${(stats.averageSuccessRate * 100).toFixed(1)}%`);
    console.log('\nTop 5 Items by Profit:');
    topItems.forEach((item, index) => {
        console.log(`${index + 1}. ${item.itemName}: $${item.totalProfit}`);
    });
}

// Run daily at midnight
setInterval(generateDailyReport, 24 * 60 * 60 * 1000);
```

### Alert on Low Success Rate

```javascript
function checkSuccessRate() {
    const overallStats = statisticsEngine.getOverallStatistics();
    
    if (overallStats.averageSuccessRate < 0.5) {
        console.warn(`⚠️ Low success rate: ${(overallStats.averageSuccessRate * 100).toFixed(1)}%`);
        // Send alert notification
    }
}

// Check every hour
setInterval(checkSuccessRate, 60 * 60 * 1000);
```

### Identify Profitable Items

```javascript
function findProfitableItems(minRating = 4.0, minProfit = 1000) {
    const allItems = statisticsEngine.getTopItems('rating', 100);
    
    const profitable = allItems.filter(item => 
        item.rating >= minRating && item.totalProfit >= minProfit
    );
    
    console.log(`Found ${profitable.length} profitable items:`);
    profitable.forEach(item => {
        console.log(`- ${item.itemName}: ${item.rating} stars, $${item.totalProfit} profit`);
    });
    
    return profitable;
}
```

## Conclusion

This API provides comprehensive tools for tracking and analyzing purchase statistics. Use these examples as a starting point and customize them for your specific needs.

For more information, see the main README: `PURCHASE_STATISTICS_README.md`

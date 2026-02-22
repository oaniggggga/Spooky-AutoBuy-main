# Purchase Statistics Module

## Overview

The Purchase Statistics Module is a comprehensive system for tracking, analyzing, and visualizing the effectiveness of automated item purchases in the auction house bot. It provides real-time statistics, profitability analysis, item ratings, and a web-based dashboard for monitoring trading performance.

## Features

- **Real-time Purchase Tracking**: Automatically records all purchases, sales, and missed opportunities
- **Profitability Analysis**: Calculates profit, margins, and ROI for each item
- **Item Rating System**: Assigns 1-5 star ratings based on profitability and success rate
- **Web Dashboard**: Interactive interface for viewing statistics and trends
- **Data Persistence**: Automatic saving with backup and recovery mechanisms
- **Time-based Filtering**: Analyze statistics for specific time periods
- **API Endpoints**: RESTful API for accessing statistics programmatically

## Architecture

The module consists of four main components:

### 1. Statistics Collector
Collects events from the bot system (purchases, sales, missed purchases).

### 2. Statistics Engine
Processes and aggregates data, provides querying capabilities with caching.

### 3. Rating Calculator
Calculates item ratings based on profitability, frequency, and success rate.

### 4. Data Store
Manages data persistence with automatic backups and corruption recovery.

## Installation & Setup

The module is automatically initialized when the bot starts. No additional setup is required.

### Automatic Integration

The statistics module integrates automatically with:
- Purchase events from `ahParseBuy.js`
- Sale events from `botapp.js` (handleSingleSale, handleOfflineSale)
- The web interface via `controller/index.js`

## Usage

### Recording Events

Events are recorded automatically by the bot, but you can also record them manually:

```javascript
const { statisticsCollector } = require('./modules/purchaseStatistics');

// Record a purchase
statisticsCollector.recordPurchase(
    'diamond_sword_123',  // itemId
    1000,                 // price
    new Date(),          // timestamp
    {                    // details (optional)
        itemName: 'Diamond Sword',
        enchantments: ['Sharpness V'],
        rarity: 'legendary'
    }
);

// Record a sale
statisticsCollector.recordSale(
    'diamond_sword_123',  // itemId
    1500,                 // salePrice
    1000,                 // purchasePrice
    new Date()           // timestamp
);

// Record a missed purchase
statisticsCollector.recordMissedPurchase(
    'diamond_sword_123',  // itemId
    'already_sold',       // reason
    new Date(),          // timestamp
    1000                 // attemptedPrice
);
```

### Querying Statistics

```javascript
const { statisticsEngine } = require('./modules/purchaseStatistics');

// Get statistics for a specific item
const itemStats = statisticsEngine.getItemStatistics('diamond_sword_123');
console.log(itemStats);
// Output:
// {
//   itemId: 'diamond_sword_123',
//   itemName: 'Diamond Sword',
//   totalPurchases: 15,
//   totalSales: 12,
//   totalProfit: 6000,
//   averageProfit: 500,
//   profitMargin: 0.4,
//   successRate: 0.75,
//   rating: 4.2,
//   missedPurchases: { total: 5, reasons: { already_sold: 3, too_slow: 2 } },
//   lastActivity: '2026-01-10T15:00:00Z'
// }

// Get overall statistics
const overallStats = statisticsEngine.getOverallStatistics();
console.log(overallStats);
// Output:
// {
//   totalItems: 50,
//   totalPurchases: 200,
//   totalSales: 180,
//   totalProfit: 50000,
//   averageSuccessRate: 0.8
// }

// Get top 10 items by rating
const topItems = statisticsEngine.getTopItems('rating', 10);

// Get top items by profit
const topProfitItems = statisticsEngine.getTopItems('profit', 10);

// Get statistics for a time period
const periodStats = statisticsEngine.getStatisticsForPeriod(
    new Date('2026-01-01'),
    new Date('2026-01-31')
);
```

### Rating System

Items are rated on a scale of 1-5 stars based on:

- **Profitability Ratio** (0-2 points): Higher profit relative to investment
- **Success Rate** (0-1.5 points): Percentage of successful purchases
- **Purchase Frequency** (0-1.5 points): Number of purchases made

```javascript
const { ratingCalculator } = require('./modules/purchaseStatistics');

// Calculate rating for an item
const rating = ratingCalculator.calculateItemRating(itemStats);
console.log(`Rating: ${rating} stars`); // Output: Rating: 4.2 stars

// Get top rated items
const topRated = ratingCalculator.getTopRatedItems(allItems, 10);

// Sort items by different criteria
const sortedByProfit = ratingCalculator.sortItemsByCriteria(allItems, 'profit', 'desc');
const sortedBySuccess = ratingCalculator.sortItemsByCriteria(allItems, 'successRate', 'desc');
```

### Data Management

```javascript
const { statisticsDataStore } = require('./modules/purchaseStatistics');

// Manual save (automatic saves happen on every update)
statisticsDataStore.saveStatistics(data);

// Load statistics
const data = statisticsDataStore.loadStatistics();

// Create a backup
statisticsDataStore.createBackup(true); // timestamped backup

// Restore from backup
const restoredData = statisticsDataStore.restoreFromBackup();

// Cleanup old data (older than 90 days)
statisticsDataStore.cleanupOldData(90);

// Optimize data files (remove duplicates, compress)
const report = statisticsDataStore.optimizeDataFiles();

// Check data integrity
const integrityReport = statisticsDataStore.performIntegrityCheck();

// Detect and recover from corruption
const recoveredData = statisticsDataStore.detectCorruptionAndRecover();

// Get disk usage statistics
const diskStats = statisticsDataStore.getDiskUsageStats();
```

### Profit Calculations

```javascript
const { profitCalculator } = require('./modules/purchaseStatistics');

// Calculate profit
const profit = profitCalculator.calculateProfit(1500, 1000); // 500

// Calculate profit margin
const margin = profitCalculator.calculateProfitMargin(500, 1000); // 50%

// Calculate ROI
const roi = profitCalculator.calculateROI(500, 1000); // 50%

// Calculate average profit
const avgProfit = profitCalculator.calculateAverageProfit([
    { profit: 500 },
    { profit: 600 },
    { profit: 400 }
]); // 500

// Get detailed profit statistics for an item
const profitStats = statisticsEngine.getItemProfitStatistics('diamond_sword_123', 1200);

// Calculate potential profit for unsold items
const potentialProfit = statisticsEngine.calculatePotentialProfit({
    'diamond_sword_123': 1200,
    'iron_helmet_456': 800
});

// Get profit trends over time
const trends = statisticsEngine.getProfitTrends('day'); // or 'week', 'month'
```

## API Endpoints

The module provides RESTful API endpoints accessible through the controller:

### GET /api/statistics/overall
Get overall statistics summary.

**Response:**
```json
{
  "totalItems": 50,
  "totalPurchases": 200,
  "totalSales": 180,
  "totalProfit": 50000,
  "averageSuccessRate": 0.8
}
```

### GET /api/statistics/top-items
Get top items by rating.

**Query Parameters:**
- `limit` (optional): Number of items to return (default: 10)
- `criteria` (optional): Sort criteria - 'rating', 'profit', 'purchases', 'successRate' (default: 'rating')

**Response:**
```json
[
  {
    "itemId": "diamond_sword_123",
    "itemName": "Diamond Sword",
    "totalPurchases": 15,
    "totalSales": 12,
    "totalProfit": 6000,
    "rating": 4.2
  }
]
```

### GET /api/statistics/item/:itemId
Get statistics for a specific item.

**Response:**
```json
{
  "itemId": "diamond_sword_123",
  "itemName": "Diamond Sword",
  "totalPurchases": 15,
  "totalSales": 12,
  "totalProfit": 6000,
  "averageProfit": 500,
  "profitMargin": 0.4,
  "successRate": 0.75,
  "rating": 4.2,
  "missedPurchases": {
    "total": 5,
    "reasons": {
      "already_sold": 3,
      "too_slow": 2
    }
  }
}
```

### GET /api/statistics/period
Get statistics for a time period.

**Query Parameters:**
- `start`: Start date (ISO 8601 format)
- `end`: End date (ISO 8601 format)

**Response:**
```json
{
  "period": {
    "start": "2026-01-01T00:00:00Z",
    "end": "2026-01-31T23:59:59Z",
    "durationDays": 31
  },
  "totalPurchases": 50,
  "totalSales": 45,
  "totalProfit": 15000,
  "uniqueItems": 20,
  "averageSuccessRate": 0.85
}
```

### GET /api/statistics/profit-trends
Get profit trends over time.

**Query Parameters:**
- `period` (optional): Grouping period - 'day', 'week', 'month' (default: 'day')

**Response:**
```json
[
  {
    "period": "2026-01-10",
    "totalProfit": 2500,
    "totalSales": 15,
    "averageProfit": 166.67
  }
]
```

## Web Dashboard

Access the web dashboard at: `http://localhost:4000/statistics.html`

### Features:
- **Overall Statistics**: Total purchases, sales, profit, and success rate
- **Top Items**: View the most profitable items with ratings
- **Time Filters**: Filter statistics by day, week, month, or custom range
- **Real-time Updates**: Dashboard updates automatically via WebSocket
- **Item Details**: Click on items to see detailed statistics
- **Profit Trends**: Visual charts showing profit over time

## Data Storage

### File Locations

- **Main Data**: `agent/botapp/purchaseStatistics.json`
- **Main Backup**: `agent/botapp/purchaseStatistics.json.backup`
- **Timestamped Backups**: `agent/botapp/backups/purchaseStatistics.backup.YYYY-MM-DDTHH-mm-ss-sssZ.json`
- **Archives**: `agent/botapp/backups/archive-*.json`

### Data Structure

```json
{
  "version": "1.0.0",
  "created": "2026-01-10T12:00:00Z",
  "lastModified": "2026-01-10T15:00:00Z",
  "dataIntegrity": "a1b2c3d4",
  "purchases": [
    {
      "id": "purchase_1234567890_abc123",
      "itemId": "diamond_sword_123",
      "itemName": "Diamond Sword",
      "itemDetails": {
        "enchantments": ["Sharpness V"],
        "attributes": {},
        "rarity": "legendary"
      },
      "purchasePrice": 1000,
      "timestamp": "2026-01-10T12:00:00Z",
      "source": "auction_house"
    }
  ],
  "sales": [
    {
      "id": "sale_1234567890_def456",
      "purchaseId": "purchase_1234567890_abc123",
      "itemId": "diamond_sword_123",
      "salePrice": 1500,
      "profit": 500,
      "profitMargin": 0.5,
      "timestamp": "2026-01-10T14:00:00Z",
      "holdingTime": 7200000
    }
  ],
  "missedPurchases": [
    {
      "id": "missed_1234567890_ghi789",
      "itemId": "diamond_sword_123",
      "attemptedPrice": 800,
      "reason": "already_sold",
      "timestamp": "2026-01-10T12:30:00Z",
      "details": ""
    }
  ]
}
```

### Backup Strategy

- **Automatic Backups**: Created every 24 hours
- **Pre-save Backups**: Created before each save operation
- **Maximum Backups**: 10 timestamped backups retained
- **Corruption Recovery**: Automatic detection and recovery from backups

## Performance Optimization

### Caching

The Statistics Engine uses intelligent caching:
- Cache timeout: 5 minutes
- Cached queries: item statistics, overall statistics, top items, period statistics
- Cache is automatically cleared on data updates

### Data Optimization

```javascript
// Optimize data files (remove duplicates, compress)
const report = statisticsDataStore.optimizeDataFiles();
console.log(report);
// Output:
// {
//   originalSize: 1000000,
//   optimizedSize: 800000,
//   spaceSaved: 200000,
//   duplicatesRemoved: 15,
//   timestamp: '2026-01-10T15:00:00Z'
// }

// Cleanup old data
statisticsDataStore.cleanupOldData(90); // Remove data older than 90 days
```

### Time-based Filtering Optimization

For large datasets (>1000 records), the engine uses binary search for efficient time-range queries.

## Error Handling

### Data Corruption

The module includes robust error handling:

```javascript
// Automatic corruption detection and recovery
const data = statisticsDataStore.detectCorruptionAndRecover();

// Manual integrity check
const report = statisticsDataStore.performIntegrityCheck();
console.log(report);
// Output:
// {
//   timestamp: '2026-01-10T15:00:00Z',
//   mainFile: { exists: true, valid: true, size: 1000000 },
//   mainBackup: { exists: true, valid: true, size: 1000000 },
//   timestampedBackups: [...],
//   recommendations: []
// }
```

### Validation

All input data is validated:
- Item IDs must be non-empty strings
- Prices must be positive numbers
- Timestamps are automatically converted to Date objects
- Invalid data throws descriptive errors

## Logging

The module uses the centralized logging system:

```javascript
const { logInfo, logWarn, logError } = require('./logging');

// All operations are logged with category 'statistics'
logInfo('Purchase recorded: diamond_sword_123 for 1000', 'statistics');
logWarn('Cache miss for item: diamond_sword_123', 'statistics');
logError('Failed to save statistics: disk full', 'statistics');
```

## Testing

The module includes comprehensive tests:

### Unit Tests
- `profitCalculator.test.js`: Tests for profit calculations
- Located in `agent/botapp/modules/__tests__/`

### Integration Tests
- `purchaseStatistics.api.test.js`: Tests for API endpoints
- Tests full workflow: record → calculate → query

### Property-Based Tests
- Mathematical calculation correctness
- Data persistence round-trip
- Rating calculation bounds

Run tests:
```bash
npm test
```

## Troubleshooting

### Statistics Not Recording

1. Check if statistics integration is initialized:
```javascript
const { statisticsCollector } = require('./modules/purchaseStatistics');
console.log(statisticsCollector.initialized); // Should be true
```

2. Check logs for errors:
```bash
grep "statistics" agent/botapp/bot.log
```

### Data File Corrupted

Run automatic recovery:
```javascript
const { statisticsDataStore } = require('./modules/purchaseStatistics');
const data = statisticsDataStore.detectCorruptionAndRecover();
```

### Performance Issues

1. Clear cache:
```javascript
statisticsEngine.clearCache();
```

2. Optimize data files:
```javascript
statisticsDataStore.optimizeDataFiles();
```

3. Cleanup old data:
```javascript
statisticsDataStore.cleanupOldData(30); // Keep only last 30 days
```

### Missing Statistics

Check if events are being recorded:
```javascript
const data = statisticsDataStore.loadStatistics();
console.log('Purchases:', data.purchases.length);
console.log('Sales:', data.sales.length);
console.log('Missed:', data.missedPurchases.length);
```

## Best Practices

1. **Regular Backups**: The system creates automatic backups, but you can create manual backups before major operations:
```javascript
statisticsDataStore.createBackup(true);
```

2. **Periodic Cleanup**: Clean up old data regularly to maintain performance:
```javascript
// Run monthly
statisticsDataStore.cleanupOldData(90);
statisticsDataStore.optimizeDataFiles();
```

3. **Monitor Disk Usage**: Check disk usage periodically:
```javascript
const diskStats = statisticsDataStore.getDiskUsageStats();
console.log(`Total size: ${diskStats.totalSize} bytes`);
```

4. **Integrity Checks**: Run integrity checks after system crashes:
```javascript
const report = statisticsDataStore.performIntegrityCheck();
if (report.recommendations.length > 0) {
    console.log('Recommendations:', report.recommendations);
}
```

## Migration & Versioning

The module supports data migration between versions:

- Current version: `1.0.0`
- Automatic migration on load
- Previous version preserved in `previousVersion` field

## Contributing

When extending the module:

1. Add new methods to appropriate classes
2. Update this README with examples
3. Add unit tests for new functionality
4. Update the design document if adding new features
5. Maintain backward compatibility

## License

This module is part of the auction house bot system.

## Support

For issues or questions:
1. Check the logs: `agent/botapp/bot.log`
2. Review the design document: `.kiro/specs/purchase-statistics/design.md`
3. Check the requirements: `.kiro/specs/purchase-statistics/requirements.md`
4. Review test files for usage examples

## Version History

### 1.0.0 (2026-01-10)
- Initial release
- Purchase, sale, and missed purchase tracking
- Item rating system (1-5 stars)
- Web dashboard with real-time updates
- RESTful API endpoints
- Data persistence with backup/recovery
- Profit calculations and trends
- Time-based filtering
- Performance optimizations

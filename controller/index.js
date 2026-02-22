const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const config = require('./config.js');
const { solveCaptcha } = require('./bareApiSolver.js');
const { updatePrice, getPriceSnapshot } = require('./priceStore.js');
const { addApproved, isApproved } = require('./approvedStore.js');
const { planTransfer } = require('./transferPlanner.js');
const { addItem: addFeedItem, getFeed } = require('./itemFeed.js');
const {
    agents,
    registerAgent,
    updateAgentBots,
    removeAgent,
    listAgents,
    setAgentRole
} = require('./agentRegistry.js');

// Import items management functions
const {
    targetItems,
    getItemsWithStatus,
    setItemPurchaseStatus,
    shouldPurchaseItem,
    getStatusManager
} = require('../agent/botapp/modules/items.js');

// Import icon mapper functions
const {
    getMinecraftIconPath,
    getDefaultIconPath,
    hasMinecraftIcon
} = require('../agent/botapp/modules/iconMapper.js');

const {
    statisticsEngine,
    statisticsCollector,
    ratingCalculator,
    statisticsDataStore
} = require('../agent/botapp/modules/purchaseStatistics.js');

let priceUpdaterAgentId = null;

function assignRoles() {
    if (agents.size === 0) {
        priceUpdaterAgentId = null;
        return;
    }

    if (!priceUpdaterAgentId || !agents.has(priceUpdaterAgentId)) {
        priceUpdaterAgentId = agents.keys().next().value;
    }

    for (const [id, ag] of agents.entries()) {
        const base = id === priceUpdaterAgentId ? 'updater' : 'worker';
        const type = ag.auctionType || 'a';
        const desired = `${base}-${type}`;
        if (ag.role !== desired) {
            setAgentRole(ag.socket, desired);
            ag.socket.emit('assignRole', desired);
            console.log(`[IO] role for ${ag.vpsId} -> ${desired}`);
        }
    }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(bodyParser.json());

// Debug middleware для логирования запросов к статическим файлам
app.use((req, res, next) => {
    console.log(`[STATIC] Request: ${req.method} ${req.url}`);
    next();
});

const staticPath = path.join(__dirname, 'webui');
console.log(`[STATIC] Serving static files from: ${staticPath}`);
app.use(express.static(staticPath));

// Проверка существования statistics.html
const statisticsPath = path.join(staticPath, 'statistics.html');
if (fs.existsSync(statisticsPath)) {
    const stats = fs.statSync(statisticsPath);
    console.log(`[STATIC] statistics.html found: ${statisticsPath} (${stats.size} bytes)`);
} else {
    console.error(`[STATIC] WARNING: statistics.html NOT FOUND at ${statisticsPath}`);
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[EXPRESS] Unhandled error:', err);
    
    // Handle JSON parsing errors
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            error: 'Неверный формат JSON в запросе',
            code: 'INVALID_JSON'
        });
    }
    
    // Handle other errors
    res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const pendingApprove = new Map();

io.on('connection', socket => {
    const { vpsId } = socket.handshake.auth || {};
    console.log(`[IO] ${vpsId} connected (${socket.id})`);

    socket.on('agent:hello', info => {
        registerAgent(socket, { vpsId, ...info });
        assignRoles();
        console.log(`[IO] agent registered ${vpsId}`);
    });

    socket.on('bots:update', bots => updateAgentBots(socket, bots));

    socket.on('log', msg => {
        const prefix = vpsId ? `[${vpsId}]` : '[agent]';
        console.log(prefix, msg.level, msg.category, msg.message);
    });

    socket.on('approve:request', ({ id, botName, vpsId: reqVpsId }) => {
        const machineId = reqVpsId || vpsId;
        if (isApproved(machineId)) {
            socket.emit('approve:answer', { t: 'approve:answer', id, ok: true });
        } else {
            pendingApprove.set(id, { socketId: socket.id, botName, vpsId: machineId });
        }
    });

    socket.on('captcha:request', async ({ id, botName, png }) => {
        if (!png) return;
        console.log(`[captcha] request from ${botName} (${id})`);
        try {
            const answer = await solveCaptcha(png);
            console.log(`[captcha] answer for ${botName}: ${answer}`);
            socket.emit('captcha:answer', { t: 'captcha:answer', id, answer });
        } catch (err) {
            console.error('[captcha] API error:', err.message);
        }
    });

    socket.on('price:update', p => {
        if (updatePrice(p)) io.emit('price:broadcast', getPriceSnapshot());
    });

    // WebSocket events for item management
    socket.on('item:listed', (data) => {
        // Broadcast when an item is listed on auction house
        io.emit('itemListed', {
            itemId: data.itemId,
            itemName: data.itemName,
            botUsername: data.botUsername,
            price: data.price,
            timestamp: new Date().toISOString(),
            ...data
        });
        console.log(`[WS] Item listed: ${data.itemName} by ${data.botUsername} for ${data.price}`);
    });

    socket.on('item:sold', (data) => {
        // Broadcast when an item is sold
        io.emit('itemSold', {
            itemId: data.itemId,
            itemName: data.itemName,
            botUsername: data.botUsername,
            soldPrice: data.soldPrice,
            buyer: data.buyer,
            timestamp: new Date().toISOString(),
            ...data
        });
        console.log(`[WS] Item sold: ${data.itemName} by ${data.botUsername} for ${data.soldPrice} to ${data.buyer}`);
    });

    socket.on('price:item:update', (data) => {
        // Broadcast when item prices change
        io.emit('priceUpdated', {
            itemId: data.itemId,
            itemName: data.itemName,
            oldPrice: data.oldPrice,
            newPrice: data.newPrice,
            priceChange: data.newPrice - data.oldPrice,
            priceChangePercent: data.oldPrice ? ((data.newPrice - data.oldPrice) / data.oldPrice * 100).toFixed(2) : null,
            timestamp: new Date().toISOString(),
            ...data
        });
        console.log(`[WS] Price updated: ${data.itemName} from ${data.oldPrice} to ${data.newPrice}`);
    });

    socket.on('disconnect', () => {
        if (priceUpdaterAgentId === socket.id) priceUpdaterAgentId = null;
        removeAgent(socket);
        assignRoles();
        console.log(`[IO] ${vpsId} disconnected`);
    });
});

app.get('/api/agents', (_, res) => res.json(listAgents()));
app.get('/api/price', (_, res) => res.json(getPriceSnapshot()));
app.post('/api/chat', (req, res) => {
    const { bot, message } = req.body || {};
    if (bot && message) io.emit('chat', { bot, message });
    res.json({ ok: true });
});

app.post('/api/transfer', (req, res) => {
    const { an, recipient, amount } = req.body || {};
    const amt = parseInt(amount, 10);
    if (!(an && recipient && amt > 0)) {
        return res.status(400).json({ ok: false });
    }

    const tasksBySocket = planTransfer(agents, an, recipient, amt);
    if (!tasksBySocket) {
        return res.status(400).json({ ok: false, error: 'insufficient funds' });
    }

    for (const [socket, tasks] of tasksBySocket.entries()) {
        socket.emit('transfer', { tasks });
    }

    res.json({ ok: true });
});

app.get('/api/approvals', (_, res) => {
    const list = Array.from(pendingApprove.entries()).map(([id, info]) => ({
        id,
        botName: info.botName,
        vpsId: info.vpsId
    }));
    res.json(list);
});

app.post('/api/approve', (req, res) => {
    const { id } = req.body || {};
    const info = pendingApprove.get(id);
    if (!info) return res.status(404).json({ ok: false });
    io.to(info.socketId).emit('approve:answer', { t: 'approve:answer', id, ok: true });
    pendingApprove.delete(id);
    addApproved(info.vpsId);
    res.json({ ok: true });
});

app.post('/api/start', (req, res) => {
    const { username } = req.body || {};
    if (username && priceUpdaterAgentId) {
        io.to(priceUpdaterAgentId).emit('startBotPair', { username });
    }
    res.json({ ok: true });
});

app.get('/api/feed', (_, res) => {
    res.json(getFeed());
});

app.post('/api/feed', (req, res) => {
    const { id, price, sellPrice } = req.body || {};
    const p = parseFloat(price);
    const s = parseFloat(sellPrice);
    if (!id || Number.isNaN(p) || Number.isNaN(s)) {
        return res.status(400).json({ ok: false });
    }
    addFeedItem({ id, price: p, sellPrice: s, timestamp: Date.now() });
    io.emit('feed:new', { id, price: p, sellPrice: s });
    res.json({ ok: true });
});

// Item Management API Endpoints

/**
 * GET /api/items - Get all items with their statuses and prices
 */
app.get('/api/items', (req, res) => {
    try {
        const items = getItemsWithStatus();
        
        // Add icon availability information
        const itemsWithIcons = items.map(item => ({
            ...item,
            hasIcon: hasMinecraftIcon(item.name),
            // Format prices with thousand separators for display
            formattedBuyPrice: item.buyPrice ? item.buyPrice.toLocaleString('ru-RU') : null,
            formattedSellPrice: item.sellPrice ? item.sellPrice.toLocaleString('ru-RU') : null,
            formattedAbsoluteMinUnitPrice: item.absoluteMinUnitPrice ? item.absoluteMinUnitPrice.toLocaleString('ru-RU') : null
        }));
        
        res.json({
            success: true,
            items: itemsWithIcons,
            count: itemsWithIcons.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Error getting items:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при загрузке предметов',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/items/:id/status - Change item purchase status
 */
app.post('/api/items/:id/status', (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body || {};
        
        // Validate request
        if (!id || id.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'ID предмета обязателен',
                code: 'MISSING_ITEM_ID'
            });
        }
        
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'Поле enabled должно быть булевым значением (true/false)',
                code: 'INVALID_ENABLED_TYPE'
            });
        }
        
        // Check if item exists
        const items = getItemsWithStatus();
        const item = items.find(item => item.id === id);
        if (!item) {
            return res.status(404).json({
                success: false,
                error: `Предмет с ID "${id}" не найден`,
                code: 'ITEM_NOT_FOUND'
            });
        }
        
        // Check if status is already the same
        if (item.enabled === enabled) {
            return res.json({
                success: true,
                itemId: id,
                enabled,
                message: `Предмет ${item.displayName} уже ${enabled ? 'включен' : 'отключен'}`,
                noChange: true
            });
        }
        
        // Update item status
        setItemPurchaseStatus(id, enabled);
        
        // Additional audit logging at API level
        const timestamp = new Date().toISOString();
        console.log(`[AUDIT] ${timestamp} - Item status change via API: ${item.displayName} (${id}) set to ${enabled ? 'enabled' : 'disabled'}`);
        
        // Broadcast update via WebSocket
        io.emit('itemStatusChanged', { 
            itemId: id, 
            enabled,
            displayName: item.displayName,
            timestamp
        });
        
        console.log(`[API] Item ${id} (${item.displayName}) status changed to ${enabled ? 'enabled' : 'disabled'}`);
        
        res.json({
            success: true,
            itemId: id,
            enabled,
            displayName: item.displayName,
            message: `Предмет ${item.displayName} ${enabled ? 'включен' : 'отключен'} для покупки`,
            timestamp
        });
        
    } catch (error) {
        console.error('[API] Error updating item status:', error);
        
        // Determine error type and provide appropriate response
        let statusCode = 500;
        let errorMessage = 'Внутренняя ошибка сервера при изменении статуса предмета';
        let errorCode = 'INTERNAL_ERROR';
        
        if (error.message.includes('permission')) {
            statusCode = 403;
            errorMessage = 'Недостаточно прав для изменения статуса предмета';
            errorCode = 'PERMISSION_DENIED';
        } else if (error.message.includes('file') || error.message.includes('ENOENT')) {
            statusCode = 503;
            errorMessage = 'Временная недоступность сервиса. Попробуйте позже';
            errorCode = 'SERVICE_UNAVAILABLE';
        }
        
        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            code: errorCode,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/items/icons/:itemName - Get item icon
 */
app.get('/api/items/icons/:itemName', (req, res) => {
    try {
        const { itemName } = req.params;
        
        if (!itemName || itemName.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Название предмета обязательно',
                code: 'MISSING_ITEM_NAME'
            });
        }
        
        // Sanitize item name to prevent path traversal
        const sanitizedItemName = itemName.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        // Try to get the specific icon for this item
        const iconPath = getMinecraftIconPath(sanitizedItemName);
        
        if (iconPath && fs.existsSync(iconPath)) {
            // Set appropriate headers for image serving
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
            res.setHeader('X-Icon-Type', 'specific');
            res.sendFile(path.resolve(iconPath));
        } else {
            // Fallback to default icon
            const defaultIconPath = getDefaultIconPath();
            if (fs.existsSync(defaultIconPath)) {
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache default icon for 1 hour
                res.setHeader('X-Icon-Type', 'default');
                res.sendFile(path.resolve(defaultIconPath));
            } else {
                // If even default icon is missing, return a 404 with helpful message
                res.status(404).json({
                    success: false,
                    error: 'Иконка не найдена',
                    code: 'ICON_NOT_FOUND',
                    message: `Иконка для предмета "${itemName}" недоступна, и иконка по умолчанию также отсутствует`
                });
            }
        }
        
    } catch (error) {
        console.error('[API] Error serving icon:', error);
        
        let statusCode = 500;
        let errorMessage = 'Ошибка при загрузке иконки';
        let errorCode = 'ICON_LOAD_ERROR';
        
        if (error.code === 'ENOENT') {
            statusCode = 404;
            errorMessage = 'Файл иконки не найден';
            errorCode = 'ICON_FILE_NOT_FOUND';
        } else if (error.code === 'EACCES') {
            statusCode = 403;
            errorMessage = 'Нет доступа к файлу иконки';
            errorCode = 'ICON_ACCESS_DENIED';
        }
        
        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            code: errorCode,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/items/listed - Get currently listed items from auction house
 */
app.get('/api/items/listed', (req, res) => {
    try {
        const { botUsername } = req.query;
        
        // If no specific bot username provided, get listings from all bots
        if (!botUsername) {
            // Get all listed items from all bots
            const { loadListedItems } = require('../agent/botapp/modules/listedItemsStore.js');
            const fs = require('fs');
            const path = require('path');
            
            const listedItemsPath = path.join(__dirname, '..', 'agent', 'botapp', 'listedItems.json');
            
            if (!fs.existsSync(listedItemsPath)) {
                return res.json({
                    success: true,
                    listedItems: [],
                    count: 0,
                    timestamp: new Date().toISOString(),
                    message: 'Нет данных о выставленных предметах'
                });
            }
            
            const allListedItems = JSON.parse(fs.readFileSync(listedItemsPath, 'utf8'));
            
            // Flatten all bot listings into a single array with bot info
            const flattenedItems = [];
            for (const [botName, items] of Object.entries(allListedItems)) {
                items.forEach(item => {
                    flattenedItems.push({
                        ...item,
                        botUsername: botName,
                        // Add formatted prices for display
                        formattedPrice: item.price ? item.price.toLocaleString('ru-RU') : null,
                        // Add time since listing
                        timeSinceListing: item.listedAt ? Date.now() - item.listedAt : null
                    });
                });
            }
            
            // Sort by listing time (newest first)
            flattenedItems.sort((a, b) => (b.listedAt || 0) - (a.listedAt || 0));
            
            return res.json({
                success: true,
                listedItems: flattenedItems,
                count: flattenedItems.length,
                botCount: Object.keys(allListedItems).length,
                timestamp: new Date().toISOString()
            });
        }
        
        // Get listings for specific bot
        const { loadListedItems } = require('../agent/botapp/modules/listedItemsStore.js');
        const listedItems = loadListedItems(botUsername);
        
        // Add formatted data for display
        const enhancedItems = listedItems.map(item => ({
            ...item,
            botUsername,
            formattedPrice: item.price ? item.price.toLocaleString('ru-RU') : null,
            timeSinceListing: item.listedAt ? Date.now() - item.listedAt : null
        }));
        
        res.json({
            success: true,
            listedItems: enhancedItems,
            count: enhancedItems.length,
            botUsername,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[API] Error getting listed items:', error);
        
        let statusCode = 500;
        let errorMessage = 'Внутренняя ошибка сервера при загрузке выставленных предметов';
        let errorCode = 'INTERNAL_ERROR';
        
        if (error.code === 'ENOENT') {
            statusCode = 404;
            errorMessage = 'Файл с данными о выставленных предметах не найден';
            errorCode = 'LISTED_ITEMS_FILE_NOT_FOUND';
        } else if (error instanceof SyntaxError) {
            statusCode = 500;
            errorMessage = 'Ошибка в формате данных о выставленных предметах';
            errorCode = 'LISTED_ITEMS_PARSE_ERROR';
        }
        
        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            code: errorCode,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * DELETE /api/items/:id/listing - Remove item from auction house
 */
app.delete('/api/items/:id/listing', (req, res) => {
    try {
        const { id } = req.params;
        const { botUsername } = req.body || {};
        
        // Validate request
        if (!id || id.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'ID предмета обязателен',
                code: 'MISSING_ITEM_ID'
            });
        }
        
        if (!botUsername || botUsername.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Имя бота обязательно для удаления предмета с аукциона',
                code: 'MISSING_BOT_USERNAME'
            });
        }
        
        const { loadListedItems, saveListedItems } = require('../agent/botapp/modules/listedItemsStore.js');
        
        // Load current listings for the bot
        const currentListings = loadListedItems(botUsername);
        
        // Find the item to remove
        const itemIndex = currentListings.findIndex(item => item.id === id);
        
        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                error: `Предмет с ID "${id}" не найден в списке выставленных предметов бота ${botUsername}`,
                code: 'LISTED_ITEM_NOT_FOUND'
            });
        }
        
        const removedItem = currentListings[itemIndex];
        
        // Remove the item from listings
        currentListings.splice(itemIndex, 1);
        
        // Save updated listings
        saveListedItems(botUsername, currentListings);
        
        // Find the bot socket to send removal command
        const botAgent = Array.from(agents.values()).find(agent => 
            agent.bots && agent.bots.some(bot => bot.username === botUsername)
        );
        
        if (botAgent && botAgent.socket) {
            // Send command to bot to remove item from auction house
            botAgent.socket.emit('removeFromAuction', {
                itemId: id,
                botUsername: botUsername,
                timestamp: new Date().toISOString()
            });
            
            console.log(`[API] Sent remove command to bot ${botUsername} for item ${id}`);
        } else {
            console.warn(`[API] Bot ${botUsername} not found or not connected, item removed from local listings only`);
        }
        
        // Broadcast update via WebSocket
        io.emit('itemDelisted', {
            itemId: id,
            botUsername,
            itemName: removedItem.name || removedItem.displayName,
            timestamp: new Date().toISOString()
        });
        
        // Audit logging
        const timestamp = new Date().toISOString();
        console.log(`[AUDIT] ${timestamp} - Item delisted via API: ${removedItem.name || removedItem.displayName} (${id}) removed from ${botUsername} auction house`);
        
        res.json({
            success: true,
            itemId: id,
            botUsername,
            removedItem: {
                id: removedItem.id,
                name: removedItem.name || removedItem.displayName,
                price: removedItem.price,
                formattedPrice: removedItem.price ? removedItem.price.toLocaleString('ru-RU') : null
            },
            message: `Предмет ${removedItem.name || removedItem.displayName} удален с аукциона бота ${botUsername}`,
            timestamp
        });
        
    } catch (error) {
        console.error('[API] Error removing item from auction house:', error);
        
        let statusCode = 500;
        let errorMessage = 'Внутренняя ошибка сервера при удалении предмета с аукциона';
        let errorCode = 'INTERNAL_ERROR';
        
        if (error.message.includes('permission')) {
            statusCode = 403;
            errorMessage = 'Недостаточно прав для удаления предмета с аукциона';
            errorCode = 'PERMISSION_DENIED';
        } else if (error.code === 'ENOENT') {
            statusCode = 503;
            errorMessage = 'Файл с данными о выставленных предметах недоступен';
            errorCode = 'LISTED_ITEMS_UNAVAILABLE';
        }
        
        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            code: errorCode,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Purchase Statistics API Endpoints

/**
 * GET /api/statistics/overview - Get overall statistics summary
 */
app.get('/api/statistics/overview', (req, res) => {
    try {
        const overallStats = statisticsEngine.getOverallStatistics();
        
        res.json({
            success: true,
            data: {
                ...overallStats,
                // Add formatted values for display
                formattedTotalProfit: overallStats.totalProfit ? overallStats.totalProfit.toLocaleString('ru-RU') : '0',
                successRatePercent: Math.round((overallStats.averageSuccessRate || 0) * 100),
                timestamp: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Error getting statistics overview:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при загрузке общей статистики',
            code: 'STATISTICS_OVERVIEW_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/statistics/items/:itemId - Get statistics for specific item
 */
app.get('/api/statistics/items/:itemId', (req, res) => {
    try {
        const { itemId } = req.params;
        
        if (!itemId || itemId.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'ID предмета обязателен',
                code: 'MISSING_ITEM_ID'
            });
        }

        const itemStats = statisticsEngine.getItemStatistics(itemId);
        
        if (!itemStats || itemStats.totalPurchases === 0) {
            return res.status(404).json({
                success: false,
                error: `Статистика для предмета "${itemId}" не найдена`,
                code: 'ITEM_STATISTICS_NOT_FOUND'
            });
        }

        // Add formatted values for display
        const enhancedStats = {
            ...itemStats,
            formattedTotalProfit: itemStats.totalProfit ? itemStats.totalProfit.toLocaleString('ru-RU') : '0',
            formattedAverageProfit: itemStats.averageProfit ? itemStats.averageProfit.toLocaleString('ru-RU') : '0',
            successRatePercent: Math.round((itemStats.successRate || 0) * 100),
            profitMarginPercent: Math.round((itemStats.profitMargin || 0) * 100),
            ratingStars: '★'.repeat(Math.floor(itemStats.rating || 0)) + '☆'.repeat(5 - Math.floor(itemStats.rating || 0))
        };

        res.json({
            success: true,
            data: enhancedStats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Error getting item statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при загрузке статистики предмета',
            code: 'ITEM_STATISTICS_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/statistics/top-items - Get top items by various criteria
 */
app.get('/api/statistics/top-items', (req, res) => {
    try {
        const { 
            criteria = 'rating', 
            limit = 10,
            order = 'desc'
        } = req.query;

        // Validate parameters
        const validCriteria = ['rating', 'profit', 'purchases', 'successRate', 'profitMargin'];
        if (!validCriteria.includes(criteria)) {
            return res.status(400).json({
                success: false,
                error: `Неверный критерий сортировки. Допустимые значения: ${validCriteria.join(', ')}`,
                code: 'INVALID_CRITERIA'
            });
        }

        const parsedLimit = parseInt(limit, 10);
        if (isNaN(parsedLimit) || parsedLimit <= 0 || parsedLimit > 100) {
            return res.status(400).json({
                success: false,
                error: 'Лимит должен быть числом от 1 до 100',
                code: 'INVALID_LIMIT'
            });
        }

        if (order !== 'asc' && order !== 'desc') {
            return res.status(400).json({
                success: false,
                error: 'Порядок сортировки должен быть "asc" или "desc"',
                code: 'INVALID_ORDER'
            });
        }

        const topItems = statisticsEngine.getTopItems(criteria, parsedLimit);
        
        // Add formatted values for display
        const enhancedItems = topItems.map(item => ({
            ...item,
            formattedTotalProfit: item.totalProfit ? item.totalProfit.toLocaleString('ru-RU') : '0',
            formattedAverageProfit: item.averageProfit ? item.averageProfit.toLocaleString('ru-RU') : '0',
            successRatePercent: Math.round((item.successRate || 0) * 100),
            profitMarginPercent: Math.round((item.profitMargin || 0) * 100),
            ratingStars: '★'.repeat(Math.floor(item.rating || 0)) + '☆'.repeat(5 - Math.floor(item.rating || 0))
        }));

        res.json({
            success: true,
            data: {
                items: enhancedItems,
                criteria,
                limit: parsedLimit,
                order,
                count: enhancedItems.length
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Error getting top items:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при загрузке топ предметов',
            code: 'TOP_ITEMS_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/statistics/period - Get statistics for a specific time period
 */
app.get('/api/statistics/period', (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: 'Параметры startDate и endDate обязательны',
                code: 'MISSING_DATE_PARAMETERS'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                error: 'Неверный формат даты. Используйте ISO 8601 формат (например: 2026-01-01T00:00:00Z)',
                code: 'INVALID_DATE_FORMAT'
            });
        }

        if (start >= end) {
            return res.status(400).json({
                success: false,
                error: 'Начальная дата должна быть раньше конечной даты',
                code: 'INVALID_DATE_RANGE'
            });
        }

        // Limit the period to prevent performance issues
        const maxPeriodDays = 365; // 1 year
        const periodDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
        
        if (periodDays > maxPeriodDays) {
            return res.status(400).json({
                success: false,
                error: `Максимальный период для запроса: ${maxPeriodDays} дней. Запрошенный период: ${periodDays} дней`,
                code: 'PERIOD_TOO_LONG'
            });
        }

        const periodStats = statisticsEngine.getStatisticsForPeriod(start, end);
        
        // Add formatted values for display
        const enhancedStats = {
            ...periodStats,
            formattedTotalProfit: periodStats.totalProfit ? periodStats.totalProfit.toLocaleString('ru-RU') : '0',
            successRatePercent: Math.round((periodStats.averageSuccessRate || 0) * 100),
            items: periodStats.items.map(item => ({
                ...item,
                formattedProfit: item.profit ? item.profit.toLocaleString('ru-RU') : '0',
                formattedTotalInvestment: item.totalInvestment ? item.totalInvestment.toLocaleString('ru-RU') : '0',
                successRatePercent: Math.round((item.successRate || 0) * 100),
                profitMarginPercent: Math.round((item.profitMargin || 0) * 100)
            }))
        };

        res.json({
            success: true,
            data: enhancedStats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Error getting period statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при загрузке статистики за период',
            code: 'PERIOD_STATISTICS_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/statistics/profit/:itemId - Get detailed profit statistics for item
 */
app.get('/api/statistics/profit/:itemId', (req, res) => {
    try {
        const { itemId } = req.params;
        const { currentMarketPrice } = req.query;

        if (!itemId || itemId.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'ID предмета обязателен',
                code: 'MISSING_ITEM_ID'
            });
        }

        let marketPrice = null;
        if (currentMarketPrice) {
            marketPrice = parseFloat(currentMarketPrice);
            if (isNaN(marketPrice) || marketPrice <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Текущая рыночная цена должна быть положительным числом',
                    code: 'INVALID_MARKET_PRICE'
                });
            }
        }

        const profitStats = statisticsEngine.getItemProfitStatistics(itemId, marketPrice);
        
        if (!profitStats) {
            return res.status(404).json({
                success: false,
                error: `Статистика прибыли для предмета "${itemId}" не найдена`,
                code: 'PROFIT_STATISTICS_NOT_FOUND'
            });
        }

        // Add formatted values for display
        const enhancedStats = {
            ...profitStats,
            formattedTotalProfit: profitStats.totalProfit ? profitStats.totalProfit.toLocaleString('ru-RU') : '0',
            formattedAverageProfit: profitStats.averageProfit ? profitStats.averageProfit.toLocaleString('ru-RU') : '0',
            formattedTotalInvestment: profitStats.totalInvestment ? profitStats.totalInvestment.toLocaleString('ru-RU') : '0',
            formattedPotentialProfit: profitStats.potentialProfit ? profitStats.potentialProfit.toLocaleString('ru-RU') : '0',
            profitMarginPercent: Math.round((profitStats.profitMargin || 0) * 100)
        };

        res.json({
            success: true,
            data: enhancedStats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Error getting profit statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при загрузке статистики прибыли',
            code: 'PROFIT_STATISTICS_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/statistics/trends - Get profit trends over time
 */
app.get('/api/statistics/trends', (req, res) => {
    try {
        const { period = 'day' } = req.query;

        const validPeriods = ['day', 'week', 'month'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({
                success: false,
                error: `Неверный период группировки. Допустимые значения: ${validPeriods.join(', ')}`,
                code: 'INVALID_PERIOD'
            });
        }

        const trends = statisticsEngine.getProfitTrends(period);
        
        // Add formatted values for display
        const enhancedTrends = trends.map(trend => ({
            ...trend,
            formattedProfit: trend.profit ? trend.profit.toLocaleString('ru-RU') : '0',
            formattedAverageProfit: trend.averageProfit ? trend.averageProfit.toLocaleString('ru-RU') : '0'
        }));

        res.json({
            success: true,
            data: {
                trends: enhancedTrends,
                period,
                count: enhancedTrends.length
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Error getting profit trends:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при загрузке трендов прибыли',
            code: 'PROFIT_TRENDS_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/statistics/record/purchase - Record a new purchase
 */
app.post('/api/statistics/record/purchase', (req, res) => {
    try {
        const { itemId, price, timestamp, details } = req.body || {};

        // Validate required fields
        if (!itemId || typeof itemId !== 'string' || itemId.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'ID предмета обязателен и должен быть непустой строкой',
                code: 'INVALID_ITEM_ID'
            });
        }

        if (!price || typeof price !== 'number' || price <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Цена обязательна и должна быть положительным числом',
                code: 'INVALID_PRICE'
            });
        }

        // Record the purchase
        const purchaseRecord = statisticsCollector.recordPurchase(
            itemId.trim(),
            price,
            timestamp || new Date(),
            details || {}
        );

        // Update statistics
        statisticsEngine.updateStatistics({
            type: 'purchase',
            ...purchaseRecord
        });

        // Broadcast update via WebSocket
        io.emit('statisticsUpdated', {
            type: 'purchase',
            itemId: itemId.trim(),
            itemName: details?.itemName || itemId,
            price,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            data: {
                id: purchaseRecord.id,
                itemId: purchaseRecord.itemId,
                itemName: purchaseRecord.itemName,
                price: purchaseRecord.purchasePrice,
                formattedPrice: purchaseRecord.purchasePrice.toLocaleString('ru-RU'),
                timestamp: purchaseRecord.timestamp
            },
            message: `Покупка предмета ${purchaseRecord.itemName} записана успешно`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Error recording purchase:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при записи покупки',
            code: 'RECORD_PURCHASE_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/statistics/record/sale - Record a new sale
 */
app.post('/api/statistics/record/sale', (req, res) => {
    try {
        const { itemId, salePrice, purchasePrice, timestamp } = req.body || {};

        // Validate required fields
        if (!itemId || typeof itemId !== 'string' || itemId.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'ID предмета обязателен и должен быть непустой строкой',
                code: 'INVALID_ITEM_ID'
            });
        }

        if (!salePrice || typeof salePrice !== 'number' || salePrice <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Цена продажи обязательна и должна быть положительным числом',
                code: 'INVALID_SALE_PRICE'
            });
        }

        if (!purchasePrice || typeof purchasePrice !== 'number' || purchasePrice <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Цена покупки обязательна и должна быть положительным числом',
                code: 'INVALID_PURCHASE_PRICE'
            });
        }

        // Record the sale
        const saleRecord = statisticsCollector.recordSale(
            itemId.trim(),
            salePrice,
            purchasePrice,
            timestamp || new Date()
        );

        // Update statistics
        statisticsEngine.updateStatistics({
            type: 'sale',
            ...saleRecord
        });

        // Broadcast update via WebSocket
        io.emit('statisticsUpdated', {
            type: 'sale',
            itemId: itemId.trim(),
            salePrice,
            purchasePrice,
            profit: saleRecord.profit,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            data: {
                id: saleRecord.id,
                itemId: saleRecord.itemId,
                salePrice: saleRecord.salePrice,
                profit: saleRecord.profit,
                profitMargin: saleRecord.profitMargin,
                formattedSalePrice: saleRecord.salePrice.toLocaleString('ru-RU'),
                formattedProfit: saleRecord.profit.toLocaleString('ru-RU'),
                profitMarginPercent: Math.round(saleRecord.profitMargin * 100),
                timestamp: saleRecord.timestamp
            },
            message: `Продажа предмета записана успешно. Прибыль: ${saleRecord.profit.toLocaleString('ru-RU')}`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Error recording sale:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при записи продажи',
            code: 'RECORD_SALE_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/statistics/record/missed-purchase - Record a missed purchase
 */
app.post('/api/statistics/record/missed-purchase', (req, res) => {
    try {
        const { itemId, reason, timestamp, attemptedPrice } = req.body || {};

        // Validate required fields
        if (!itemId || typeof itemId !== 'string' || itemId.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'ID предмета обязателен и должен быть непустой строкой',
                code: 'INVALID_ITEM_ID'
            });
        }

        if (!reason || typeof reason !== 'string' || reason.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Причина пропуска обязательна и должна быть непустой строкой',
                code: 'INVALID_REASON'
            });
        }

        const validReasons = ['already_sold', 'too_slow', 'insufficient_funds', 'other'];
        if (!validReasons.includes(reason)) {
            return res.status(400).json({
                success: false,
                error: `Неверная причина пропуска. Допустимые значения: ${validReasons.join(', ')}`,
                code: 'INVALID_REASON_VALUE'
            });
        }

        // Record the missed purchase
        const missedRecord = statisticsCollector.recordMissedPurchase(
            itemId.trim(),
            reason,
            timestamp || new Date(),
            attemptedPrice || 0
        );

        // Update statistics
        statisticsEngine.updateStatistics({
            type: 'missed_purchase',
            ...missedRecord
        });

        // Broadcast update via WebSocket
        io.emit('statisticsUpdated', {
            type: 'missed_purchase',
            itemId: itemId.trim(),
            reason,
            attemptedPrice: attemptedPrice || 0,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            data: {
                id: missedRecord.id,
                itemId: missedRecord.itemId,
                reason: missedRecord.reason,
                attemptedPrice: missedRecord.attemptedPrice,
                formattedAttemptedPrice: missedRecord.attemptedPrice ? missedRecord.attemptedPrice.toLocaleString('ru-RU') : '0',
                timestamp: missedRecord.timestamp
            },
            message: `Пропущенная покупка предмета записана успешно`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Error recording missed purchase:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при записи пропущенной покупки',
            code: 'RECORD_MISSED_PURCHASE_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * DELETE /api/statistics/cache - Clear statistics cache
 */
app.delete('/api/statistics/cache', (req, res) => {
    try {
        statisticsEngine.clearCache();
        
        res.json({
            success: true,
            message: 'Кэш статистики очищен успешно',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Error clearing statistics cache:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при очистке кэша',
            code: 'CLEAR_CACHE_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Health check endpoint for monitoring
// Обновленный health check endpoint
app.get('/api/health', (req, res) => {
    try {
        const statusManager = getStatusManager();
        const items = getItemsWithStatus();
        
        // Check statistics service health
        let statisticsHealth = 'operational';
        try {
            const overallStats = statisticsEngine.getOverallStatistics();
            if (!overallStats) {
                statisticsHealth = 'degraded';
            }
        } catch (error) {
            statisticsHealth = 'failed';
        }
        
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                itemManagement: 'operational',
                statusManager: statusManager ? 'operational' : 'degraded',
                iconService: 'operational',
                statisticsService: statisticsHealth
            },
            stats: {
                totalItems: items.length,
                enabledItems: items.filter(item => item.enabled).length,
                disabledItems: items.filter(item => !item.enabled).length
            }
        });
    } catch (error) {
        console.error('[API] Health check failed:', error);
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: 'Сервис временно недоступен',
            timestamp: new Date().toISOString()
        });
    }
});

server.listen(config.port, () =>
    console.log(`Controller listening on :${config.port}`)
);

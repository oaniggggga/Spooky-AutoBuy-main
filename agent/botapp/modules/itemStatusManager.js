const fs = require('fs');
const path = require('path');

/**
 * ItemStatusManager - управляет статусами включения/отключения предметов
 * Сохраняет и загружает статусы из JSON файла
 */
class ItemStatusManager {
    constructor(statusFilePath = './itemStatus.json') {
        this.statusFilePath = path.resolve(statusFilePath);
        this.itemStatuses = new Map(); // itemId -> boolean (enabled/disabled)
        this.loadStatuses();
    }

    /**
     * Загружает статусы из JSON файла
     * Если файл не существует, создает пустой Map
     */
    loadStatuses() {
        try {
            if (fs.existsSync(this.statusFilePath)) {
                const data = fs.readFileSync(this.statusFilePath, 'utf8');
                const statusData = JSON.parse(data);
                
                // Конвертируем объект в Map
                this.itemStatuses = new Map(Object.entries(statusData));
                
                console.log(`[ItemStatusManager] Загружены статусы для ${this.itemStatuses.size} предметов`);
            } else {
                console.log('[ItemStatusManager] Файл статусов не найден, создается новый');
                this.itemStatuses = new Map();
                this.saveStatuses(); // Создаем пустой файл
            }
        } catch (error) {
            console.error('[ItemStatusManager] Ошибка при загрузке статусов:', error);
            this.itemStatuses = new Map();
        }
    }

    /**
     * Сохраняет статусы в JSON файл
     */
    saveStatuses() {
        try {
            // Конвертируем Map в объект для JSON
            const statusObject = Object.fromEntries(this.itemStatuses);
            
            // Создаем директорию если не существует
            const dir = path.dirname(this.statusFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.statusFilePath, JSON.stringify(statusObject, null, 2), 'utf8');
            console.log(`[ItemStatusManager] Сохранены статусы для ${this.itemStatuses.size} предметов`);
        } catch (error) {
            console.error('[ItemStatusManager] Ошибка при сохранении статусов:', error);
            throw error;
        }
    }

    /**
     * Устанавливает статус предмета
     * @param {string} itemId - ID предмета
     * @param {boolean} enabled - включен ли предмет
     */
    setItemStatus(itemId, enabled) {
        if (typeof itemId !== 'string' || itemId.trim() === '') {
            throw new Error('itemId должен быть непустой строкой');
        }
        
        if (typeof enabled !== 'boolean') {
            throw new Error('enabled должен быть boolean');
        }
        
        const previousStatus = this.itemStatuses.get(itemId);
        this.itemStatuses.set(itemId, enabled);
        
        // Сохраняем изменения
        this.saveStatuses();
        
        console.log(`[ItemStatusManager] Статус предмета ${itemId}: ${previousStatus} -> ${enabled}`);
    }

    /**
     * Проверяет включен ли предмет
     * @param {string} itemId - ID предмета
     * @returns {boolean} - true если включен, false если отключен, false по умолчанию для новых предметов
     */
    isItemEnabled(itemId) {
        if (typeof itemId !== 'string' || itemId.trim() === '') {
            return false; // По умолчанию предметы отключены
        }
        
        // Если статус не установлен, предмет считается отключенным по умолчанию
        return this.itemStatuses.get(itemId) === true;
    }

    /**
     * Возвращает все статусы
     * @returns {Map<string, boolean>} - Map со всеми статусами
     */
    getAllStatuses() {
        return new Map(this.itemStatuses);
    }

    /**
     * Возвращает количество предметов с установленными статусами
     * @returns {number}
     */
    getStatusCount() {
        return this.itemStatuses.size;
    }

    /**
     * Удаляет статус предмета (предмет будет считаться включенным по умолчанию)
     * @param {string} itemId - ID предмета
     */
    removeItemStatus(itemId) {
        if (this.itemStatuses.has(itemId)) {
            this.itemStatuses.delete(itemId);
            this.saveStatuses();
            console.log(`[ItemStatusManager] Удален статус предмета ${itemId}`);
        }
    }

    /**
     * Очищает все статусы
     */
    clearAllStatuses() {
        this.itemStatuses.clear();
        this.saveStatuses();
        console.log('[ItemStatusManager] Все статусы очищены');
    }
}

module.exports = ItemStatusManager;
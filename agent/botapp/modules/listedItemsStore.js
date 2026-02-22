const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '..', 'listedItems.json');

// Простая блокировка для предотвращения race condition
let isWriting = false;
const writeQueue = [];

function processWriteQueue() {
    if (isWriting || writeQueue.length === 0) return;
    
    isWriting = true;
    const { obj, resolve } = writeQueue.shift();
    
    try {
        fs.writeFileSync(FILE_PATH, JSON.stringify(obj, null, 2), 'utf8');
        resolve(true);
    } catch (err) {
        console.error(`[listedItemsStore] Ошибка записи: ${err.message}`);
        resolve(false);
    } finally {
        isWriting = false;
        // Обрабатываем следующий в очереди
        setImmediate(processWriteQueue);
    }
}

function readListedItemsFile() {
    if (!fs.existsSync(FILE_PATH)) {
        return {};
    }
    try {
        const data = fs.readFileSync(FILE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`[listedItemsStore] Ошибка чтения: ${err.message}`);
        return {};
    }
}


function writeListedItemsFile(obj) {
    return new Promise((resolve) => {
        writeQueue.push({ obj, resolve });
        processWriteQueue();
    });
}


function loadListedItems(botUsername) {
    const all = readListedItemsFile();
    return all[botUsername] || [];
}


async function saveListedItems(botUsername, items) {
    // Атомарное чтение-модификация-запись
    const all = readListedItemsFile();
    all[botUsername] = items;
    await writeListedItemsFile(all);
}

module.exports = {
    loadListedItems,
    saveListedItems
};

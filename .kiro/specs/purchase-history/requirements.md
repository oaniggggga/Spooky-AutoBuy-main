# Requirements Document

## Introduction

Система истории покупок для бота аукциона Minecraft. Функция должна отслеживать все покупки, совершенные ботом, сохранять детальную информацию о каждой транзакции и предоставлять возможности для анализа и просмотра истории.

## Glossary

- **Purchase_History_System**: Система отслеживания истории покупок
- **Purchase_Record**: Запись о покупке предмета
- **Bot**: Minecraft бот, совершающий покупки
- **Auction_House**: Аукционный дом (/ah) в игре
- **Item**: Предмет Minecraft
- **Transaction**: Операция покупки предмета

## Requirements

### Requirement 1

**User Story:** Как разработчик бота, я хочу отслеживать все покупки, совершенные ботом, чтобы анализировать эффективность торговых операций.

#### Acceptance Criteria

1. WHEN бот успешно покупает предмет, THE Purchase_History_System SHALL записать детали покупки
2. WHEN записывается покупка, THE Purchase_History_System SHALL сохранить название предмета, количество, цену, продавца и временную метку
3. WHEN записывается покупка, THE Purchase_History_System SHALL сохранить информацию о боте, совершившем покупку
4. WHEN записывается покупка, THE Purchase_History_System SHALL сохранить номер анархии (AN), где была совершена покупка
5. THE Purchase_History_System SHALL сохранять записи в JSON файл для постоянного хранения

### Requirement 2

**User Story:** Как администратор системы, я хочу просматривать историю покупок, чтобы контролировать активность ботов.

#### Acceptance Criteria

1. THE Purchase_History_System SHALL предоставить функцию для получения всех покупок конкретного бота
2. THE Purchase_History_System SHALL предоставить функцию для получения покупок за определенный период времени
3. WHEN запрашивается история покупок, THE Purchase_History_System SHALL вернуть отсортированные по времени записи
4. THE Purchase_History_System SHALL поддерживать фильтрацию по названию предмета
5. THE Purchase_History_System SHALL поддерживать фильтрацию по диапазону цен

### Requirement 3

**User Story:** Как система аналитики, я хочу получать статистику по покупкам, чтобы оценивать торговую эффективность.

#### Acceptance Criteria

1. THE Purchase_History_System SHALL предоставить функцию для подсчета общего количества покупок
2. THE Purchase_History_System SHALL предоставить функцию для подсчета общей суммы потраченных средств
3. THE Purchase_History_System SHALL предоставить функцию для получения статистики по самым покупаемым предметам
4. THE Purchase_History_System SHALL предоставить функцию для расчета средней цены покупки по предметам
5. THE Purchase_History_System SHALL предоставить функцию для получения статистики покупок по временным периодам

### Requirement 4

**User Story:** Как система управления данными, я хочу обеспечить целостность и производительность хранения истории покупок.

#### Acceptance Criteria

1. THE Purchase_History_System SHALL использовать атомарные операции записи для предотвращения повреждения данных
2. WHEN файл истории покупок не существует, THE Purchase_History_System SHALL создать его автоматически
3. THE Purchase_History_System SHALL ограничивать размер истории максимум 10000 записей на бота
4. WHEN достигается лимит записей, THE Purchase_History_System SHALL удалять самые старые записи
5. THE Purchase_History_System SHALL обрабатывать ошибки чтения/записи файлов корректно

### Requirement 5

**User Story:** Как интеграционная система, я хочу легко интегрировать историю покупок с существующим кодом бота.

#### Acceptance Criteria

1. THE Purchase_History_System SHALL интегрироваться с функцией buyItem в модуле ahParseBuy
2. WHEN покупка подтверждается сообщением "вы успешно купили", THE Purchase_History_System SHALL автоматически записать покупку
3. THE Purchase_History_System SHALL использовать существующую систему логирования для отчетов об ошибках
4. THE Purchase_History_System SHALL следовать архитектурным паттернам существующих модулей (listedItemsStore, priceStore)
5. THE Purchase_History_System SHALL экспортировать функции через module.exports для использования другими модулями
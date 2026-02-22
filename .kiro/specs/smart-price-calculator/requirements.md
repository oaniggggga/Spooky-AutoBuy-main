# Requirements Document

## Introduction

Улучшенная система автоматического расчета цен покупки и продажи на основе рыночных данных с использованием динамических коэффициентов в зависимости от ценового диапазона предметов. Система должна заменить текущую упрощенную логику фиксированных коэффициентов на умную адаптивную систему, которая максимизирует прибыльность торговли.

## Glossary

- **Price_Calculator**: Модуль для расчета цен покупки и продажи
- **Coefficient**: Коэффициент с диапазоном цен и множителями для расчета
- **Market_Price**: Минимальная цена предмета на аукционе
- **Buy_Price**: Цена, по которой бот будет покупать предмет
- **Sell_Price**: Цена, по которой бот будет продавать предмет
- **Profit_Margin**: Процент прибыли от сделки
- **Price_Range**: Диапазон цен (минимум-максимум) для применения коэффициента
- **Coefficient_Manager**: Менеджер для управления коэффициентами

## Requirements

### Requirement 1: Динамическая система коэффициентов

**User Story:** As a trader, I want the system to use different profit margins based on item price ranges, so that I can maximize profitability across different market segments.

#### Acceptance Criteria

1. WHEN calculating prices for items under 1000 coins, THE Price_Calculator SHALL use high-profit coefficients (70% buy, 140% sell)
2. WHEN calculating prices for items between 1000-10000 coins, THE Price_Calculator SHALL use moderate-profit coefficients (75% buy, 125% sell)  
3. WHEN calculating prices for items between 10000-100000 coins, THE Price_Calculator SHALL use stable-profit coefficients (80% buy, 120% sell)
4. WHEN calculating prices for items between 100000-1000000 coins, THE Price_Calculator SHALL use conservative coefficients (85% buy, 115% sell)
5. WHEN calculating prices for items over 1000000 coins, THE Price_Calculator SHALL use minimal-risk coefficients (90% buy, 110% sell)

### Requirement 2: Коэффициенты и расчеты

**User Story:** As a system administrator, I want to manage and configure price coefficients, so that I can adjust trading strategies based on market conditions.

#### Acceptance Criteria

1. THE Coefficient_Manager SHALL load coefficients from configuration file on startup
2. WHEN no configuration file exists, THE Coefficient_Manager SHALL create default coefficients
3. WHEN finding coefficient for a price, THE Price_Calculator SHALL select the first matching price range
4. THE Price_Calculator SHALL calculate buy price as market_price * buy_multiplier rounded to integer
5. THE Price_Calculator SHALL calculate sell price as market_price * sell_multiplier rounded to integer
6. THE Price_Calculator SHALL calculate profit as sell_price - buy_price
7. THE Price_Calculator SHALL calculate profit percentage as (profit / buy_price) * 100

### Requirement 3: Конфигурация и персистентность

**User Story:** As a developer, I want coefficients to be configurable and persistent, so that I can customize trading strategies without code changes.

#### Acceptance Criteria

1. THE Coefficient_Manager SHALL save coefficients to JSON configuration file
2. THE Coefficient_Manager SHALL validate coefficient data on load
3. WHEN coefficient validation fails, THE Coefficient_Manager SHALL reset to default values
4. THE Coefficient_Manager SHALL provide methods to add, remove, and modify coefficients
5. THE Coefficient_Manager SHALL support coefficient export and import functionality

### Requirement 4: Обратная совместимость

**User Story:** As a system maintainer, I want the new price calculator to be compatible with existing code, so that integration is seamless.

#### Acceptance Criteria

1. THE Price_Calculator SHALL maintain the same interface as computeSimplePrice function
2. WHEN called with lots array, THE Price_Calculator SHALL extract minimum unit price
3. WHEN called with empty lots, THE Price_Calculator SHALL use historical price as fallback
4. THE Price_Calculator SHALL return object with absolutePrice, buyPrice, and sellPrice properties
5. WHEN coefficient matching fails, THE Price_Calculator SHALL use fallback multipliers (0.75 buy, 0.95 sell)

### Requirement 5: Валидация и обработка ошибок

**User Story:** As a system operator, I want robust error handling in price calculations, so that the system continues working even with invalid data.

#### Acceptance Criteria

1. WHEN market price is zero or negative, THE Price_Calculator SHALL use historical price fallback
2. WHEN calculated prices are invalid, THE Price_Calculator SHALL return safe fallback values
3. WHEN coefficient file is corrupted, THE Coefficient_Manager SHALL recreate default coefficients
4. THE Price_Calculator SHALL validate that buy_price < sell_price for all calculations
5. THE Price_Calculator SHALL log warnings for invalid price calculations

### Requirement 6: Производительность и оптимизация

**User Story:** As a performance-conscious developer, I want price calculations to be fast and efficient, so that they don't impact system responsiveness.

#### Acceptance Criteria

1. THE Coefficient_Manager SHALL cache loaded coefficients in memory
2. THE Price_Calculator SHALL find matching coefficients in O(n) time complexity
3. WHEN coefficients are updated, THE Coefficient_Manager SHALL update cache immediately
4. THE Price_Calculator SHALL perform calculations without external API calls
5. THE Coefficient_Manager SHALL minimize file I/O operations during normal operation

### Requirement 7: Логирование и мониторинг

**User Story:** As a system administrator, I want detailed logging of price calculations, so that I can monitor and debug trading performance.

#### Acceptance Criteria

1. THE Price_Calculator SHALL log coefficient selection for each calculation
2. THE Price_Calculator SHALL log calculated profit margins and percentages
3. WHEN using fallback values, THE Price_Calculator SHALL log the reason
4. THE Coefficient_Manager SHALL log coefficient loading and validation results
5. THE Price_Calculator SHALL provide debug information for price calculation steps
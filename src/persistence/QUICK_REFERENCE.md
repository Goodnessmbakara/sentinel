# Persistence Quick Reference

## Initialization

```typescript
import { DatabaseConnection } from './persistence';
DatabaseConnection.initialize(); // Call once at startup
```

## Position Tracking

```typescript
import { PositionRepository } from './persistence';
const positionRepo = new PositionRepository();

// Create position
positionRepo.create({
    id: 'pos_123',
    tokenAddress: '0xABC...',
    tokenSymbol: 'WCRO',
    entryPrice: 0.12,
    entryAmount: 1000,
    entryTimestamp: Date.now(),
    status: 'OPEN'
});

// Get open positions
const open = positionRepo.findOpen();

// Close position
positionRepo.close('pos_123', 0.15, 1250, Date.now(), 250, 5);

// Get metrics
const metrics = positionRepo.getMetrics();
// Returns: { totalProfitLoss, totalFeesPaid, totalTrades, winRate, ... }
```

## Trade Signals

```typescript
import { TradeSignalRepository } from './persistence';
const signalRepo = new TradeSignalRepository();

// Log signal
signalRepo.create({
    id: 'sig_456',
    tokenAddress: '0xABC...',
    signalType: 'BUY',
    hypeAnalysis: { signal: 'VALID_BREAKOUT', confidenceScore: 85, ... },
    marketData: { price: 0.12, volume24h: 1000000, ... },
    sentimentData: { sentiment: 'POSITIVE', ... },
    timestamp: Date.now(),
    executed: true
});

// Get noise-detected signals
const noise = signalRepo.findNoiseDetected(50);

// Get statistics
const stats = signalRepo.getStatistics();
// Returns: { totalSignals, noiseDetected, validBreakouts, fakePumps, ... }
```

## Event Logging

```typescript
import { AgentEventRepository } from './persistence';
const eventRepo = new AgentEventRepository();

// Log noise detection
eventRepo.logNoiseDetection('0xToken', 45, 'Bot spam detected');

// Log trade rejection
eventRepo.logTradeRejection('0xToken', 'Low confidence', { score: 45 });

// Log custom event
eventRepo.log('TRADE_EXECUTED', { token: '0xABC', amount: 100 });

// Get recent events
const events = eventRepo.findRecent(50);
```

## Configuration

```typescript
import { ConfigRepository } from './persistence';
import { GUARDIAN_PROFILE } from './models/types';
const configRepo = new ConfigRepository();

// Save
configRepo.save(GUARDIAN_PROFILE);

// Load
const config = configRepo.load();
```

## Chat History

```typescript
import { ChatHistoryRepository } from './persistence';
const chatRepo = new ChatHistoryRepository();

// Add message
chatRepo.add({
    role: 'user',
    content: 'Show positions',
    timestamp: Date.now()
});

// Get history
const history = chatRepo.getAll();
const recent = chatRepo.getRecent(20);
```

## Common Queries

```typescript
// Performance dashboard
const metrics = positionRepo.getMetrics();
const openPositions = positionRepo.findOpen();
const recentTrades = positionRepo.findAll(20);

// Noise analysis
const noisySignals = signalRepo.findNoiseDetected(50);
const noiseCount = eventRepo.getNoiseDetectionCount();

// Signal effectiveness
const stats = signalRepo.getStatistics();
console.log(`Prevented ${stats.noiseDetected} bad trades`);
console.log(`Win rate: ${metrics.winRate}%`);
```

## Cleanup

```typescript
// Delete old data
const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
eventRepo.deleteOlderThan(thirtyDaysAgo);

// Reset (testing only)
DatabaseConnection.reset();
```

## Database File

Location: `./data/sentinel.db`

Inspect: `sqlite3 data/sentinel.db`

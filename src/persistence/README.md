# Persistence Layer for Sentinel AI

This module provides a complete data persistence solution for the Sentinel AI trading system using SQLite (easily upgradeable to PostgreSQL for production).

## Features

- ✅ **Position Tracking**: Track all trading positions with entry/exit data
- ✅ **Trade Signal Logging**: Record all AI-generated trading signals
- ✅ **Event Logging**: Log all agent decisions and system events
- ✅ **User Configuration**: Persist risk profiles and settings
- ✅ **Chat History**: Store conversation history
- ✅ **Performance Metrics**: Calculate P&L, win rate, and other metrics
- ✅ **Noise Detection Logging**: Track prevented trades due to noise detection

## Installation

First, install the required dependencies:

```bash
pnpm install better-sqlite3 @types/better-sqlite3
```

## Quick Start

### 1. Initialize the Database

```typescript
import { DatabaseConnection } from './persistence';

// Initialize database (creates tables automatically)
DatabaseConnection.initialize();
```

### 2. Use Repositories

```typescript
import { 
  PositionRepository, 
  TradeSignalRepository,
  AgentEventRepository 
} from './persistence';

// Create repository instances
const positionRepo = new PositionRepository();
const signalRepo = new TradeSignalRepository();
const eventRepo = new AgentEventRepository();
```

## Usage Examples

### Position Management

```typescript
import { PositionRepository } from './persistence';
import { Position } from './models/types';

const positionRepo = new PositionRepository();

// Create a new position
const position: Position = {
  id: 'pos_123456',
  tokenAddress: '0xABC...',
  tokenSymbol: 'WCRO',
  entryPrice: 0.12,
  entryAmount: 100,
  entryTimestamp: Date.now(),
  status: 'OPEN'
};

positionRepo.create(position);

// Get all open positions
const openPositions = positionRepo.findOpen();
console.log('Open positions:', openPositions);

// Close a position
positionRepo.close(
  'pos_123456',
  0.15,      // exitPrice
  110,       // exitAmount
  Date.now(), // exitTimestamp
  10,        // profitLoss
  0.5        // feePaid
);

// Get performance metrics
const metrics = positionRepo.getMetrics();
console.log('Performance:', {
  totalProfitLoss: metrics.totalProfitLoss,
  winRate: metrics.winRate,
  totalTrades: metrics.totalTrades
});
```

### Trade Signal Logging

```typescript
import { TradeSignalRepository } from './persistence';
import { TradeSignal } from './models/types';

const signalRepo = new TradeSignalRepository();

// Create a trade signal
const signal: TradeSignal = {
  id: 'signal_789',
  tokenAddress: '0xABC...',
  signalType: 'BUY',
  hypeAnalysis: {
    signal: 'VALID_BREAKOUT',
    confidenceScore: 85,
    reasoning: 'High volume with positive sentiment',
    timestamp: Date.now()
  },
  marketData: {
    tokenAddress: '0xABC...',
    price: 0.12,
    volume24h: 1000000,
    volumeTrend: 'RISING',
    timestamp: Date.now()
  },
  sentimentData: {
    tokenSymbol: 'WCRO',
    mentions: 100,
    sentiment: 'POSITIVE',
    sources: ['twitter', 'discord'],
    smartMoneyMentions: 5,
    timestamp: Date.now()
  },
  timestamp: Date.now(),
  executed: true
};

signalRepo.create(signal);

// Get recent signals
const recentSignals = signalRepo.findRecent(20);

// Get noise-detected signals (prevented trades)
const noisySignals = signalRepo.findNoiseDetected(50);
console.log('Trades prevented by noise detection:', noisySignals.length);

// Get signal statistics
const stats = signalRepo.getStatistics();
console.log('Signal Stats:', {
  totalSignals: stats.totalSignals,
  noiseDetected: stats.noiseDetected,
  validBreakouts: stats.validBreakouts,
  fakePumps: stats.fakePumps
});
```

### Event Logging

```typescript
import { AgentEventRepository } from './persistence';

const eventRepo = new AgentEventRepository();

// Log noise detection
eventRepo.logNoiseDetection(
  '0xTokenAddress',
  45, // confidenceScore
  'Social sentiment appears to be bot spam'
);

// Log trade rejection
eventRepo.logTradeRejection(
  '0xTokenAddress',
  'Confidence score too low',
  { minRequired: 90, actual: 45 }
);

// Log custom event
eventRepo.log('TRADE_EXECUTED', {
  tokenAddress: '0xABC...',
  action: 'BUY',
  amount: 100
});

// Get noise detection count
const noiseCount = eventRepo.getNoiseDetectionCount();
console.log('Total noise detections:', noiseCount);

// Get recent events
const recentEvents = eventRepo.findRecent(50);
```

### Configuration Management

```typescript
import { ConfigRepository } from './persistence';
import { GUARDIAN_PROFILE, HUNTER_PROFILE } from './models/types';

const configRepo = new ConfigRepository();

// Save Guardian profile
configRepo.save(GUARDIAN_PROFILE);

// Load saved configuration
const savedConfig = configRepo.load();
if (savedConfig) {
  console.log('Using saved profile:', savedConfig.mode);
}
```

### Chat History

```typescript
import { ChatHistoryRepository } from './persistence';

const chatRepo = new ChatHistoryRepository();

// Add user message
chatRepo.add({
  role: 'user',
  content: 'What is my current portfolio status?',
  timestamp: Date.now()
});

// Add assistant response
chatRepo.add({
  role: 'assistant',
  content: 'You have 3 open positions with total P&L of +$150',
  timestamp: Date.now(),
  actions: JSON.stringify([{
    type: 'position_query',
    details: { count: 3, totalPL: 150 }
  }])
});

// Get all chat history
const history = chatRepo.getAll();

// Get recent messages
const recent = chatRepo.getRecent(20);
```

## Integration with AgentService

To integrate persistence with your existing `AgentService`:

```typescript
import { AgentService } from './execution/agentService';
import { 
  DatabaseConnection,
  PositionRepository,
  TradeSignalRepository,
  AgentEventRepository 
} from './persistence';

// Initialize database
DatabaseConnection.initialize();

// Create repositories
const positionRepo = new PositionRepository();
const signalRepo = new TradeSignalRepository();
const eventRepo = new AgentEventRepository();

// In your AgentService.analyzeAndTrade method:
async function analyzeAndTrade(tokenAddress: string) {
  const decision = await super.analyzeAndTrade(tokenAddress);
  
  // Log the signal
  const signal = createSignalFromDecision(decision);
  signalRepo.create(signal);
  
  if (decision.shouldTrade) {
    // Create position record
    const position = createPositionFromDecision(decision);
    positionRepo.create(position);
    
    // Log event
    eventRepo.log('TRADE_EXECUTED', { tokenAddress, decision });
  } else {
    // Log noise detection
    if (decision.isNoise) {
      eventRepo.logNoiseDetection(
        tokenAddress,
        decision.confidenceScore,
        decision.reasoning
      );
    }
  }
  
  return decision;
}
```

## API Server Integration

Add persistence endpoints to your API server:

```typescript
import express from 'express';
import { PositionRepository, TradeSignalRepository } from './persistence';

const app = express();
const positionRepo = new PositionRepository();
const signalRepo = new TradeSignalRepository();

// Get open positions
app.get('/api/positions', (req, res) => {
  const positions = positionRepo.findOpen();
  res.json(positions);
});

// Get trading history
app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const history = positionRepo.findAll(limit);
  res.json(history);
});

// Get performance metrics
app.get('/api/metrics', (req, res) => {
  const metrics = positionRepo.getMetrics();
  res.json(metrics);
});

// Get recent signals
app.get('/api/signals', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const signals = signalRepo.findRecent(limit);
  res.json(signals);
});

// Get noise detection log
app.get('/api/noise-log', (req, res) => {
  const signals = signalRepo.findNoiseDetected(50);
  res.json(signals);
});
```

## Database Schema

The persistence layer creates the following tables:

### positions
- `id` (TEXT, PRIMARY KEY)
- `token_address` (TEXT)
- `token_symbol` (TEXT)
- `entry_price` (REAL)
- `entry_amount` (REAL)
- `entry_timestamp` (INTEGER)
- `exit_price` (REAL, nullable)
- `exit_amount` (REAL, nullable)
- `exit_timestamp` (INTEGER, nullable)
- `status` (TEXT: 'OPEN' | 'CLOSED')
- `profit_loss` (REAL, nullable)
- `fee_paid` (REAL, nullable)

### trade_signals
- `id` (TEXT, PRIMARY KEY)
- `token_address` (TEXT)
- `signal_type` (TEXT: 'BUY' | 'SELL')
- `signal_classification` (TEXT)
- `confidence_score` (INTEGER)
- `reasoning` (TEXT)
- `market_price` (REAL)
- `market_volume` (REAL)
- `sentiment_score` (INTEGER)
- `timestamp` (INTEGER)
- `executed` (INTEGER: 0 or 1)

### agent_events
- `id` (INTEGER, AUTO INCREMENT)
- `event_type` (TEXT)
- `event_data` (TEXT, JSON)
- `timestamp` (INTEGER)

### user_config
- `id` (INTEGER, always 1)
- `risk_mode` (TEXT: 'GUARDIAN' | 'HUNTER')
- `allowed_tokens` (TEXT, JSON array)
- `min_confidence_score` (INTEGER)
- `stop_loss_percent` (REAL)
- `max_position_size` (REAL)

### chat_history
- `id` (INTEGER, AUTO INCREMENT)
- `role` (TEXT: 'user' | 'assistant')
- `content` (TEXT)
- `timestamp` (INTEGER)
- `actions` (TEXT, JSON, nullable)

## Database Location

The SQLite database is stored at:
```
/your-project-root/data/sentinel.db
```

## Upgrading to PostgreSQL

To upgrade to PostgreSQL for production:

1. Install PostgreSQL driver:
```bash
pnpm install pg @types/pg
```

2. Update `database.ts` to use PostgreSQL connection
3. Update SQL syntax (SQLite and PostgreSQL are mostly compatible)
4. Use environment variables for connection settings

## Maintenance

### Reset Database
```typescript
DatabaseConnection.reset(); // Drops and recreates all tables
```

### Close Connection
```typescript
DatabaseConnection.close(); // Close database connection
```

### Cleanup Old Data
```typescript
// Delete events older than 30 days
const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
eventRepo.deleteOlderThan(thirtyDaysAgo);

// Delete old chat messages
chatRepo.deleteOlderThan(thirtyDaysAgo);
```

## Testing

The repositories include methods for testing:

```typescript
// Clear all data
positionRepo.deleteAll();
signalRepo.deleteAll();
eventRepo.deleteAll();
chatRepo.clear();

// Or reset entire database
DatabaseConnection.reset();
```

## Performance Considerations

- All tables have appropriate indexes for common queries
- Write-Ahead Logging (WAL) mode enabled for better concurrency
- Use transactions for batch operations (future enhancement)
- Regular cleanup of old events/messages recommended

## Requirements Coverage

This persistence layer fulfills the following PRD requirements:

- ✅ **Requirement 8.1**: Record transaction hash, entry price, exit price, and P&L
- ✅ **Requirement 8.2**: Retrieve and display trading history with timestamps
- ✅ **Requirement 8.3**: Calculate total P&L, win rate, and fees paid
- ✅ **Requirement 8.4**: Log noise detection decisions with confidence scores
- ✅ **Property 21**: Trade recording completeness
- ✅ **Property 22**: Trading history completeness
- ✅ **Property 23**: Performance metrics calculation
- ✅ **Property 24**: Noise detection logging

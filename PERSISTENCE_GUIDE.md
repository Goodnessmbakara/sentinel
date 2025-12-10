# Persistence Implementation Guide

This guide shows you how to implement persistence in the Sentinel AI trading system.

## Installation

```bash
pnpm install better-sqlite3 @types/better-sqlite3
```

## What Gets Persisted

The persistence layer tracks:

1. **Trading Positions** - All buy/sell positions with P&L tracking
2. **Trade Signals** - AI-generated signals with confidence scores
3. **Agent Events** - System decisions, noise detection, errors
4. **User Configuration** - Risk profiles (Guardian/Hunter mode)
5. **Chat History** - User conversations with the AI agent

## Step-by-Step Integration

### Step 1: Initialize Database at Startup

In your main application file (`src/api/server.ts` or similar):

```typescript
import { DatabaseConnection } from './persistence';

// Initialize database when server starts
DatabaseConnection.initialize();
console.log('✓ Database initialized');
```

### Step 2: Update AgentService to Log Trades

Add persistence to your `AgentService` class:

```typescript
import { PositionRepository, TradeSignalRepository, AgentEventRepository } from './persistence';

export class AgentService {
    private positionRepo: PositionRepository;
    private signalRepo: TradeSignalRepository;
    private eventRepo: AgentEventRepository;

    constructor(...) {
        // ... existing code ...
        
        // Initialize repositories
        this.positionRepo = new PositionRepository();
        this.signalRepo = new TradeSignalRepository();
        this.eventRepo = new AgentEventRepository();
    }

    async analyzeAndTrade(tokenAddress: string) {
        try {
            // Your existing analysis code
            const marketData = await this.mcpClient.getMarketData(tokenAddress);
            const sentimentData = await this.sentimentService.getSentimentData("TOKEN");
            const analysis = await this.hypeFilter.analyze(marketData, sentimentData);
            const decision = this.riskEvaluator.evaluate(analysis, this.riskProfile, tokenAddress);

            // ✨ NEW: Log the trade signal
            const signal: TradeSignal = {
                id: `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                tokenAddress,
                signalType: decision.action === 'BUY' ? 'BUY' : 'SELL',
                hypeAnalysis: analysis,
                marketData,
                sentimentData,
                timestamp: Date.now(),
                executed: decision.shouldTrade
            };
            this.signalRepo.create(signal);

            if (decision.shouldTrade) {
                // ✨ NEW: Create position record
                const position: Position = {
                    id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    tokenAddress,
                    tokenSymbol: 'TOKEN', // Get from metadata
                    entryPrice: marketData.price,
                    entryAmount: 100, // Your trade size
                    entryTimestamp: Date.now(),
                    status: 'OPEN'
                };
                this.positionRepo.create(position);

                // ✨ NEW: Log trade execution event
                this.eventRepo.log('TRADE_EXECUTED', {
                    positionId: position.id,
                    tokenAddress,
                    action: decision.action,
                    confidenceScore: analysis.confidenceScore
                });

                console.log(`✓ Trade executed and logged: ${position.id}`);
            } else {
                // ✨ NEW: Log noise detection
                if (analysis.signal === 'FAKE_PUMP' || analysis.signal === 'NOISE') {
                    this.eventRepo.logNoiseDetection(
                        tokenAddress,
                        analysis.confidenceScore,
                        analysis.reasoning
                    );
                    console.log('✓ Noise detected and logged');
                }
            }

            return decision;

        } catch (error: any) {
            // ✨ NEW: Log errors
            this.eventRepo.logError(error, { tokenAddress });
            throw error;
        }
    }

    // ✨ NEW: Method to close positions
    async closePosition(positionId: string, exitPrice: number, exitAmount: number) {
        const position = this.positionRepo.findById(positionId);
        if (!position) throw new Error('Position not found');

        const profitLoss = exitAmount - position.entryAmount;
        const feePaid = exitAmount * 0.05; // 5% x402 fee

        this.positionRepo.close(
            positionId,
            exitPrice,
            exitAmount,
            Date.now(),
            profitLoss,
            feePaid
        );

        this.eventRepo.log('POSITION_CLOSED', {
            positionId,
            profitLoss,
            feePaid
        });

        console.log(`✓ Position closed: ${positionId}, P&L: ${profitLoss}`);
    }
}
```

### Step 3: Add API Endpoints for Dashboard

In `src/api/server.ts`:

```typescript
import express from 'express';
import { 
    PositionRepository, 
    TradeSignalRepository, 
    AgentEventRepository 
} from './persistence';

const app = express();
const positionRepo = new PositionRepository();
const signalRepo = new TradeSignalRepository();
const eventRepo = new AgentEventRepository();

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
    res.json({
        totalProfitLoss: metrics.totalProfitLoss,
        totalFeesPaid: metrics.totalFeesPaid,
        totalTrades: metrics.totalTrades,
        winRate: metrics.winRate,
        winningTrades: metrics.winningTrades,
        losingTrades: metrics.losingTrades
    });
});

// Get recent trade signals
app.get('/api/signals', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const signals = signalRepo.findRecent(limit);
    res.json(signals);
});

// Get noise detection log
app.get('/api/noise-log', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const noiseSignals = signalRepo.findNoiseDetected(limit);
    res.json(noiseSignals);
});

// Get signal statistics
app.get('/api/signal-stats', (req, res) => {
    const stats = signalRepo.getStatistics();
    res.json(stats);
});

// Get recent events
app.get('/api/events', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const events = eventRepo.findRecent(limit);
    res.json(events);
});
```

### Step 4: Integrate with SmartWalletService

In `src/execution/smartWalletService.ts`:

```typescript
import { ChatHistoryRepository } from './persistence';

export class SmartWalletService {
    private chatHistoryRepo: ChatHistoryRepository;

    constructor(...) {
        // ... existing code ...
        this.chatHistoryRepo = new ChatHistoryRepository();
        
        // Load chat history from database
        this.loadChatHistory();
    }

    private loadChatHistory(): void {
        const savedHistory = this.chatHistoryRepo.getRecent(50);
        this.chatHistory = savedHistory.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
        console.log(`✓ Loaded ${this.chatHistory.length} chat messages from database`);
    }

    async chat(message: string): Promise<ChatResponse> {
        // Add user message to history
        this.chatHistory.push({ role: 'user', content: message });
        
        // ✨ NEW: Save to database
        this.chatHistoryRepo.add({
            role: 'user',
            content: message,
            timestamp: Date.now()
        });

        // Get AI response
        const response = await this.aiAgent.chat(message, this.chatHistory);

        // Add assistant response to history
        this.chatHistory.push({ role: 'assistant', content: response.message });
        
        // ✨ NEW: Save to database
        this.chatHistoryRepo.add({
            role: 'assistant',
            content: response.message,
            timestamp: Date.now(),
            actions: response.actions ? JSON.stringify(response.actions) : undefined
        });

        return response;
    }
}
```

### Step 5: Add Configuration Persistence

```typescript
import { ConfigRepository } from './persistence';
import { UserRiskProfile } from './models/types';

const configRepo = new ConfigRepository();

// Save configuration when user updates it
function updateRiskProfile(profile: UserRiskProfile) {
    // Update in-memory
    agentService.updateRiskProfile(profile);
    
    // ✨ NEW: Save to database
    configRepo.save(profile);
    console.log('✓ Risk profile saved to database');
}

// Load configuration on startup
function loadSavedConfiguration(): UserRiskProfile | null {
    const savedConfig = configRepo.load();
    if (savedConfig) {
        console.log('✓ Loaded saved configuration:', savedConfig.mode);
        return savedConfig;
    }
    return null;
}
```

## Usage in Dashboard

### React Component Example

```typescript
import { useState, useEffect } from 'react';

function TradingDashboard() {
    const [metrics, setMetrics] = useState(null);
    const [positions, setPositions] = useState([]);
    const [noiseLog, setNoiseLog] = useState([]);

    useEffect(() => {
        // Fetch performance metrics
        fetch('/api/metrics')
            .then(res => res.json())
            .then(setMetrics);

        // Fetch open positions
        fetch('/api/positions')
            .then(res => res.json())
            .then(setPositions);

        // Fetch noise detection log
        fetch('/api/noise-log')
            .then(res => res.json())
            .then(setNoiseLog);
    }, []);

    return (
        <div>
            <h2>Performance</h2>
            <p>Total P&L: ${metrics?.totalProfitLoss}</p>
            <p>Win Rate: {metrics?.winRate}%</p>
            
            <h2>Open Positions ({positions.length})</h2>
            {positions.map(pos => (
                <div key={pos.id}>
                    {pos.tokenSymbol}: ${pos.entryPrice}
                </div>
            ))}

            <h2>Noise Detection Log</h2>
            <p>Prevented {noiseLog.length} bad trades</p>
        </div>
    );
}
```

## Testing the Integration

Run the example to verify everything works:

```bash
ts-node src/persistence/example.ts
```

This will create sample data and show you all the queries.

## Database Location

The SQLite database file is stored at:
```
/your-project/data/sentinel.db
```

You can inspect it with any SQLite browser or command line:
```bash
sqlite3 data/sentinel.db
.tables
SELECT * FROM positions;
```

## Maintenance

### Cleanup old data periodically

```typescript
// Run weekly cleanup
const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
eventRepo.deleteOlderThan(thirtyDaysAgo);
chatHistoryRepo.deleteOlderThan(thirtyDaysAgo);
```

### Reset database (for testing)

```typescript
DatabaseConnection.reset(); // Drops and recreates all tables
```

## Migration to PostgreSQL (Production)

For production deployment, migrate to PostgreSQL:

1. Install: `pnpm install pg @types/pg`
2. Update `DatabaseConnection` class to use PostgreSQL
3. Set environment variables for connection
4. SQL syntax is mostly compatible (minor adjustments needed)

## Summary

You now have:
- ✅ Complete position tracking with P&L
- ✅ Trade signal logging with noise detection
- ✅ Event logging for all agent actions
- ✅ Performance metrics calculation
- ✅ Configuration persistence
- ✅ Chat history storage
- ✅ Dashboard API endpoints

All data is automatically persisted and survives application restarts!

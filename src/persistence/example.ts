/**
 * Example demonstrating the persistence layer usage
 * Run with: ts-node src/persistence/example.ts
 */

import {
    DatabaseConnection,
    PositionRepository,
    TradeSignalRepository,
    AgentEventRepository,
    ConfigRepository,
    ChatHistoryRepository
} from './index';
import { Position, TradeSignal, GUARDIAN_PROFILE, HUNTER_PROFILE } from '../models/types';

async function demonstratePersistence() {
    console.log('🚀 Sentinel AI Persistence Layer Demo\n');

    // 1. Initialize Database
    console.log('1️⃣  Initializing database...');
    DatabaseConnection.initialize();
    console.log('');

    // 2. Create Repositories
    const positionRepo = new PositionRepository();
    const signalRepo = new TradeSignalRepository();
    const eventRepo = new AgentEventRepository();
    const configRepo = new ConfigRepository();
    const chatRepo = new ChatHistoryRepository();

    // 3. Save Configuration
    console.log('2️⃣  Saving user configuration...');
    configRepo.save(GUARDIAN_PROFILE);
    const loadedConfig = configRepo.load();
    console.log('   Saved profile:', loadedConfig?.mode);
    console.log('');

    // 4. Create Sample Positions
    console.log('3️⃣  Creating sample trading positions...');
    
    const position1: Position = {
        id: 'pos_001',
        tokenAddress: '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23',
        tokenSymbol: 'WCRO',
        entryPrice: 0.12,
        entryAmount: 1000,
        entryTimestamp: Date.now() - 3600000, // 1 hour ago
        status: 'OPEN'
    };

    const position2: Position = {
        id: 'pos_002',
        tokenAddress: '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59',
        tokenSymbol: 'USDC',
        entryPrice: 1.0,
        entryAmount: 500,
        entryTimestamp: Date.now() - 7200000, // 2 hours ago
        status: 'OPEN'
    };

    positionRepo.create(position1);
    positionRepo.create(position2);
    console.log('   Created 2 positions');
    console.log('');

    // 5. Close a Position
    console.log('4️⃣  Closing position with profit...');
    positionRepo.close(
        'pos_001',
        0.15,      // exitPrice (25% gain)
        1250,      // exitAmount
        Date.now(),
        250,       // profitLoss ($250 profit)
        5          // feePaid ($5 fee)
    );
    console.log('   Position pos_001 closed with $250 profit');
    console.log('');

    // 6. Create Trade Signals
    console.log('5️⃣  Logging trade signals...');
    
    const validSignal: TradeSignal = {
        id: 'signal_001',
        tokenAddress: '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23',
        signalType: 'BUY',
        hypeAnalysis: {
            signal: 'VALID_BREAKOUT',
            confidenceScore: 92,
            reasoning: 'High volume surge with positive smart money sentiment',
            timestamp: Date.now() - 3600000
        },
        marketData: {
            tokenAddress: '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23',
            price: 0.12,
            volume24h: 5000000,
            volumeTrend: 'RISING',
            timestamp: Date.now() - 3600000
        },
        sentimentData: {
            tokenSymbol: 'WCRO',
            mentions: 250,
            sentiment: 'POSITIVE',
            sources: ['twitter', 'discord', 'telegram'],
            smartMoneyMentions: 12,
            timestamp: Date.now() - 3600000
        },
        timestamp: Date.now() - 3600000,
        executed: true
    };

    const noiseSignal: TradeSignal = {
        id: 'signal_002',
        tokenAddress: '0xScamToken123',
        signalType: 'BUY',
        hypeAnalysis: {
            signal: 'FAKE_PUMP',
            confidenceScore: 15,
            reasoning: 'Detected bot spam and coordinated pump pattern',
            timestamp: Date.now() - 1800000
        },
        marketData: {
            tokenAddress: '0xScamToken123',
            price: 0.001,
            volume24h: 100000,
            volumeTrend: 'RISING',
            timestamp: Date.now() - 1800000
        },
        sentimentData: {
            tokenSymbol: 'SCAM',
            mentions: 1000,
            sentiment: 'POSITIVE',
            sources: ['twitter'],
            smartMoneyMentions: 0,
            timestamp: Date.now() - 1800000
        },
        timestamp: Date.now() - 1800000,
        executed: false
    };

    signalRepo.create(validSignal);
    signalRepo.create(noiseSignal);
    console.log('   Logged 2 signals (1 executed, 1 noise detected)');
    console.log('');

    // 7. Log Events
    console.log('6️⃣  Logging agent events...');
    eventRepo.log('AGENT_STARTED', { wallet: '0xABC...', timestamp: Date.now() - 7200000 });
    eventRepo.log('TRADE_EXECUTED', { 
        tokenAddress: '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23',
        action: 'BUY',
        amount: 1000
    });
    eventRepo.logNoiseDetection(
        '0xScamToken123',
        15,
        'Detected bot spam and coordinated pump pattern'
    );
    console.log('   Logged 3 events');
    console.log('');

    // 8. Add Chat History
    console.log('7️⃣  Saving chat history...');
    chatRepo.add({
        role: 'user',
        content: 'Show me my open positions',
        timestamp: Date.now() - 300000
    });
    chatRepo.add({
        role: 'assistant',
        content: 'You have 1 open position: USDC with entry at $1.00',
        timestamp: Date.now() - 299000,
        actions: JSON.stringify([{ type: 'position_query', details: { count: 1 } }])
    });
    console.log('   Saved 2 chat messages');
    console.log('');

    // 9. Query Data
    console.log('8️⃣  Querying persisted data...\n');

    // Open positions
    const openPositions = positionRepo.findOpen();
    console.log('   📊 Open Positions:', openPositions.length);
    openPositions.forEach(pos => {
        console.log(`      - ${pos.tokenSymbol}: ${pos.entryAmount} @ $${pos.entryPrice}`);
    });
    console.log('');

    // Performance metrics
    const metrics = positionRepo.getMetrics();
    console.log('   📈 Performance Metrics:');
    console.log(`      Total P&L: $${metrics.totalProfitLoss.toFixed(2)}`);
    console.log(`      Total Fees: $${metrics.totalFeesPaid.toFixed(2)}`);
    console.log(`      Win Rate: ${metrics.winRate.toFixed(1)}%`);
    console.log(`      Total Trades: ${metrics.totalTrades}`);
    console.log('');

    // Signal statistics
    const signalStats = signalRepo.getStatistics();
    console.log('   🎯 Signal Statistics:');
    console.log(`      Total Signals: ${signalStats.totalSignals}`);
    console.log(`      Executed: ${signalStats.executedSignals}`);
    console.log(`      Noise Detected: ${signalStats.noiseDetected}`);
    console.log(`      Valid Breakouts: ${signalStats.validBreakouts}`);
    console.log(`      Fake Pumps: ${signalStats.fakePumps}`);
    console.log('');

    // Noise detection log
    const noisySignals = signalRepo.findNoiseDetected(10);
    console.log('   🚫 Noise Detection Log:', noisySignals.length, 'prevented trades');
    noisySignals.forEach(sig => {
        console.log(`      - ${sig.tokenAddress}: ${sig.hypeAnalysis.reasoning}`);
    });
    console.log('');

    // Recent events
    const recentEvents = eventRepo.findRecent(5);
    console.log('   📝 Recent Events:', recentEvents.length);
    recentEvents.forEach(event => {
        console.log(`      - ${event.eventType}: ${JSON.stringify(event.eventData).substring(0, 50)}...`);
    });
    console.log('');

    // Chat history
    const chatHistory = chatRepo.getAll();
    console.log('   💬 Chat History:', chatHistory.length, 'messages');
    chatHistory.forEach(msg => {
        console.log(`      ${msg.role}: ${msg.content.substring(0, 60)}${msg.content.length > 60 ? '...' : ''}`);
    });
    console.log('');

    // 10. Cleanup Demo
    console.log('9️⃣  Demo complete! Database location:');
    console.log('   📁 ./data/sentinel.db\n');
    console.log('   To reset database, run: DatabaseConnection.reset()');
    console.log('');

    // Close connection
    DatabaseConnection.close();
}

// Run the demo
if (require.main === module) {
    demonstratePersistence().catch(console.error);
}

export { demonstratePersistence };

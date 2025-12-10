import { DatabaseConnection } from './database';
import { TradeSignal, HypeAnalysis, MarketData, SentimentData } from '../models/types';
import Database from 'better-sqlite3';

/**
 * Repository for managing trade signals
 * Requirements: 8.1, 8.2, 8.4
 */
export class TradeSignalRepository {
    private db: Database.Database;

    constructor() {
        this.db = DatabaseConnection.getInstance();
    }

    /**
     * Create a new trade signal
     */
    create(signal: TradeSignal): void {
        const stmt = this.db.prepare(`
            INSERT INTO trade_signals (
                id, token_address, signal_type, signal_classification,
                confidence_score, reasoning, market_price, market_volume,
                sentiment_score, timestamp, executed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            signal.id,
            signal.tokenAddress,
            signal.signalType,
            signal.hypeAnalysis.signal,
            signal.hypeAnalysis.confidenceScore,
            signal.hypeAnalysis.reasoning,
            signal.marketData.price,
            signal.marketData.volume24h,
            this.getSentimentScore(signal.sentimentData.sentiment),
            signal.timestamp,
            signal.executed ? 1 : 0
        );
    }

    /**
     * Update signal execution status
     */
    markAsExecuted(id: string): void {
        const stmt = this.db.prepare(`
            UPDATE trade_signals
            SET executed = 1
            WHERE id = ?
        `);
        stmt.run(id);
    }

    /**
     * Find signal by ID
     */
    findById(id: string): TradeSignal | null {
        const stmt = this.db.prepare('SELECT * FROM trade_signals WHERE id = ?');
        const row = stmt.get(id) as any;
        return row ? this.mapToTradeSignal(row) : null;
    }

    /**
     * Find all signals for a token
     */
    findByToken(tokenAddress: string, limit?: number): TradeSignal[] {
        let query = 'SELECT * FROM trade_signals WHERE token_address = ? ORDER BY timestamp DESC';
        if (limit) {
            query += ` LIMIT ${limit}`;
        }
        const stmt = this.db.prepare(query);
        const rows = stmt.all(tokenAddress) as any[];
        return rows.map(row => this.mapToTradeSignal(row));
    }

    /**
     * Find recent signals
     */
    findRecent(limit: number = 50): TradeSignal[] {
        const stmt = this.db.prepare(`
            SELECT * FROM trade_signals
            ORDER BY timestamp DESC
            LIMIT ?
        `);
        const rows = stmt.all(limit) as any[];
        return rows.map(row => this.mapToTradeSignal(row));
    }

    /**
     * Find signals by classification (e.g., 'FAKE_PUMP', 'VALID_BREAKOUT')
     */
    findByClassification(classification: string, limit?: number): TradeSignal[] {
        let query = 'SELECT * FROM trade_signals WHERE signal_classification = ? ORDER BY timestamp DESC';
        if (limit) {
            query += ` LIMIT ${limit}`;
        }
        const stmt = this.db.prepare(query);
        const rows = stmt.all(classification) as any[];
        return rows.map(row => this.mapToTradeSignal(row));
    }

    /**
     * Find noise-detected signals (not executed)
     */
    findNoiseDetected(limit: number = 50): TradeSignal[] {
        const stmt = this.db.prepare(`
            SELECT * FROM trade_signals
            WHERE executed = 0 AND signal_classification IN ('FAKE_PUMP', 'NOISE')
            ORDER BY timestamp DESC
            LIMIT ?
        `);
        const rows = stmt.all(limit) as any[];
        return rows.map(row => this.mapToTradeSignal(row));
    }

    /**
     * Get signal statistics
     */
    getStatistics(): {
        totalSignals: number;
        executedSignals: number;
        noiseDetected: number;
        validBreakouts: number;
        fakePumps: number;
    } {
        const stmt = this.db.prepare(`
            SELECT
                COUNT(*) as total_signals,
                SUM(CASE WHEN executed = 1 THEN 1 ELSE 0 END) as executed_signals,
                SUM(CASE WHEN executed = 0 THEN 1 ELSE 0 END) as noise_detected,
                SUM(CASE WHEN signal_classification = 'VALID_BREAKOUT' THEN 1 ELSE 0 END) as valid_breakouts,
                SUM(CASE WHEN signal_classification = 'FAKE_PUMP' THEN 1 ELSE 0 END) as fake_pumps
            FROM trade_signals
        `);

        const result = stmt.get() as any;
        return {
            totalSignals: result.total_signals || 0,
            executedSignals: result.executed_signals || 0,
            noiseDetected: result.noise_detected || 0,
            validBreakouts: result.valid_breakouts || 0,
            fakePumps: result.fake_pumps || 0
        };
    }

    /**
     * Delete all signals (for testing)
     */
    deleteAll(): void {
        this.db.prepare('DELETE FROM trade_signals').run();
    }

    /**
     * Convert sentiment string to numeric score
     */
    private getSentimentScore(sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'): number {
        switch (sentiment) {
            case 'POSITIVE': return 75;
            case 'NEUTRAL': return 50;
            case 'NEGATIVE': return 25;
            default: return 50;
        }
    }

    /**
     * Map database row to TradeSignal object
     * Note: This creates a simplified version. Full reconstruction would need
     * complete market/sentiment data which we store in summary form.
     */
    private mapToTradeSignal(row: any): TradeSignal {
        return {
            id: row.id,
            tokenAddress: row.token_address,
            signalType: row.signal_type,
            hypeAnalysis: {
                signal: row.signal_classification,
                confidenceScore: row.confidence_score,
                reasoning: row.reasoning,
                timestamp: row.timestamp
            } as HypeAnalysis,
            marketData: {
                tokenAddress: row.token_address,
                price: row.market_price,
                volume24h: row.market_volume,
                volumeTrend: 'FLAT', // Not stored, default
                timestamp: row.timestamp
            } as MarketData,
            sentimentData: {
                tokenSymbol: 'UNKNOWN', // Not stored
                mentions: 0,
                sentiment: this.scoresToSentiment(row.sentiment_score),
                sources: [],
                smartMoneyMentions: 0,
                timestamp: row.timestamp
            } as SentimentData,
            timestamp: row.timestamp,
            executed: row.executed === 1
        };
    }

    /**
     * Convert score back to sentiment enum
     */
    private scoresToSentiment(score: number): 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' {
        if (score >= 65) return 'POSITIVE';
        if (score <= 35) return 'NEGATIVE';
        return 'NEUTRAL';
    }
}

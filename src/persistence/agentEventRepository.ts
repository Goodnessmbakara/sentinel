import { DatabaseConnection } from './database';
import Database from 'better-sqlite3';

/**
 * Event types for agent logging
 */
export type AgentEventType =
    | 'AGENT_STARTED'
    | 'AGENT_STOPPED'
    | 'TRADE_EXECUTED'
    | 'TRADE_REJECTED'
    | 'NOISE_DETECTED'
    | 'POSITION_OPENED'
    | 'POSITION_CLOSED'
    | 'STOP_LOSS_TRIGGERED'
    | 'ERROR'
    | 'CONFIG_UPDATED';

export interface AgentEvent {
    id?: number;
    eventType: AgentEventType;
    eventData: any;
    timestamp: number;
}

/**
 * Repository for logging agent events
 * Requirements: 8.4
 */
export class AgentEventRepository {
    private db: Database.Database;

    constructor() {
        this.db = DatabaseConnection.getInstance();
    }

    /**
     * Log a new event
     */
    log(eventType: AgentEventType, eventData: any, timestamp?: number): void {
        const stmt = this.db.prepare(`
            INSERT INTO agent_events (event_type, event_data, timestamp)
            VALUES (?, ?, ?)
        `);

        stmt.run(
            eventType,
            JSON.stringify(eventData),
            timestamp || Date.now()
        );
    }

    /**
     * Log noise detection event
     */
    logNoiseDetection(tokenAddress: string, confidenceScore: number, reasoning: string): void {
        this.log('NOISE_DETECTED', {
            tokenAddress,
            confidenceScore,
            reasoning,
            action: 'TRADE_PREVENTED'
        });
    }

    /**
     * Log trade rejection
     */
    logTradeRejection(tokenAddress: string, reason: string, details: any): void {
        this.log('TRADE_REJECTED', {
            tokenAddress,
            reason,
            ...details
        });
    }

    /**
     * Log error
     */
    logError(error: Error, context?: any): void {
        this.log('ERROR', {
            message: error.message,
            stack: error.stack,
            context
        });
    }

    /**
     * Find events by type
     */
    findByType(eventType: AgentEventType, limit: number = 100): AgentEvent[] {
        const stmt = this.db.prepare(`
            SELECT * FROM agent_events
            WHERE event_type = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `);
        const rows = stmt.all(eventType, limit) as any[];
        return rows.map(row => this.mapToEvent(row));
    }

    /**
     * Find events within time range
     */
    findInRange(startTimestamp: number, endTimestamp: number): AgentEvent[] {
        const stmt = this.db.prepare(`
            SELECT * FROM agent_events
            WHERE timestamp >= ? AND timestamp <= ?
            ORDER BY timestamp DESC
        `);
        const rows = stmt.all(startTimestamp, endTimestamp) as any[];
        return rows.map(row => this.mapToEvent(row));
    }

    /**
     * Get recent events
     */
    findRecent(limit: number = 50): AgentEvent[] {
        const stmt = this.db.prepare(`
            SELECT * FROM agent_events
            ORDER BY timestamp DESC
            LIMIT ?
        `);
        const rows = stmt.all(limit) as any[];
        return rows.map(row => this.mapToEvent(row));
    }

    /**
     * Get noise detection count
     */
    getNoiseDetectionCount(startTimestamp?: number): number {
        let query = 'SELECT COUNT(*) as count FROM agent_events WHERE event_type = ?';
        const params: any[] = ['NOISE_DETECTED'];

        if (startTimestamp) {
            query += ' AND timestamp >= ?';
            params.push(startTimestamp);
        }

        const stmt = this.db.prepare(query);
        const result = stmt.get(...params) as any;
        return result.count || 0;
    }

    /**
     * Delete events older than timestamp (cleanup)
     */
    deleteOlderThan(timestamp: number): number {
        const stmt = this.db.prepare('DELETE FROM agent_events WHERE timestamp < ?');
        const result = stmt.run(timestamp);
        return result.changes;
    }

    /**
     * Delete all events (for testing)
     */
    deleteAll(): void {
        this.db.prepare('DELETE FROM agent_events').run();
    }

    /**
     * Map database row to AgentEvent object
     */
    private mapToEvent(row: any): AgentEvent {
        return {
            id: row.id,
            eventType: row.event_type,
            eventData: JSON.parse(row.event_data),
            timestamp: row.timestamp
        };
    }
}

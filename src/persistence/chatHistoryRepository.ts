import { DatabaseConnection } from './database';
import Database from 'better-sqlite3';

export interface ChatMessage {
    id?: number;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    actions?: any; // JSON-serializable actions (object/array/string)
}

/**
 * Repository for managing chat history
 */
export class ChatHistoryRepository {
    private db: Database.Database;

    constructor() {
        this.db = DatabaseConnection.getInstance();
    }

    /**
     * Add a chat message
     */
    add(message: ChatMessage): void {
        const stmt = this.db.prepare(`
            INSERT INTO chat_history (role, content, timestamp, actions)
            VALUES (?, ?, ?, ?)
        `);

        stmt.run(
            message.role,
            message.content,
            message.timestamp,
            message.actions ? JSON.stringify(message.actions) : null
        );
    }

    /**
     * Get all chat history
     */
    getAll(): ChatMessage[] {
        const stmt = this.db.prepare(`
            SELECT * FROM chat_history
            ORDER BY timestamp ASC
        `);
        const rows = stmt.all() as any[];
        return rows.map(row => this.mapToMessage(row));
    }

    /**
     * Get recent chat messages
     */
    getRecent(limit: number = 50): ChatMessage[] {
        const stmt = this.db.prepare(`
            SELECT * FROM chat_history
            ORDER BY timestamp DESC
            LIMIT ?
        `);
        const rows = stmt.all(limit) as any[];
        return rows.map(row => this.mapToMessage(row)).reverse();
    }

    /**
     * Get messages within time range
     */
    getInRange(startTimestamp: number, endTimestamp: number): ChatMessage[] {
        const stmt = this.db.prepare(`
            SELECT * FROM chat_history
            WHERE timestamp >= ? AND timestamp <= ?
            ORDER BY timestamp ASC
        `);
        const rows = stmt.all(startTimestamp, endTimestamp) as any[];
        return rows.map(row => this.mapToMessage(row));
    }

    /**
     * Clear all chat history
     */
    clear(): void {
        this.db.prepare('DELETE FROM chat_history').run();
    }

    /**
     * Delete messages older than timestamp
     */
    deleteOlderThan(timestamp: number): number {
        const stmt = this.db.prepare('DELETE FROM chat_history WHERE timestamp < ?');
        const result = stmt.run(timestamp);
        return result.changes;
    }

    /**
     * Map database row to ChatMessage
     */
    private mapToMessage(row: any): ChatMessage {
        return {
            id: row.id,
            role: row.role,
            content: row.content,
            timestamp: row.timestamp,
            actions: row.actions ? JSON.parse(row.actions) : undefined
        };
    }
}

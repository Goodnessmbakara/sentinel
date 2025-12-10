import { DatabaseConnection } from './database';
import { Position } from '../models/types';
import Database from 'better-sqlite3';

/**
 * Repository for managing trading positions
 * Requirements: 8.1, 8.2
 */
export class PositionRepository {
    private db: Database.Database;

    constructor() {
        this.db = DatabaseConnection.getInstance();
    }

    /**
     * Create a new position
     */
    create(position: Position): void {
        const stmt = this.db.prepare(`
            INSERT INTO positions (
                id, token_address, token_symbol, entry_price, entry_amount,
                entry_timestamp, exit_price, exit_amount, exit_timestamp,
                status, profit_loss, fee_paid
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            position.id,
            position.tokenAddress,
            position.tokenSymbol,
            position.entryPrice,
            position.entryAmount,
            position.entryTimestamp,
            position.exitPrice || null,
            position.exitAmount || null,
            position.exitTimestamp || null,
            position.status,
            position.profitLoss || null,
            position.feePaid || null
        );
    }

    /**
     * Update an existing position
     */
    update(position: Position): void {
        const stmt = this.db.prepare(`
            UPDATE positions
            SET token_address = ?, token_symbol = ?, entry_price = ?,
                entry_amount = ?, entry_timestamp = ?, exit_price = ?,
                exit_amount = ?, exit_timestamp = ?, status = ?,
                profit_loss = ?, fee_paid = ?
            WHERE id = ?
        `);

        stmt.run(
            position.tokenAddress,
            position.tokenSymbol,
            position.entryPrice,
            position.entryAmount,
            position.entryTimestamp,
            position.exitPrice || null,
            position.exitAmount || null,
            position.exitTimestamp || null,
            position.status,
            position.profitLoss || null,
            position.feePaid || null,
            position.id
        );
    }

    /**
     * Close a position
     */
    close(
        id: string,
        exitPrice: number,
        exitAmount: number,
        exitTimestamp: number,
        profitLoss: number,
        feePaid: number
    ): void {
        const stmt = this.db.prepare(`
            UPDATE positions
            SET exit_price = ?, exit_amount = ?, exit_timestamp = ?,
                status = 'CLOSED', profit_loss = ?, fee_paid = ?
            WHERE id = ?
        `);

        stmt.run(exitPrice, exitAmount, exitTimestamp, profitLoss, feePaid, id);
    }

    /**
     * Get position by ID
     */
    findById(id: string): Position | null {
        const stmt = this.db.prepare('SELECT * FROM positions WHERE id = ?');
        const row = stmt.get(id) as any;
        return row ? this.mapToPosition(row) : null;
    }

    /**
     * Get all open positions
     */
    findOpen(): Position[] {
        const stmt = this.db.prepare('SELECT * FROM positions WHERE status = ? ORDER BY entry_timestamp DESC');
        const rows = stmt.all('OPEN') as any[];
        return rows.map(row => this.mapToPosition(row));
    }

    /**
     * Get all positions (with optional limit)
     */
    findAll(limit?: number): Position[] {
        let query = 'SELECT * FROM positions ORDER BY entry_timestamp DESC';
        if (limit) {
            query += ` LIMIT ${limit}`;
        }
        const stmt = this.db.prepare(query);
        const rows = stmt.all() as any[];
        return rows.map(row => this.mapToPosition(row));
    }

    /**
     * Get closed positions within time range
     */
    findClosedInRange(startTimestamp: number, endTimestamp: number): Position[] {
        const stmt = this.db.prepare(`
            SELECT * FROM positions
            WHERE status = 'CLOSED'
                AND exit_timestamp >= ?
                AND exit_timestamp <= ?
            ORDER BY exit_timestamp DESC
        `);
        const rows = stmt.all(startTimestamp, endTimestamp) as any[];
        return rows.map(row => this.mapToPosition(row));
    }

    /**
     * Get performance metrics
     */
    getMetrics(): {
        totalProfitLoss: number;
        totalFeesPaid: number;
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        winRate: number;
    } {
        const stmt = this.db.prepare(`
            SELECT
                COALESCE(SUM(profit_loss), 0) as total_profit_loss,
                COALESCE(SUM(fee_paid), 0) as total_fees_paid,
                COUNT(*) as total_trades,
                SUM(CASE WHEN profit_loss > 0 THEN 1 ELSE 0 END) as winning_trades,
                SUM(CASE WHEN profit_loss <= 0 THEN 1 ELSE 0 END) as losing_trades
            FROM positions
            WHERE status = 'CLOSED'
        `);

        const result = stmt.get() as any;
        const winRate = result.total_trades > 0
            ? (result.winning_trades / result.total_trades) * 100
            : 0;

        return {
            totalProfitLoss: result.total_profit_loss || 0,
            totalFeesPaid: result.total_fees_paid || 0,
            totalTrades: result.total_trades || 0,
            winningTrades: result.winning_trades || 0,
            losingTrades: result.losing_trades || 0,
            winRate: winRate
        };
    }

    /**
     * Delete position by ID (for testing)
     */
    delete(id: string): void {
        const stmt = this.db.prepare('DELETE FROM positions WHERE id = ?');
        stmt.run(id);
    }

    /**
     * Delete all positions (for testing)
     */
    deleteAll(): void {
        this.db.prepare('DELETE FROM positions').run();
    }

    /**
     * Map database row to Position object
     */
    private mapToPosition(row: any): Position {
        return {
            id: row.id,
            tokenAddress: row.token_address,
            tokenSymbol: row.token_symbol,
            entryPrice: row.entry_price,
            entryAmount: row.entry_amount,
            entryTimestamp: row.entry_timestamp,
            exitPrice: row.exit_price || undefined,
            exitAmount: row.exit_amount || undefined,
            exitTimestamp: row.exit_timestamp || undefined,
            status: row.status,
            profitLoss: row.profit_loss || undefined,
            feePaid: row.fee_paid || undefined
        };
    }
}

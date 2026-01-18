import { DatabaseConnection } from './database';
import { UserRiskProfile } from '../models/types';
import Database from 'better-sqlite3';

/**
 * Repository for managing user configuration
 */
export class ConfigRepository {
    private db: Database.Database;

    constructor() {
        this.db = DatabaseConnection.getInstance();
    }

    /**
     * Save or update user configuration
     */
    save(config: UserRiskProfile): void {
        const stmt = this.db.prepare(`
            INSERT INTO user_config (
                id, risk_mode, allowed_tokens, min_confidence_score,
                stop_loss_percent, max_position_size, updated_at
            ) VALUES (1, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                risk_mode = excluded.risk_mode,
                allowed_tokens = excluded.allowed_tokens,
                min_confidence_score = excluded.min_confidence_score,
                stop_loss_percent = excluded.stop_loss_percent,
                max_position_size = excluded.max_position_size,
                updated_at = excluded.updated_at
        `);

        stmt.run(
            config.mode,
            JSON.stringify(config.allowedTokens),
            config.minConfidenceScore,
            config.stopLossPercent,
            config.maxPositionSize,
            config.slippageTolerance || 1,
            Math.floor(Date.now() / 1000)
        );
    }

    /**
     * Load user configuration
     */
    load(): UserRiskProfile | null {
        const stmt = this.db.prepare('SELECT * FROM user_config WHERE id = 1');
        const row = stmt.get() as any;

        if (!row) {
            return null;
        }

        return {
            mode: row.risk_mode,
            allowedTokens: JSON.parse(row.allowed_tokens),
            minConfidenceScore: row.min_confidence_score,
            stopLossPercent: row.stop_loss_percent,
            maxPositionSize: row.max_position_size,
            slippageTolerance: row.slippage_tolerance || 1
        };
    }

    /**
     * Check if configuration exists
     */
    exists(): boolean {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM user_config WHERE id = 1');
        const result = stmt.get() as any;
        return result.count > 0;
    }

    /**
     * Delete configuration (for testing)
     */
    delete(): void {
        this.db.prepare('DELETE FROM user_config WHERE id = 1').run();
    }
}

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Database connection manager
 * Uses SQLite for simplicity (can be upgraded to PostgreSQL)
 */
export class DatabaseConnection {
    private static instance: Database.Database | null = null;
    private static dbPath: string = path.join(process.cwd(), 'data', 'sentinel.db');

    static initialize(): Database.Database {
        if (!this.instance) {
            // Ensure data directory exists
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            this.instance = new Database(this.dbPath);
            this.instance.pragma('journal_mode = WAL'); // Better concurrency
            
            console.log(`✓ Database initialized at ${this.dbPath}`);
            this.createTables();
        }
        return this.instance;
    }

    static getInstance(): Database.Database {
        if (!this.instance) {
            return this.initialize();
        }
        return this.instance;
    }

    static close(): void {
        if (this.instance) {
            this.instance.close();
            this.instance = null;
            console.log('Database connection closed');
        }
    }

    private static createTables(): void {
        const db = this.instance!;

        // Positions table
        db.exec(`
            CREATE TABLE IF NOT EXISTS positions (
                id TEXT PRIMARY KEY,
                token_address TEXT NOT NULL,
                token_symbol TEXT NOT NULL,
                entry_price REAL NOT NULL,
                entry_amount REAL NOT NULL,
                entry_timestamp INTEGER NOT NULL,
                exit_price REAL,
                exit_amount REAL,
                exit_timestamp INTEGER,
                status TEXT NOT NULL CHECK(status IN ('OPEN', 'CLOSED')),
                profit_loss REAL,
                fee_paid REAL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
            CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
            CREATE INDEX IF NOT EXISTS idx_positions_timestamp ON positions(entry_timestamp);
        `);

        // Trade signals table
        db.exec(`
            CREATE TABLE IF NOT EXISTS trade_signals (
                id TEXT PRIMARY KEY,
                token_address TEXT NOT NULL,
                signal_type TEXT NOT NULL CHECK(signal_type IN ('BUY', 'SELL')),
                signal_classification TEXT NOT NULL,
                confidence_score INTEGER NOT NULL,
                reasoning TEXT,
                market_price REAL NOT NULL,
                market_volume REAL NOT NULL,
                sentiment_score INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                executed INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
            CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON trade_signals(timestamp);
            CREATE INDEX IF NOT EXISTS idx_signals_executed ON trade_signals(executed);
            CREATE INDEX IF NOT EXISTS idx_signals_token ON trade_signals(token_address);
        `);

        // Agent events table (for logging decisions and system events)
        db.exec(`
            CREATE TABLE IF NOT EXISTS agent_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                event_data TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
            CREATE INDEX IF NOT EXISTS idx_events_type ON agent_events(event_type);
            CREATE INDEX IF NOT EXISTS idx_events_timestamp ON agent_events(timestamp);
        `);

        // User configuration table
        db.exec(`
            CREATE TABLE IF NOT EXISTS user_config (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                risk_mode TEXT NOT NULL CHECK(risk_mode IN ('GUARDIAN', 'HUNTER')),
                allowed_tokens TEXT NOT NULL,
                min_confidence_score INTEGER NOT NULL,
                stop_loss_percent REAL NOT NULL,
                max_position_size REAL NOT NULL,
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
        `);

        // Chat history table
        db.exec(`
            CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                actions TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
            CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_history(timestamp);
        `);

        console.log('✓ Database tables created/verified');
    }

    static reset(): void {
        if (this.instance) {
            this.instance.exec(`
                DROP TABLE IF EXISTS positions;
                DROP TABLE IF EXISTS trade_signals;
                DROP TABLE IF EXISTS agent_events;
                DROP TABLE IF EXISTS user_config;
                DROP TABLE IF EXISTS chat_history;
            `);
            this.createTables();
            console.log('✓ Database reset complete');
        }
    }
}

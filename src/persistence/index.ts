/**
 * Persistence Layer - Main Export
 * 
 * This module provides a complete persistence solution for the Sentinel AI system.
 * It uses SQLite for local storage (easily upgradeable to PostgreSQL for production).
 * 
 * Usage:
 * ```typescript
 * import { DatabaseConnection, PositionRepository } from './persistence';
 * 
 * // Initialize database
 * DatabaseConnection.initialize();
 * 
 * // Use repositories
 * const positionRepo = new PositionRepository();
 * const positions = positionRepo.findOpen();
 * ```
 */

export { DatabaseConnection } from './database';
export { PositionRepository } from './positionRepository';
export { TradeSignalRepository } from './tradeSignalRepository';
export { AgentEventRepository, AgentEventType, AgentEvent } from './agentEventRepository';
export { ConfigRepository } from './configRepository';
export { ChatHistoryRepository, ChatMessage } from './chatHistoryRepository';

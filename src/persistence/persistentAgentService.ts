/**
 * Example: Integrating Persistence Layer with AgentService
 * 
 * This file demonstrates how to integrate the persistence layer
 * into your existing AgentService for complete data persistence.
 */

import { AgentService } from '../execution/agentService';
import { 
    DatabaseConnection,
    PositionRepository,
    TradeSignalRepository,
    AgentEventRepository,
    ConfigRepository
} from '../persistence';
import { Position, TradeSignal } from '../models/types';

/**
 * Enhanced AgentService with persistence
 */
export class PersistentAgentService extends AgentService {
    private positionRepo: PositionRepository;
    private signalRepo: TradeSignalRepository;
    private eventRepo: AgentEventRepository;
    private configRepo: ConfigRepository;

    constructor(...args: ConstructorParameters<typeof AgentService>) {
        super(...args);
        
        // Initialize database
        DatabaseConnection.initialize();
        
        // Initialize repositories
        this.positionRepo = new PositionRepository();
        this.signalRepo = new TradeSignalRepository();
        this.eventRepo = new AgentEventRepository();
        this.configRepo = new ConfigRepository();
        
        // Load saved configuration if exists
        this.loadSavedConfig();
    }

    /**
     * Load saved user configuration
     */
    private loadSavedConfig(): void {
        const savedConfig = this.configRepo.load();
        if (savedConfig) {
            this.updateRiskProfile(savedConfig);
            console.log('✓ Loaded saved risk profile:', savedConfig.mode);
        }
    }

    /**
     * Override start to log event
     */
    async start(...args: Parameters<AgentService['start']>): Promise<void> {
        await super.start(...args);
        
        // Log agent started event
        this.eventRepo.log('AGENT_STARTED', {
            wallet: this.getWallet()?.address,
            timestamp: Date.now()
        });
    }

    /**
     * Override stop to log event
     */
    stop(): void {
        super.stop();
        
        // Log agent stopped event
        this.eventRepo.log('AGENT_STOPPED', {
            timestamp: Date.now()
        });
    }

    /**
     * Enhanced analyzeAndTrade with persistence
     */
    async analyzeAndTrade(tokenAddress: string): Promise<any> {
        try {
            const decision = await super.analyzeAndTrade(tokenAddress);
            
            if (!decision) {
                return null;
            }

            // Create trade signal record
            const signal: TradeSignal = {
                id: `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                tokenAddress: tokenAddress,
                signalType: decision.action === 'BUY' ? 'BUY' : 'SELL',
                hypeAnalysis: decision.analysis,
                marketData: decision.marketData || {} as any,
                sentimentData: decision.sentimentData || {} as any,
                timestamp: Date.now(),
                executed: decision.shouldTrade
            };

            // Save signal to database
            this.signalRepo.create(signal);

            if (decision.shouldTrade) {
                // Log trade execution event
                this.eventRepo.log('TRADE_EXECUTED', {
                    tokenAddress,
                    action: decision.action,
                    confidenceScore: decision.analysis.confidenceScore,
                    reasoning: decision.analysis.reasoning
                });

                // Create position record
                const position: Position = {
                    id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    tokenAddress: tokenAddress,
                    tokenSymbol: 'UNKNOWN', // Update with actual symbol
                    entryPrice: decision.marketData?.price || 0,
                    entryAmount: decision.amount || 0,
                    entryTimestamp: Date.now(),
                    status: 'OPEN'
                };

                this.positionRepo.create(position);
                
                this.eventRepo.log('POSITION_OPENED', {
                    positionId: position.id,
                    tokenAddress: position.tokenAddress,
                    entryPrice: position.entryPrice,
                    entryAmount: position.entryAmount
                });
            } else {
                // Log noise detection if trade was prevented
                if (decision.analysis.signal === 'FAKE_PUMP' || decision.analysis.signal === 'NOISE') {
                    this.eventRepo.logNoiseDetection(
                        tokenAddress,
                        decision.analysis.confidenceScore,
                        decision.analysis.reasoning
                    );
                } else {
                    // Log other rejection reasons
                    this.eventRepo.logTradeRejection(tokenAddress, 'Risk criteria not met', decision);
                }
            }

            return decision;

        } catch (error: any) {
            // Log error
            this.eventRepo.logError(error, { tokenAddress });
            throw error;
        }
    }

    /**
     * Close a position with persistence
     */
    async closePosition(
        positionId: string,
        exitPrice: number,
        exitAmount: number,
        feePaid: number
    ): Promise<void> {
        const position = this.positionRepo.findById(positionId);
        
        if (!position) {
            throw new Error(`Position ${positionId} not found`);
        }

        const exitTimestamp = Date.now();
        const profitLoss = exitAmount - position.entryAmount;

        // Update position in database
        this.positionRepo.close(
            positionId,
            exitPrice,
            exitAmount,
            exitTimestamp,
            profitLoss,
            feePaid
        );

        // Log event
        this.eventRepo.log('POSITION_CLOSED', {
            positionId,
            tokenAddress: position.tokenAddress,
            exitPrice,
            exitAmount,
            profitLoss,
            feePaid
        });

        console.log(`Position ${positionId} closed. P&L: ${profitLoss}`);
    }

    /**
     * Get all open positions
     */
    getOpenPositions(): Position[] {
        return this.positionRepo.findOpen();
    }

    /**
     * Get trading history
     */
    getTradingHistory(limit?: number): Position[] {
        return this.positionRepo.findAll(limit);
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return this.positionRepo.getMetrics();
    }

    /**
     * Get recent signals
     */
    getRecentSignals(limit: number = 50): TradeSignal[] {
        return this.signalRepo.findRecent(limit);
    }

    /**
     * Get noise detection log
     */
    getNoiseDetectionLog(limit: number = 50): TradeSignal[] {
        return this.signalRepo.findNoiseDetected(limit);
    }

    /**
     * Save current configuration
     */
    saveConfiguration(): void {
        // Access the private riskProfile through a method if needed
        // For now, this is a placeholder
        // this.configRepo.save(this.riskProfile);
    }
}

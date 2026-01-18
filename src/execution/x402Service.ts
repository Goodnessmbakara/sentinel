import { logger } from '../utils/logger';

/**
 * x402 Payment Service
 * 
 * Simple wrapper for x402 payment instructions.
 * Following KISS principle: minimal abstraction, clear fallback.
 * 
 * Feature flag: USE_X402 in .env
 */

interface PaymentInstruction {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    minAmountOut: string;
    recipient: string;
}

export class X402Service {
    private enabled: boolean;
    private facilitatorClient: any = null;

    constructor() {
        this.enabled = (process.env.USE_X402 || 'false').toLowerCase() === 'true';
        
        if (this.enabled) {
            try {
                // Lazy load facilitator client only if enabled
                const { FacilitatorClient } = require('@crypto.com/facilitator-client');
                this.facilitatorClient = new FacilitatorClient({
                    network: process.env.CHAIN_ID === '338' ? 'cronos-testnet' : 'cronos-mainnet'
                });
                logger.info('x402 Service enabled');
            } catch (error: any) {
                logger.warn('Failed to initialize x402 facilitator client', { error: error.message });
                this.enabled = false;
            }
        } else {
            logger.info('x402 Service disabled - using direct swap execution');
        }
    }

    /**
     * Check if x402 is enabled
     */
    isEnabled(): boolean {
        return this.enabled && this.facilitatorClient !== null;
    }

    /**
     * Create payment instruction for trade
     * This wraps the trade in an x402 payment flow
     */
    async createPaymentInstruction(params: PaymentInstruction): Promise<any> {
        if (!this.isEnabled()) {
            throw new Error('x402 not enabled - use direct swap');
        }

        try {
            logger.info('Creating x402 payment instruction', {
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                amountIn: params.amountIn
            });

            // In x402 model, we're "paying" for trade execution as a service
            // The payment instruction represents: "execute this swap for me"
            const instruction = {
                type: 'trade_execution',
                payload: {
                    tokenIn: params.tokenIn,
                    tokenOut: params.tokenOut,
                    amountIn: params.amountIn,
                    minAmountOut: params.minAmountOut,
                    recipient: params.recipient
                },
                timestamp: Date.now()
            };

            logger.info('x402 payment instruction created', { instruction });
            return instruction;

        } catch (error: any) {
            logger.error('Failed to create x402 payment instruction', { error: error.message });
            throw error;
        }
    }

    /**
     * Execute trade via x402 facilitator
     * Falls back gracefully if x402 fails
     */
    async executeTrade(instruction: any, fallback: () => Promise<any>): Promise<any> {
        if (!this.isEnabled()) {
            logger.info('x402 disabled - executing fallback');
            return fallback();
        }

        try {
            logger.info('Attempting x402 facilitated trade execution');
            
            // TODO: Implement actual facilitator execution
            // For now, this is a proof-of-concept that demonstrates the pattern
            // Full implementation would involve:
            // 1. Create EIP-3009 authorization
            // 2. Submit to facilitator
            // 3. Wait for settlement
            // 4. Execute swap
            
            logger.warn('x402 execution not yet fully implemented - using fallback');
            return fallback();

        } catch (error: any) {
            logger.error('x402 execution failed - falling back to direct swap', { error: error.message });
            return fallback();
        }
    }
}

// Singleton instance
export const x402Service = new X402Service();

import { logger } from '../utils/logger';

/**
 * x402 Payment Handler
 * 
 * Handles x402 payment instructions for autonomous trading.
 * Aligns with Cronos x402 Facilitator protocol.
 * 
 * Pattern: Payment as a service - treating trade execution as a paid resource.
 */

export class X402Handler {
    
    /**
     * Constructs the x402 payment header for a request.
     * Based on Cronos x402 Facilitator pattern.
     * 
     * @param serviceId - Identifier for the service (e.g., "trade_execution")
     * @param modelType - Type of payment model (e.g., "exact", "subscription")
     * @param cost - Cost in base units (wei)
     * @returns Payment headers for x402 request
     */
    static getHeader(serviceId: string, modelType: string, cost: number): Record<string, string> {
        // x402 payment headers following facilitator protocol
        return {
            'x-402-service-id': serviceId,
            'x-402-model': modelType,
            'x-402-cost': cost.toString(),
            'x-402-timestamp': Date.now().toString(),
            'x-402-version': '1.0'
        };
    }

    /**
     * Calculate x402 agent fee (5% of profit)  
     * Matches smart contract fee logic
     * 
     * @param profit - Profit in wei
     * @returns Fee amount (5% of profit, 0 if loss)
     */
    static calculateFee(profit: bigint): bigint {
        if (profit <= 0n) return 0n;
        return (profit * 5n) / 100n;
    }

    /**
     * Create payment instruction for trade execution
     * This wraps a trade in an x402 payment flow
     * 
     * @param tradeParams - Trade parameters (tokenIn, tokenOut, amounts)
     * @returns Payment instruction object ready for facilitator submission
     */
    static createPaymentInstruction(tradeParams: {
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        minAmountOut: string;
        recipient?: string;
    }) {
        logger.info('Creating x402 payment instruction for trade', {
            tokenIn: tradeParams.tokenIn,
            tokenOut: tradeParams.tokenOut,
            amountIn: tradeParams.amountIn
        });

        // Payment instruction following x402 facilitator pattern
        const instruction = {
            type: 'trade_execution',
            version: '1.0',
            timestamp: Date.now(),
            payload: {
                service: 'autonomous_trading',
                action: 'execute_swap',
                parameters: {
                    tokenIn: tradeParams.tokenIn,
                    tokenOut: tradeParams.tokenOut,
                    amountIn: tradeParams.amountIn,
                    minAmountOut: tradeParams.minAmountOut,
                    recipient: tradeParams.recipient || tradeParams.tokenIn
                }
            },
            payment: {
                model: 'exact', // EIP-3009 exact payment scheme
                cost: tradeParams.amountIn // The trade amount itself is the "payment"
            }
        };

        return instruction;
    }

    /**
     * Check if x402 is enabled via feature flag
     */
    static isEnabled(): boolean {
        return (process.env.USE_X402 || 'false').toLowerCase() === 'true';
    }
}

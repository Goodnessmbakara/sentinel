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
                const { Facilitator } = require('@crypto.com/facilitator-client');
                this.facilitatorClient = new Facilitator({
                    network: process.env.CHAIN_ID === '338' ? 'cronos-testnet' : 'cronos-mainnet'
                });
                logger.info('x402 Service enabled with real Facilitator client');
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
     * Execute payment via x402 facilitator
     * Real implementation using EIP-3009 authorization
     */
    async executeTrade(instruction: any, walletPrivateKey: string): Promise<any> {
        if (!this.isEnabled()) {
            throw new Error('CRITICAL: x402 is not enabled. Set USE_X402=true in .env');
        }

        if (!this.facilitatorClient) {
            throw new Error('CRITICAL: Facilitator client not initialized');
        }

        try {
            logger.info('Starting x402 payment execution', {
                type: instruction.type,
                service: instruction.payload?.service
            });

            const ethers = require('ethers');
            const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
            const signer = new ethers.Wallet(walletPrivateKey, provider);

            // Extract payment details from instruction
            const { tokenIn, amountIn, recipient } = instruction.payload.parameters;

            logger.info('Generating EIP-3009 payment header', {
                to: recipient,
                value: amountIn,
                from: await signer.getAddress()
            });

            // 1. Generate payment header (EIP-3009 authorization)
            const header = await this.facilitatorClient.generatePaymentHeader({
                to: recipient,
                value: amountIn,
                signer: signer,
            });

            logger.info('Payment header generated', { header });

            // 2. Generate payment requirements
            const requirements = this.facilitatorClient.generatePaymentRequirements({
                payTo: recipient,
                description: `Autonomous trading - ${instruction.type}`,
                maxAmountRequired: amountIn,
            });

            logger.info('Payment requirements generated', { requirements });

            // 3. Build verify request
            const body = this.facilitatorClient.buildVerifyRequest(header, requirements);

            // 4. Verify payment
            logger.info('Verifying payment...');
            const verification = await this.facilitatorClient.verifyPayment(body);

            if (!verification.isValid) {
                throw new Error(`Payment verification failed: ${JSON.stringify(verification)}`);
            }

            logger.info('Payment verified successfully', { verification });

            // 5. Settle payment
            logger.info('Settling payment via facilitator...');
            const settlement = await this.facilitatorClient.settlePayment(body);

            logger.info('Payment settled successfully', {
                txHash: settlement.txHash,
                status: settlement.status
            });

            return {
                success: true,
                txHash: settlement.txHash,
                header: header,
                verification: verification,
                settlement: settlement
            };

        } catch (error: any) {
            logger.error('x402 payment execution failed', {
                error: error.message,
                stack: error.stack
            });
            throw new Error(`x402 facilitator execution failed: ${error.message}`);
        }
    }

    /**
     * Execute DEX swap (NOTE: This is NOT what x402 was designed for)
     * x402 is for static payments, not dynamic token swaps
     * 
     * This method demonstrates the conceptual mismatch
     */
    async executeSwap(instruction: any, walletPrivateKey: string): Promise<any> {
        logger.warn('executeSwap called: x402 is designed for payments, not DEX swaps');
        logger.warn('For production, use direct swap execution');
        
        // x402 doesn't handle DEX routing - it handles payment settlement
        // To use x402 for swaps, you'd need a facilitator that:
        // 1. Receives payment authorization
        // 2. Executes swap on behalf of user
        // 3. Returns proceeds

        throw new Error('x402 executeSwap not implemented: Architectural mismatch. x402 is for static payments (API access fees), not dynamic DEX swaps. Use direct swap execution for trading.');
    }
}

// Singleton instance
export const x402Service = new X402Service();

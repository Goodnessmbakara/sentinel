import { createClient } from '@crypto.com/ai-agent-client';
import { logger } from '../utils/logger';

/**
 * Crypto.com AI Agent Client
 * Official SDK integration replacing direct Google/OpenAI SDK usage
 * 
 * Features:
 * - Natural language blockchain queries
 * - Wallet management
 * - Transaction history
 * - Smart contract interactions
 * - Market analysis via AI
 */

export class CryptoComAiClient {
    private client: any;
    private isInitialized: boolean = false;

    constructor() {
        this.initialize();
    }

    private initialize() {
        try {
            const apiKey = process.env.OPENAI_API_KEY?.trim();
            
            if (!apiKey) {
                logger.warn('⚠️ OPENAI_API_KEY not set. Crypto.com AI Client will not be available.');
                return;
            }

            const queryOptions = {
                openAI: {
                    apiKey,
                    model: process.env.OPENAI_MODEL || 'gpt-4o',
                },
                chainId: parseInt(process.env.CHAIN_ID || '25'), // Cronos mainnet
                explorerKeys: {
                    cronosMainnetKey: process.env.EXPLORER_API_KEY,
                },
            };

            this.client = createClient(queryOptions);
            this.isInitialized = true;
            
            logger.info('✓ Crypto.com AI Agent Client initialized', {
                model: queryOptions.openAI.model,
                chainId: queryOptions.chainId
            });

        } catch (error: any) {
            logger.error('❌ Failed to initialize Crypto.com AI Client', { error: error.message });
            this.isInitialized = false;
        }
    }

    /**
     * Natural language query to the AI agent
     * Handles trading analysis, blockchain queries, wallet operations, etc.
     */
    async query(prompt: string, context?: any[]): Promise<any> {
        if (!this.isInitialized || !this.client) {
            throw new Error('Crypto.com AI Client not initialized. Check OPENAI_API_KEY.');
        }

        try {
            logger.debug('Crypto.com AI query', { prompt: prompt.substring(0, 100) });
            
            const response = await this.client.agent.generateQuery(prompt, context);
            
            logger.debug('Crypto.com AI response', { 
                hasMessage: !!response.message,
                hasContext: !!response.context 
            });

            return response;

        } catch (error: any) {
            logger.error('Crypto.com AI query failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Market sentiment analysis using AI
     */
    async analyzeSentiment(tokenSymbol: string, tokenAddress: string): Promise<any> {
        const prompt = `Analyze the current market sentiment for ${tokenSymbol} (${tokenAddress}) on Cronos network.

Consider:
1. Recent price action and trading volume
2. Social media sentiment (Twitter, Reddit, Telegram)
3. Smart money wallet activity (whales, large holders)
4. Project fundamentals and recent news
5. Technical indicators and chart patterns

Provide sentiment analysis in JSON format:
{
  "sentiment": "POSITIVE" | "NEGATIVE" | "NEUTRAL",
  "sentimentScore": <0-100>,
  "mentions": <estimated social mentions>,
  "smartMoneyActivity": <number of whale transactions>,
  "reasoning": "<detailed explanation>",
  "sources": ["source1", "source2"]
}`;

        return await this.query(prompt);
    }

    /**
     * Comprehensive trading analysis
     */
    async analyzeTrade(
        tokenSymbol: string,
        tokenAddress: string,
        marketData: any,
        sentimentData: any
    ): Promise<any> {
        const prompt = `You are a professional cryptocurrency trading analyst. Analyze ${tokenSymbol} and provide a trading recommendation.

## MARKET DATA
- Price: $${marketData.price}
- 24h Volume: $${marketData.volume24h}
- Volume Trend: ${marketData.volumeTrend}

## SENTIMENT DATA
- Sentiment: ${sentimentData.sentiment}
- Social Mentions: ${sentimentData.mentions}
- Smart Money Signals: ${sentimentData.smartMoneyMentions}

Analyze and provide recommendation in JSON format:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": <0-100>,
  "reasoning": "<2-3 sentence explanation>",
  "technicalScore": <0-100>,
  "sentimentScore": <0-100>,
  "fundamentalScore": <0-100>,
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "suggestedPositionSize": <0-100 percentage>
}`;

        return await this.query(prompt);
    }

    /**
     * Get wallet information
     */
    async getWalletInfo(walletAddress: string): Promise<any> {
        const prompt = `Get the current balance and recent transaction history for wallet ${walletAddress} on Cronos network.`;
        return await this.query(prompt);
    }

    /**
     * Get contract positions
     */
    async getContractPositions(contractAddress: string): Promise<any> {
        const prompt = `List all open trading positions in smart contract ${contractAddress} on Cronos network.`;
        return await this.query(prompt);
    }

    /**
     * Query recent trades
     */
    async getRecentTrades(walletAddress: string, limit: number = 10): Promise<any> {
        const prompt = `Show the last ${limit} trades made by wallet ${walletAddress} on Cronos network, including tokens traded, amounts, and timestamps.`;
        return await this.query(prompt);
    }

    /**
     * General blockchain query
     */
    async queryBlockchain(naturalLanguageQuery: string): Promise<any> {
        return await this.query(naturalLanguageQuery);
    }

    /**
     * Check if client is ready
     */
    isReady(): boolean {
        return this.isInitialized;
    }
}

// Export singleton instance
export const cryptoComAiClient = new CryptoComAiClient();

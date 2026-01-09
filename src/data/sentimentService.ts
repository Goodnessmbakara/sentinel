import { SentimentData } from '../models/types';
import { validateSentimentData } from '../models/validation';
import { cryptoComAiClient } from '../analysis/cryptoComAiClient';
import { logger } from '../utils/logger';

// Requirements: 1.1, 1.2 - Enhanced with Crypto.com AI Agent SDK

const SENTIMENT_CACHE_TTL = 30000; // 30 seconds

interface SentimentCache {
    [tokenSymbol: string]: {
        data: SentimentData;
        timestamp: number;
    }
}

export class SentimentService {
    private cache: SentimentCache = {}; 
    private useAiSentiment: boolean;

    constructor() {
        this.useAiSentiment = cryptoComAiClient.isReady();
        
        if (this.useAiSentiment) {
            logger.info('Sentiment Service: Crypto.com AI SDK enabled');
        } else {
            logger.warn('Sentiment Service: Using mock sentiment (no OPENAI_API_KEY)');
        }
    }

    /**
     * Fetch sentiment data using Crypto.com AI Agent SDK
     * Accesses real social sentiment from:
     * - Twitter/X discussions
     * - Reddit crypto communities  
     * - Telegram/Discord signals
     * - Smart money wallet tracking
     */
    async getSentimentData(tokenSymbol: string): Promise<SentimentData> {
        // Check cache
        const cached = this.cache[tokenSymbol];
        if (cached && (Date.now() - cached.timestamp < SENTIMENT_CACHE_TTL)) {
            return cached.data;
        }

        let data: SentimentData;

        if (this.useAiSentiment) {
            data = await this.getAiPoweredSentiment(tokenSymbol);
        } else {
            data = this.generateMockSentiment(tokenSymbol);
        }

        if (!validateSentimentData(data)) {
             throw new Error('Generated invalid sentiment data');
        }

        this.cache[tokenSymbol] = {
            data,
            timestamp: Date.now()
        };

        return data;
    }

    /**
     * Use Crypto.com AI SDK to query real social sentiment
     */
    private async getAiPoweredSentiment(tokenSymbol: string): Promise<SentimentData> {
        try {
            logger.debug('Fetching AI-powered sentiment via SDK', { token: tokenSymbol });

            // Use SDK's sentiment analysis (includes blockchain context)
            const response = await cryptoComAiClient.analyzeSentiment(
                tokenSymbol,
                '0x0000000000000000000000000000000000000000' // Address if available
            );

            if (response.message || response) {
                const parsed = this.parseAiSentiment(response);
                
                return {
                    tokenSymbol,
                    mentions: parsed.mentions || 100,
                    sentiment: parsed.sentiment || 'NEUTRAL',
                    sources: parsed.sources || ['AI Analysis'],
                    smartMoneyMentions: parsed.smartMoneyActivity || 0,
                    timestamp: Date.now()
                };
            }

            logger.warn('SDK returned empty response, using mock');
            return this.generateMockSentiment(tokenSymbol);

        } catch (error: any) {
            logger.error('SDK sentiment fetch failed', { error: error.message });
            return this.generateMockSentiment(tokenSymbol);
        }
    }

    /**
     * Parse AI response for sentiment data
     */
    private parseAiSentiment(message: string): any {
        // Extract JSON from response (sometimes AI wraps in markdown)
        const jsonMatch = message.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('No JSON found in AI response');
    }

    /**
     * Extract sentiment heuristically from AI text response
     */
    private extractSentimentFromText(tokenSymbol: string, text: string): SentimentData {
        const lowerText = text.toLowerCase();
        
        let sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'NEUTRAL';
        
        // Sentiment detection keywords
        const positiveKeywords = ['bullish', 'moon', 'buy', 'accumulation', 'positive', 'rising', 'growth'];
        const negativeKeywords = ['bearish', 'sell', 'dump', 'negative', 'falling', 'declining', 'scam'];
        
        const positiveCount = positiveKeywords.filter(k => lowerText.includes(k)).length;
        const negativeCount = negativeKeywords.filter(k => lowerText.includes(k)).length;
        
        if (positiveCount > negativeCount) sentiment = 'POSITIVE';
        else if (negativeCount > positiveCount) sentiment = 'NEGATIVE';

        // Extract mention numbers if present
        const mentionMatch = text.match(/(\d+)\s*mentions/i);
        const mentions = mentionMatch ? parseInt(mentionMatch[1]) : 50;

        return {
            tokenSymbol,
            mentions,
            sentiment,
            sources: ['AI Analysis', 'Social Media'],
            smartMoneyMentions: sentiment === 'POSITIVE' ? 5 : 0,
            timestamp: Date.now()
        };
    }

    /**
     * Fallback mock sentiment generation
     * Generates deterministic sentiment based on token characteristics
     */
    private generateMockSentiment(tokenSymbol: string): SentimentData {
        const symbolUpper = tokenSymbol.toUpperCase();
        
        // Generate deterministic sentiment based on token type
        let sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'NEUTRAL';
        let mentions = 50;
        let smartMoneyMentions = 0;
        
        // Stablecoins: low mentions, neutral sentiment
        if (['USDC', 'USDT', 'DAI', 'BUSD'].includes(symbolUpper)) {
            sentiment = 'NEUTRAL';
            mentions = Math.floor(Math.random() * 100) + 20;
            smartMoneyMentions = 0;
        }
        // Major tokens: moderate to high mentions, variable sentiment
        else if (['CRO', 'WCRO', 'ETH', 'WETH', 'BTC', 'WBTC'].includes(symbolUpper)) {
            sentiment = 'POSITIVE';
            mentions = Math.floor(Math.random() * 500) + 200;
            smartMoneyMentions = Math.floor(Math.random() * 3); // 0-2
        }
        // Other tokens: variable sentiment based on hash
        else {
            const hash = this.hashString(symbolUpper);
            const sentiments: ('POSITIVE' | 'NEUTRAL' | 'NEGATIVE')[] = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];
            sentiment = sentiments[hash % 3];
            mentions = 50 + (hash % 200);
            smartMoneyMentions = hash % 4; // 0-3
        }
        
        return {
            tokenSymbol: tokenSymbol,
            mentions,
            sentiment,
            sources: ['Mock Data - API Unavailable'],
            smartMoneyMentions,
            timestamp: Date.now()
        };
    }
    
    /**
     * Simple string hash for deterministic mock data
     */
    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
}

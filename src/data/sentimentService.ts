import { SentimentData } from '../models/types';
import { validateSentimentData } from '../models/validation';

// Requirements: 1.1, 1.2

const SENTIMENT_CACHE_TTL = 30000; // 30 seconds

interface SentimentCache {
    [tokenSymbol: string]: {
        data: SentimentData;
        timestamp: number;
    }
}

export class SentimentService {
    private cache: SentimentCache = {};

    /**
     * Fetch sentiment data for a given token symbol.
     * Currently mocks data generation for the hackathon context.
     */
    async getSentimentData(tokenSymbol: string): Promise<SentimentData> {
        // Check cache
        const cached = this.cache[tokenSymbol];
        if (cached && (Date.now() - cached.timestamp < SENTIMENT_CACHE_TTL)) {
            return cached.data;
        }

        // Mock data generation
        const data = this.generateMockSentiment(tokenSymbol);

        if (!validateSentimentData(data)) {
             throw new Error('Generated invalid sentiment data');
        }

        this.cache[tokenSymbol] = {
            data,
            timestamp: Date.now()
        };

        return data;
    }

    private generateMockSentiment(tokenSymbol: string): SentimentData {
        const sentiments: ('POSITIVE' | 'NEUTRAL' | 'NEGATIVE')[] = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];
        const randomSentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
        
        return {
            tokenSymbol: tokenSymbol,
            mentions: Math.floor(Math.random() * 1000),
            sentiment: randomSentiment,
            sources: ['Twitter', 'Discord', 'Telegram'],
            smartMoneyMentions: Math.floor(Math.random() * 50),
            timestamp: Date.now()
        };
    }
}

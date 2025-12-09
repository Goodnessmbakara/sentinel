import { MarketData, SentimentData, HypeAnalysis } from '../models/types';
import { AiAgentClient } from './aiAgentClient';

// Requirements: 1.3, 1.4, 4.2 (Algorithm Logic)

export class HypeFilter {
    private aiClient: AiAgentClient;

    constructor() {
        this.aiClient = new AiAgentClient();
    }

    async analyze(marketData: MarketData, sentimentData: SentimentData): Promise<HypeAnalysis> {
        // 1. Analyze sentiment text (aggregating sources for the prompt)
        // For this mock, we just use the 'sentiment' field from data to guide the mock score
        // In real app, we'd pass raw text to LLM.
        
        // Let's rely on the pre-filled sentiment data for the "SDK" input simulation
        const sentimentPrompt = `Sentiment: ${sentimentData.sentiment}. Sources: ${sentimentData.sources.join(',')}`;
        
        // We actually want to map the predefined sentiment to a score for the decision matrix
        // if we were strictly following the "SDK analyzes text" flow.
        // But the design doc says: 
        // sentiment_score = analyze_sentiment()
        // if sentiment_score == "HIGH_HYPE" ...
        
        // Let's normalize validation:
        // HIGH_HYPE ~= Positive sentiment / High score (> 75)
        // LOW ~= Negative/Neutral
        
        let sentimentScore = 50;
        if (sentimentData.sentiment === 'POSITIVE') sentimentScore = 85;
        if (sentimentData.sentiment === 'NEGATIVE') sentimentScore = 20;

        // 2. Decision Matrix
        
        // Case: High Hype + Flat Volume = FAKE_PUMP (Requirement 1.3)
        // "High Hype" defined as POTENTIALLY > 75 or POSITIVE
        if (sentimentScore > 75 && marketData.volumeTrend === 'FLAT') {
            return {
                signal: 'FAKE_PUMP', // Maps to NOISE effectively for trading prevention, but specifically classified
                confidenceScore: 85,
                reasoning: "High social hype without volume support",
                timestamp: Date.now()
            };
        }

        // Case: High Hype + Rising Volume = VALID_BREAKOUT (Requirement 1.4)
        if (sentimentScore > 75 && marketData.volumeTrend === 'RISING') {
            return {
                signal: 'VALID_BREAKOUT',
                confidenceScore: 90,
                reasoning: "Social sentiment confirmed by volume",
                timestamp: Date.now()
            };
        }

        // Case: Low Sentiment + Smart Money = ACCUMULATION
        // "Low" defined as <= 50?
        if (sentimentScore <= 50 && sentimentData.smartMoneyMentions > 5) { // threshold from design doc example
             return {
                signal: 'ACCUMULATION',
                confidenceScore: 75,
                reasoning: "Smart money activity without retail attention",
                timestamp: Date.now()
            };
        }

        // Default: NOISE
        return {
            signal: 'NOISE',
            confidenceScore: 50,
            reasoning: "Insufficient signal strength",
            timestamp: Date.now()
        };
    }
}

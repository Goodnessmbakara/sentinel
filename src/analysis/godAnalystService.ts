import { MarketData, SentimentData, HypeAnalysis } from '../models/types';
import { cryptoComAiClient } from './cryptoComAiClient';
import { logger } from '../utils/logger';

/**
 * God Analyst Service
 * 
 * AI-powered trading analyst using Crypto.com AI Agent SDK
 * Combines:
 * - Technical Analysis (RSI, MACD, volume patterns, price action)
 * - Fundamental Analysis (project metrics, tokenomics, market cap)
 * - Sentiment Analysis (social signals, FOMO detection, smart money)
 * - Market Context (blockchain data, wallet activity, trends)
 * 
 * Uses Crypto.com SDK for comprehensive blockchain-aware AI analysis
 */

export interface AnalystSignal {
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number; // 0-100
    reasoning: string;
    technicalScore: number; // 0-100
    sentimentScore: number; // 0-100
    fundamentalScore: number; // 0-100
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    suggestedPositionSize: number; // percentage of portfolio
    timestamp: number;
}

export class GodAnalystService {
    private useAiAnalysis: boolean;

    constructor() {
        this.useAiAnalysis = cryptoComAiClient.isReady();

        if (this.useAiAnalysis) {
            logger.info('🧠 God Analyst: Crypto.com AI SDK enabled');
        } else {
            logger.warn('⚠️ God Analyst: Using fallback heuristics (no OPENAI_API_KEY)');
        }
    }

    /**
     * Comprehensive AI-powered market analysis using Crypto.com SDK
     */
    async analyze(
        tokenAddress: string,
        tokenSymbol: string,
        marketData: MarketData,
        sentimentData: SentimentData
    ): Promise<AnalystSignal> {
        
        if (this.useAiAnalysis) {
            return await this.getAiPoweredAnalysis(tokenAddress, tokenSymbol, marketData, sentimentData);
        } else {
            return this.getFallbackAnalysis(marketData, sentimentData);
        }
    }

    /**
     * AI-Powered Analysis using Crypto.com SDK
     */
    private async getAiPoweredAnalysis(
        tokenAddress: string,
        tokenSymbol: string,
        marketData: MarketData,
        sentimentData: SentimentData
    ): Promise<AnalystSignal> {
        
        try {
            logger.debug('God Analyst: Querying Crypto.com AI SDK', { token: tokenSymbol });

            // Use SDK's built-in trading analysis with blockchain context
            const response = await cryptoComAiClient.analyzeTrade(
                tokenSymbol,
                tokenAddress,
                marketData,
                sentimentData
            );

            return this.parseAiAnalysis(response, tokenSymbol);

        } catch (error: any) {
            logger.error('God Analyst AI error', { error: error.message });
            return this.getFallbackAnalysis(marketData, sentimentData);
        }
    }

    /**
     * Parse Crypto.com SDK response
     */
    private parseAiAnalysis(response: any, tokenSymbol: string): AnalystSignal {
        try {
            // SDK returns structured response
            let parsed: any;
            
            if (response.message) {
                // Try to extract JSON from message
                const jsonMatch = response.message.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                } else {
                    // Fallback to text extraction
                    return this.extractFromText(response.message);
                }
            } else {
                parsed = response;
            }
            
            return {
                action: parsed.action || 'HOLD',
                confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
                reasoning: parsed.reasoning || 'AI analysis completed',
                technicalScore: Math.min(100, Math.max(0, parsed.technicalScore || 50)),
                sentimentScore: Math.min(100, Math.max(0, parsed.sentimentScore || 50)),
                fundamentalScore: Math.min(100, Math.max(0, parsed.fundamentalScore || 50)),
                riskLevel: parsed.riskLevel || 'MEDIUM',
                suggestedPositionSize: Math.min(100, Math.max(0, parsed.suggestedPositionSize || 5)),
                timestamp: Date.now()
            };
            
        } catch (error) {
            logger.warn('Failed to parse SDK response, using heuristic extraction', { error });
            return this.extractFromText(response.message || JSON.stringify(response));
        }
    }

    /**
     * Extract trading signal from unstructured AI text
     */
    private extractFromText(text: string): AnalystSignal {
        const lower = text.toLowerCase();
        
        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let confidence = 50;
        
        // Action detection
        if (lower.includes('buy') || lower.includes('bullish') || lower.includes('accumulate')) {
            action = 'BUY';
            confidence = 70;
        } else if (lower.includes('sell') || lower.includes('bearish') || lower.includes('exit')) {
            action = 'SELL';
            confidence = 70;
        }
        
        // Extract confidence if mentioned
        const confMatch = text.match(/confidence[:\s]+(\d+)/i);
        if (confMatch) {
            confidence = parseInt(confMatch[1]);
        }

        return {
            action,
            confidence,
            reasoning: text.substring(0, 200), // First 200 chars
            technicalScore: 50,
            sentimentScore: 50,
            fundamentalScore: 50,
            riskLevel: 'MEDIUM',
            suggestedPositionSize: action === 'BUY' ? 10 : 0,
            timestamp: Date.now()
        };
    }

    /**
     * Fallback heuristic analysis (when AI unavailable)
     */
    private getFallbackAnalysis(
        marketData: MarketData,
        sentimentData: SentimentData
    ): AnalystSignal {
        
        // Simple heuristic scoring
        let technicalScore = 50;
        let sentimentScore = 50;
        
        // Technical scoring
        if (marketData.volumeTrend === 'RISING') technicalScore = 75;
        if (marketData.volumeTrend === 'FALLING') technicalScore = 25;
        
        // Sentiment scoring
        if (sentimentData.sentiment === 'POSITIVE') sentimentScore = 75;
        if (sentimentData.sentiment === 'NEGATIVE') sentimentScore = 25;
        
        // Combined score
        const combinedScore = (technicalScore * 0.6) + (sentimentScore * 0.4);
        
        // Decision logic (simplified from original HypeFilter)
        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let reasoning = 'Insufficient signal strength';
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
        
        // High sentiment + Flat volume = FAKE PUMP
        if (sentimentScore > 75 && marketData.volumeTrend === 'FLAT') {
            action = 'HOLD';
            reasoning = 'Potential fake pump - high hype without volume support';
            riskLevel = 'HIGH';
        }
        // High sentiment + Rising volume = VALID BREAKOUT
        else if (sentimentScore > 75 && marketData.volumeTrend === 'RISING') {
            action = 'BUY';
            reasoning = 'Valid breakout - sentiment confirmed by volume';
            riskLevel = 'LOW';
        }
        // Low sentiment + Smart money = ACCUMULATION
        else if (sentimentScore <= 50 && sentimentData.smartMoneyMentions > 5) {
            action = 'BUY';
            reasoning = 'Stealth accumulation - smart money activity without retail attention';
            riskLevel = 'MEDIUM';
        }

        return {
            action,
            confidence: combinedScore,
            reasoning,
            technicalScore,
            sentimentScore,
            fundamentalScore: 50,
            riskLevel,
            suggestedPositionSize: action === 'BUY' ? 10 : 0,
            timestamp: Date.now()
        };
    }
}

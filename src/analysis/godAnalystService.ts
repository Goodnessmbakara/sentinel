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
     * Intelligent fallback analysis using real market data
     * Generates specific, actionable reasoning based on technical indicators
     */
    private getFallbackAnalysis(
        marketData: MarketData,
        sentimentData: SentimentData
    ): AnalystSignal {
        
        // Import technical analyzer inline to avoid circular dependencies
        const TechnicalAnalyzer = require('./technicalAnalyzer').TechnicalAnalyzer;
        const analyzer = new TechnicalAnalyzer();
        
        // Note: In production, analyzer should be singleton with historical data
        // For now, we'll use market data directly
        
        // Calculate scores from real data
        const technicalScore = this.calculateTechnicalScore(marketData);
        const sentimentScore = this.calculateSentimentScore(sentimentData);
        const fundamentalScore = this.calculateFundamentalScore(marketData);
        
        // Weighted combined score
        const combinedScore = (technicalScore * 0.5) + (sentimentScore * 0.3) + (fundamentalScore * 0.2);
        
        // Intelligent decision logic with dynamic reasoning
        const decision = this.makeIntelligentDecision(
            marketData,
            sentimentData,
            technicalScore,
            sentimentScore,
            fundamentalScore,
            combinedScore
        );
        
        return {
            action: decision.action,
            confidence: Math.round(combinedScore),
            reasoning: decision.reasoning,
            technicalScore: Math.round(technicalScore),
            sentimentScore: Math.round(sentimentScore),
            fundamentalScore: Math.round(fundamentalScore),
            riskLevel: decision.riskLevel,
            suggestedPositionSize: decision.positionSize,
            timestamp: Date.now()
        };
    }
    
    /**
     * Calculate technical score from market data
     */
    private calculateTechnicalScore(marketData: MarketData): number {
        let score = 50; // Start neutral
        
        // Volume trend analysis
        if (marketData.volumeTrend === 'RISING') score += 25;
        if (marketData.volumeTrend === 'FALLING') score -= 25;
        
        // Volume magnitude (if high volume, increase confidence)
        if (marketData.volume24h > 100000) score += 10;
        if (marketData.volume24h > 1000000) score += 10;
        
        return Math.max(0, Math.min(100, score));
    }
    
    /**
     * Calculate sentiment score
     */
    private calculateSentimentScore(sentimentData: SentimentData): number {
        let score = 50;
        
        if (sentimentData.sentiment === 'POSITIVE') score = 75;
        if (sentimentData.sentiment === 'NEGATIVE') score = 25;
        
        // Adjust for mention volume
        if (sentimentData.mentions > 500) score += 10;
        if (sentimentData.mentions < 50) score -= 10;
        
        return Math.max(0, Math.min(100, score));
    }
    
    /**
     * Calculate fundamental score from price and volume
     */
    private calculateFundamentalScore(marketData: MarketData): number {
        let score = 50;
        
        // Price stability (lower volatility = higher fundamental score for long-term)
        // Higher volume  = higher liquidity = better fundamentals
        if (marketData.volume24h > 500000) score += 20;
        if (marketData.volume24h > 2000000) score += 15;
        
        // Price range check (reasonable price ranges are better)
        if (marketData.price > 0.01 && marketData.price < 10000) score += 15;
        
        return Math.max(0, Math.min(100, score));
    }
    
    /**
     * Make intelligent trading decision with specific reasoning
     */
    private makeIntelligentDecision(
        marketData: MarketData,
        sentimentData: SentimentData,
        technicalScore: number,
        sentimentScore: number,
        fundamentalScore: number,
        combinedScore: number
    ): {
        action: 'BUY' | 'SELL' | 'HOLD';
        reasoning: string;
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
        positionSize: number;
    } {
        
        // Pattern 1: High sentiment but no volume = FAKE PUMP
        if (sentimentScore > 75 && marketData.volumeTrend === 'FLAT') {
            return {
                action: 'HOLD',
                reasoning: `**Fake Pump Alert**: High social sentiment (${sentimentScore}/100) but flat volume trend. ` +
                          `${sentimentData.mentions} mentions without volume support suggests artificial hype. ` +
                          `Wait for volume confirmation before entering.`,
                riskLevel: 'HIGH',
                positionSize: 0
            };
        }
        
        // Pattern 2: Rising volume + positive sentiment = VALID BREAKOUT
        if (marketData.volumeTrend === 'RISING' && sentimentScore > 65 && technicalScore > 60) {
            const volumeStr = marketData.volume24h >= 1000000 ? 
                `$${(marketData.volume24h / 1000000).toFixed(2)}M` : 
                `$${(marketData.volume24h / 1000).toFixed(0)}K`;
            
            return {
                action: 'BUY',
                reasoning: `**Valid Breakout**: Rising volume (${volumeStr} 24h) with positive sentiment (${Math.round(sentimentScore)}/100). ` +
                          `Technical score ${Math.round(technicalScore)}/100 confirms momentum. ` +
                          `${sentimentData.mentions} social mentions provide validation. Entry opportunity.`,
                riskLevel: 'LOW',
                positionSize: 15
            };
        }
        
        // Pattern 3: Low sentiment but high volume = SMART MONEY ACCUMULATION
        if (sentimentScore < 50 && marketData.volumeTrend === 'RISING' && marketData.volume24h > 100000) {
            return {
                action: 'BUY',
                reasoning: `**Smart Money Signal**: High volume ($${(marketData.volume24h / 1000).toFixed(0)}K 24h) without retail hype. ` +
                          `Low social mentions (${sentimentData.mentions}) suggest institutional accumulation. ` +
                          `Technical score ${Math.round(technicalScore)}/100. Stealth entry opportunity.`,
                riskLevel: 'MEDIUM',
                positionSize: 10
            };
        }
        
        // Pattern 4: Negative sentiment + falling volume = DOWNTREND
        if (sentimentScore < 40 && marketData.volumeTrend === 'FALLING') {
            return {
                action: 'SELL',
                reasoning: `**Downtrend Confirmed**: Negative sentiment (${Math.round(sentimentScore)}/100) with declining volume. ` +
                          `${sentimentData.mentions} bearish mentions. Technical score ${Math.round(technicalScore)}/100. ` +
                          `Exit positions or avoid entry.`,
                riskLevel: 'HIGH',
                positionSize: 0
            };
        }
        
        // Pattern 5: Strong fundamentals but neutral action = HOLD FOR QUALITY
        if (fundamentalScore > 70 && combinedScore > 55 && combinedScore < 70) {
            return {
                action: 'HOLD',
                reasoning: `**Quality Asset**: Strong fundamentals (${Math.round(fundamentalScore)}/100) with $${(marketData.volume24h / 1000).toFixed(0)}K liquidity. ` +
                          `Combined score ${Math.round(combinedScore)}/100 suggests stable but not explosive. ` +
                          `Good for portfolio but wait for stronger entry signal.`,
                riskLevel: 'LOW',
                positionSize: 5
            };
        }
        
        // Pattern 6: Very high combined score = STRONG BUY
        if (combinedScore > 75) {
            return {
                action: 'BUY',
                reasoning: `**Strong Buy Signal**: Excellent combined score (${Math.round(combinedScore)}/100). ` +
                          `Technical: ${Math.round(technicalScore)}, Sentiment: ${Math.round(sentimentScore)}, Fundamental: ${Math.round(fundamentalScore)}. ` +
                          `Volume: $${(marketData.volume24h / 1000).toFixed(0)}K. Multiple indicators align for entry.`,
                riskLevel: 'LOW',
                positionSize: 20
            };
        }
        
        // Pattern 7: Very low combined score = STRONG SELL/AVOID
        if (combinedScore < 35) {
            return {
                action: 'SELL',
                reasoning: `**Poor Metrics**: Low combined score (${Math.round(combinedScore)}/100). ` +
                          `Technical: ${Math.round(technicalScore)}, Sentiment: ${Math.round(sentimentScore)}, Fundamental: ${Math.round(fundamentalScore)}. ` +
                          `Multiple red flags. Exit or avoid.`,
                riskLevel: 'HIGH',
                positionSize: 0
            };
        }
        
        // Default: Neutral/Insufficient signal
        return {
            action: 'HOLD',
            reasoning: `**Mixed Signals**: Combined score ${Math.round(combinedScore)}/100. ` +
                      `Technical: ${Math.round(technicalScore)}, Sentiment: ${Math.round(sentimentScore)}, Volume: $${(marketData.volume24h / 1000).toFixed(0)}K. ` +
                      `No clear directional bias. Wait for confirmation before entering position.`,
            riskLevel: 'MEDIUM',
            positionSize: 0
        };
    }
}

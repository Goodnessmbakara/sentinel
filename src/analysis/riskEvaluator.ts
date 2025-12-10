import { HypeAnalysis, UserRiskProfile, TradeSignal } from '../models/types';
import { validateRiskProfile } from '../models/validation';

// Requirements: 1.5, 2.2, 2.3

export interface TradeDecision {
    sentimentData: any;
    marketData: any;
    analysis: HypeAnalysis;
    shouldTrade: boolean;
    action: 'BUY' | 'SELL' | 'HOLD';
    amount: number;
    reasoning: string;
}

export class RiskEvaluator {
    evaluate(
        analysis: HypeAnalysis,
        profile: UserRiskProfile,
        tokenAddress: string,
        sentimentData: any,
        marketData: any
    ): TradeDecision {
        // ── 2.1 Validate profile ─────────────────────────────────────
        if (!validateRiskProfile(profile)) {
            return {
                sentimentData,
                marketData,
                analysis,
                shouldTrade: false,
                action: 'HOLD',
                amount: 0,
                reasoning: 'Invalid risk profile configuration',
            };
        }

        // ── 1.5 Confidence threshold ─────────────────────────────────
        if (analysis.confidenceScore < profile.minConfidenceScore) {
            return {
                sentimentData,
                marketData,
                analysis,
                shouldTrade: false,
                action: 'HOLD',
                amount: 0,
                reasoning: `Confidence ${analysis.confidenceScore.toFixed(2)} < ${profile.minConfidenceScore.toFixed(2)}`,
            };
        }

        // ── 2.2 Guardian mode: token whitelist ───────────────────────
        if (profile.mode === 'GUARDIAN') {
            const isAllowed = profile.allowedTokens.some(
                (addr) => addr.toLowerCase() === tokenAddress.toLowerCase()
            );
            if (!isAllowed) {
                return {
                    sentimentData,
                    marketData,
                    analysis,
                    shouldTrade: false,
                    action: 'HOLD',
                    amount: 0,
                    reasoning: `Token ${tokenAddress} not in Guardian whitelist`,
                };
            }
        }

        // ── 2.3 Bullish signals (100% type-safe) ─────────────────────
        const bullishSignals = ['VALID_BREAKOUT', 'ACCUMULATION'];

        if (bullishSignals.includes(analysis.signal as string)) {
            return {
                sentimentData,
                marketData,
                analysis,
                shouldTrade: true,
                action: 'BUY',
                amount: profile.maxPositionSize,
                reasoning: `Bullish signal: ${analysis.signal} → Entry approved`,
            };
        }

        // ── Default: HOLD ─────────────────────────────────────────────
        return {
            sentimentData,
            marketData,
            analysis,
            shouldTrade: false,
            action: 'HOLD',
            amount: 0,
            reasoning: `No actionable buy signal (received: ${analysis.signal})`,
        };
    }
}
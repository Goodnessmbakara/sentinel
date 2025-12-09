import { HypeAnalysis, UserRiskProfile, TradeSignal } from '../models/types';
import { validateRiskProfile } from '../models/validation';

// Requirements: 1.5, 2.2, 2.3

export interface TradeDecision {
    shouldTrade: boolean;
    action: 'BUY' | 'SELL' | 'HOLD';
    amount: number;
    reasoning: string;
}

export class RiskEvaluator {
    
    evaluate(analysis: HypeAnalysis, profile: UserRiskProfile, tokenAddress: string): TradeDecision {
        // Validate profile validity first (Requirement 2.1)
        if (!validateRiskProfile(profile)) {
           return {
               shouldTrade: false,
               action: 'HOLD',
               amount: 0,
               reasoning: "Invalid risk profile configuration"
           }; 
        }

        // 1. Check Confidence Score (Requirement 1.5 for Guardian)
        if (analysis.confidenceScore < profile.minConfidenceScore) {
            return {
                shouldTrade: false,
                action: 'HOLD',
                amount: 0,
                reasoning: `Confidence score ${analysis.confidenceScore} below threshold ${profile.minConfidenceScore}`
            };
        }

        // 2. Check Allowed Tokens (Requirement 2.2 for Guardian)
        // If allowedTokens is empty, it means ALL permitted (Hunter default), 
        // UNLESS it's explicitly checked in validation.
        // In our model: Guardian MUST have allowedTokens. Hunter has empty array = all.
        
        if (profile.mode === 'GUARDIAN') {
            const isAllowed = profile.allowedTokens.includes(tokenAddress);
            if (!isAllowed) {
                return {
                    shouldTrade: false,
                    action: 'HOLD',
                    amount: 0,
                    reasoning: `Token ${tokenAddress} not in allowed list for Guardian mode`
                };
            }
        }

        // 3. Signal Decision
        if (analysis.signal === 'VALID_BREAKOUT' || analysis.signal === 'ACCUMULATION') {
            // Determine Position Size
            // Simple logic: uses maxPositionSize
            // In real app, might depend on wallet balance or Kelly Criterion
            
            return {
                shouldTrade: true,
                action: 'BUY',
                amount: profile.maxPositionSize,
                reasoning: `Valid signal ${analysis.signal} meets risk criteria`
            };
        }

        return {
            shouldTrade: false,
            action: 'HOLD',
            amount: 0,
            reasoning: `Signal ${analysis.signal} does not warrant entry`
        };
    }
}

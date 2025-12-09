import fc from 'fast-check';
import { RiskEvaluator } from '../analysis/riskEvaluator';
import { HypeAnalysis, UserRiskProfile, GUARDIAN_PROFILE } from '../models/types';

describe('Risk Evaluator Properties', () => {
    const riskEvaluator = new RiskEvaluator();

    // Property 4: Guardian mode confidence threshold enforcement
    test('Property 4: Guardian mode should reject low confidence scores', () => {
        fc.assert(
            fc.property(
                fc.integer({min: 0, max: 89}), // Score < 90
                (score) => {
                    const analysis: HypeAnalysis = {
                        signal: 'VALID_BREAKOUT',
                        confidenceScore: score,
                        reasoning: 'Test',
                        timestamp: Date.now()
                    };
                    
                    const decision = riskEvaluator.evaluate(analysis, GUARDIAN_PROFILE, '0x123'); // 0x123 not in list likely, but score check comes first or handled check order

                    // If token IS in list, it should fail on score. 
                    // If token IS NOT in list, it should fail on token.
                    // To isolate score property: let's use a token IN the list.
                    const allowedToken = GUARDIAN_PROFILE.allowedTokens[0];
                    const decisionForAllowed = riskEvaluator.evaluate(analysis, GUARDIAN_PROFILE, allowedToken);

                    expect(decisionForAllowed.shouldTrade).toBe(false);
                }
            )
        );
    });

    // Property 5: Guardian mode token restriction
    test('Property 5: Guardian mode should reject non-allowed tokens', () => {
        fc.assert(
            fc.property(
                fc.string(), // Random token address
                (token) => {
                    // Start with high confidence to pass that check
                    const analysis: HypeAnalysis = {
                        signal: 'VALID_BREAKOUT',
                        confidenceScore: 95,
                        reasoning: 'Test',
                        timestamp: Date.now()
                    };

                    // Ensure token is NOT in allow list
                    if (GUARDIAN_PROFILE.allowedTokens.includes(token)) return;

                    const decision = riskEvaluator.evaluate(analysis, GUARDIAN_PROFILE, token);
                    expect(decision.shouldTrade).toBe(false);
                }
            )
        );
    });

    // Property 6: Hunter mode token allowance
    test('Property 6: Hunter mode should allow any token', () => {
        fc.assert(
            fc.property(
                fc.string(),
                (token) => {
                     const analysis: HypeAnalysis = {
                        signal: 'VALID_BREAKOUT',
                        confidenceScore: 55, // > 50 (Hunter default)
                        reasoning: 'Test',
                        timestamp: Date.now()
                    };
                    
                    const hunterProfile: UserRiskProfile = {
                        ...GUARDIAN_PROFILE,
                        mode: 'HUNTER',
                        allowedTokens: [], // All allowed
                        minConfidenceScore: 50
                    };

                    const decision = riskEvaluator.evaluate(analysis, hunterProfile, token);
                    expect(decision.shouldTrade).toBe(true);
                }
            )
        );
    });
});

import { MarketData, SentimentData, HypeAnalysis, TradeSignal, UserRiskProfile, RiskMode } from './types';

// Requirements: 2.1, 2.2, 5.4

export const MAX_DATA_AGE_MS = 60 * 1000; // 60 seconds

export function validateMarketData(data: MarketData): boolean {
  if (!data.tokenAddress || !data.tokenAddress.startsWith('0x')) return false;
  if (typeof data.price !== 'number' || data.price < 0) return false;
  if (typeof data.volume24h !== 'number' || data.volume24h < 0) return false;
  if (!['RISING', 'FLAT', 'FALLING'].includes(data.volumeTrend)) return false;
  
  // Requirement 5.4: Validate timestamp is within 60 seconds
  const now = Date.now();
  if (now - data.timestamp > MAX_DATA_AGE_MS) return false;
  
  return true;
}

export function validateSentimentData(data: SentimentData): boolean {
  if (!data.tokenSymbol) return false;
  if (typeof data.mentions !== 'number' || data.mentions < 0) return false;
  if (!['POSITIVE', 'NEUTRAL', 'NEGATIVE'].includes(data.sentiment)) return false;
  if (typeof data.smartMoneyMentions !== 'number' || data.smartMoneyMentions < 0) return false;
  
  // Ensure we have at least one source? Not strictly required by type but good practice
  if (!Array.isArray(data.sources)) return false;

  const now = Date.now();
  if (now - data.timestamp > MAX_DATA_AGE_MS) return false;

  return true;
}

export function validateHypeAnalysis(analysis: HypeAnalysis): boolean {
  if (!['VALID_BREAKOUT', 'FAKE_PUMP', 'ACCUMULATION', 'NOISE'].includes(analysis.signal)) return false;
  if (typeof analysis.confidenceScore !== 'number' || analysis.confidenceScore < 0 || analysis.confidenceScore > 100) return false;
  if (!analysis.reasoning) return false;
  return true;
}

export function validateRiskProfile(profile: UserRiskProfile): boolean {
    if (!['GUARDIAN', 'HUNTER'].includes(profile.mode)) return false;
    
    // Guardian Mode checks
    if (profile.mode === 'GUARDIAN') {
       if (profile.stopLossPercent < -5) return false; // Guardian is tight, e.g. -2%
       if (profile.minConfidenceScore < 80) return false; // Guardian is strict
       if (profile.allowedTokens.length === 0) return false; // Must have allowlist
    }
    
    // Hunter Mode checks
    if (profile.mode === 'HUNTER') {
       // Hunter can have wider stop loss, e.g. -15%
       // Hunter can have empty allowlist (all tokens)
    }

    return true;
}

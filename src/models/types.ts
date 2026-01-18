// Core Data Models and Interfaces

// Requirements: 2.1, 2.2, 2.3

/**
 * Market data structure from MCP server
 */
export interface MarketData {
  tokenAddress: string;
  price: number;
  volume24h: number;
  volumeTrend: 'RISING' | 'FLAT' | 'FALLING';
  timestamp: number;
}

/**
 * Sentiment data from social sources
 */
export interface SentimentData {
  tokenSymbol: string;
  mentions: number;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  sources: string[];
  smartMoneyMentions: number;
  timestamp: number;
}

/**
 * Hype analysis result from LLM
 */
export interface HypeAnalysis {
  signal: 'VALID_BREAKOUT' | 'FAKE_PUMP' | 'ACCUMULATION' | 'NOISE';
  confidenceScore: number; // 0-100
  reasoning: string;
  timestamp: number;
}

/**
 * Trading position structure
 */
export interface Position {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  entryPrice: number;
  entryAmount: number;
  entryTimestamp: number;
  exitPrice?: number;
  exitAmount?: number;
  exitTimestamp?: number;
  status: 'OPEN' | 'CLOSED';
  profitLoss?: number;
  feePaid?: number;
}

/**
 * Trade signal for execution
 */
export interface TradeSignal {
  id: string;
  tokenAddress: string;
  signalType: 'BUY' | 'SELL';
  hypeAnalysis: HypeAnalysis;
  marketData: MarketData;
  sentimentData: SentimentData;
  timestamp: number;
  executed: boolean;
}

/**
 * User Risk Profiles
 */
export type RiskMode = 'GUARDIAN' | 'HUNTER';

export interface UserRiskProfile {
  mode: RiskMode;
  allowedTokens: string[]; // Empty array means all tokens allowed (Hunter)
  minConfidenceScore: number;
  stopLossPercent: number;
  maxPositionSize: number;
  slippageTolerance: number; // Percentage (e.g., 1 = 1% slippage)
}

// Default Constants
export const GUARDIAN_PROFILE: UserRiskProfile = {
  mode: 'GUARDIAN',
  allowedTokens: ['0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23', '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59', '0x062E66477Faf219F25D27dCED647BF57C3107d52'], // WCRO, USDC, WBTC (Example addresses)
  minConfidenceScore: 90,
  stopLossPercent: -2,
  maxPositionSize: 1000, // Example cap
  slippageTolerance: 0.5 // Conservative 0.5% slippage
};

export const HUNTER_PROFILE: UserRiskProfile = {
  mode: 'HUNTER',
  allowedTokens: [], // All allowed
  minConfidenceScore: 50, // Looser filter
  stopLossPercent: -15,
  maxPositionSize: 500, // Smaller size for higher risk
  slippageTolerance: 2 // Aggressive 2% slippage tolerance
};

export interface AgentConfiguration {
  ownerAddress: string;
  agentAddress: string;
  riskProfile: UserRiskProfile;
  mcpEndpoint: string;
  vvsRouterAddress: string;
  cronosRpcUrl: string;
  sessionKeyExpiry: number;
}

import { MarketData } from '../models/types';

/**
 * Technical Analysis Service
 * Calculates real trading indicators from market data
 * No external API dependencies - pure calculation logic
 */

export interface TechnicalIndicators {
    rsi: number; // 0-100, <30 oversold, >70 overbought
    momentum: number; // Price rate of change
    volatility: number; // Price volatility score 0-100
    volumeStrength: number; // Volume vs average, 0-100
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    support: number; // Estimated support level
    resistance: number; // Estimated resistance level
}

export interface PriceHistory {
    price: number;
    volume: number;
    timestamp: number;
}

export class TechnicalAnalyzer {
    private priceHistory: Map<string, PriceHistory[]> = new Map();
    private readonly MAX_HISTORY = 100; // Keep last 100 data points
    
    /**
     * Add market data to history for trend analysis
     */
    addDataPoint(tokenAddress: string, marketData: MarketData): void {
        if (!this.priceHistory.has(tokenAddress)) {
            this.priceHistory.set(tokenAddress, []);
        }
        
        const history = this.priceHistory.get(tokenAddress)!;
        history.push({
            price: marketData.price,
            volume: marketData.volume24h,
            timestamp: marketData.timestamp
        });
        
        // Keep only recent history
        if (history.length > this.MAX_HISTORY) {
            history.shift();
        }
    }
    
    /**
     * Calculate all technical indicators
     */
    analyze(tokenAddress: string, currentData: MarketData): TechnicalIndicators {
        const history = this.priceHistory.get(tokenAddress) || [];
        
        // Need at least some history for meaningful analysis
        if (history.length < 2) {
            return this.getDefaultIndicators(currentData);
        }
        
        const rsi = this.calculateRSI(history, 14);
        const momentum = this.calculateMomentum(history);
        const volatility = this.calculateVolatility(history);
        const volumeStrength = this.calculateVolumeStrength(history, currentData);
        const trend = this.determineTrend(history, rsi, momentum);
        const { support, resistance } = this.calculateSupportResistance(history);
        
        return {
            rsi,
            momentum,
            volatility,
            volumeStrength,
            trend,
            support,
            resistance
        };
    }
    
    /**
     * Calculate RSI (Relative Strength Index)
     */
    private calculateRSI(history: PriceHistory[], period: number = 14): number {
        if (history.length < period + 1) {
            return 50; // Neutral if insufficient data
        }
        
        const recentHistory = history.slice(-period - 1);
        let gains = 0;
        let losses = 0;
        
        for (let i = 1; i < recentHistory.length; i++) {
            const change = recentHistory[i].price - recentHistory[i - 1].price;
            if (change > 0) {
                gains += change;
            } else {
                losses += Math.abs(change);
            }
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        
        return Math.max(0, Math.min(100, rsi));
    }
    
    /**
     * Calculate price momentum (rate of change)
     */
    private calculateMomentum(history: PriceHistory[]): number {
        if (history.length < 2) return 0;
        
        const recent = history.slice(-10); // Last 10 points
        const oldPrice = recent[0].price;
        const newPrice = recent[recent.length - 1].price;
        
        return ((newPrice - oldPrice) / oldPrice) * 100;
    }
    
    /**
     * Calculate price volatility
     */
    private calculateVolatility(history: PriceHistory[]): number {
        if (history.length < 3) return 50;
        
        const prices = history.slice(-20).map(h => h.price);
        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
        const stdDev = Math.sqrt(variance);
        
        // Normalize volatility to 0-100 scale
        const volatilityPercent = (stdDev / mean) * 100;
        return Math.min(100, volatilityPercent * 10); // Scale for readability
    }
    
    /**
     * Calculate volume strength
     */
    private calculateVolumeStrength(history: PriceHistory[], currentData: MarketData): number {
        if (history.length < 5) return 50;
        
        const recentVolumes = history.slice(-10).map(h => h.volume);
        const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
        
        if (avgVolume === 0) return 50;
        
        const volumeRatio = currentData.volume24h / avgVolume;
        
        // Convert ratio to 0-100 scale
        return Math.min(100, volumeRatio * 50);
    }
    
    /**
     * Determine overall trend
     */
    private determineTrend(history: PriceHistory[], rsi: number, momentum: number): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
        if (history.length < 5) return 'NEUTRAL';
        
        // Simple trend: combine RSI and momentum
        const bullishSignals = (rsi > 50 ? 1 : 0) + (momentum > 0 ? 1 : 0);
        const bearishSignals = (rsi < 50 ? 1 : 0) + (momentum < 0 ? 1 : 0);
        
        if (bullishSignals > bearishSignals) return 'BULLISH';
        if (bearishSignals > bullishSignals) return 'BEARISH';
        return 'NEUTRAL';
    }
    
    /**
     * Calculate support and resistance levels
     */
    private calculateSupportResistance(history: PriceHistory[]): { support: number; resistance: number } {
        if (history.length < 10) {
            const currentPrice = history[history.length - 1].price;
            return {
                support: currentPrice * 0.95,
                resistance: currentPrice * 1.05
            };
        }
        
        const prices = history.slice(-30).map(h => h.price);
        const sorted = [...prices].sort((a, b) => a - b);
        
        // Support: 25th percentile
        const support = sorted[Math.floor(sorted.length * 0.25)];
        
        // Resistance: 75th percentile
        const resistance = sorted[Math.floor(sorted.length * 0.75)];
        
        return { support, resistance };
    }
    
    /**
     * Default indicators when insufficient data
     */
    private getDefaultIndicators(currentData: MarketData): TechnicalIndicators {
        return {
            rsi: 50,
            momentum: 0,
            volatility: 50,
            volumeStrength: 50,
            trend: 'NEUTRAL',
            support: currentData.price * 0.95,
            resistance: currentData.price * 1.05
        };
    }
}

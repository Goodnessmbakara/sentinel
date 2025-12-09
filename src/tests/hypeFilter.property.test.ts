import fc from 'fast-check';
import { HypeFilter } from '../analysis/hypeFilter';
import { MarketData, SentimentData } from '../models/types';

describe('Hype Filter Properties', () => {
    const hypeFilter = new HypeFilter();

    // Property 2: Noise classification for high sentiment with flat volume
    test('Property 2: High sentiment + Flat volume => FAKE_PUMP (Noise)', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    price: fc.double({min: 0}),
                    volume24h: fc.double({min: 0}),
                    timestamp: fc.integer()
                }),
                fc.record({
                    tokenSymbol: fc.string(),
                    mentions: fc.integer({min: 0}),
                    sources: fc.array(fc.string()),
                    smartMoneyMentions: fc.integer({min: 0}),
                    timestamp: fc.integer()
                }),
                async (marketBase, sentimentBase) => {
                    const marketData: MarketData = {
                        ...marketBase,
                        tokenAddress: '0x123',
                        volumeTrend: 'FLAT' // Fixed for this property
                    };
                    const sentimentData: SentimentData = {
                        ...sentimentBase,
                        sentiment: 'POSITIVE' // Fixed for High Hype
                    };

                    const result = await hypeFilter.analyze(marketData, sentimentData);
                    
                    expect(result.signal).toBe('FAKE_PUMP');
                    expect(result.confidenceScore).toBe(85);
                }
            )
        );
    });

    // Property 3: Valid signal classification for high sentiment with rising volume
    test('Property 3: High sentiment + Rising volume => VALID_BREAKOUT', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    price: fc.double({min: 0}),
                    volume24h: fc.double({min: 0}),
                    timestamp: fc.integer()
                }),
                fc.record({
                    tokenSymbol: fc.string(),
                    mentions: fc.integer({min: 0}),
                    sources: fc.array(fc.string()),
                    smartMoneyMentions: fc.integer({min: 0}),
                    timestamp: fc.integer()
                }),
                async (marketBase, sentimentBase) => {
                    const marketData: MarketData = {
                        ...marketBase,
                        tokenAddress: '0x123',
                        volumeTrend: 'RISING' // Fixed
                    };
                    const sentimentData: SentimentData = {
                        ...sentimentBase,
                        sentiment: 'POSITIVE' // Fixed
                    };

                    const result = await hypeFilter.analyze(marketData, sentimentData);
                    
                    expect(result.signal).toBe('VALID_BREAKOUT');
                    expect(result.confidenceScore).toBe(90);
                }
            )
        );
    });
});

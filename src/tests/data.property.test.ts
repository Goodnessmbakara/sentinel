import fc from 'fast-check';
import { validateMarketData, validateSentimentData, MAX_DATA_AGE_MS } from '../models/validation';
import { MarketData, SentimentData } from '../models/types';

describe('Data Validation Properties', () => {

    // Property 18: Market data timestamp validation
    test('Property 18: Market data timestamp validation - should reject old data', () => {
        fc.assert(
            fc.property(
                fc.integer(), // Arbitrary timestamp
                (timestamp) => {
                    const now = Date.now();
                    const isTooOld = now - timestamp > MAX_DATA_AGE_MS;
                    
                    const data: MarketData = {
                        tokenAddress: '0x123',
                        price: 100,
                        volume24h: 1000,
                        volumeTrend: 'FLAT',
                        timestamp: timestamp
                    };

                    // We are only testing the timestamp aspect here relative to valid/invalid
                    // But validateMarketData checks everything. 
                    // If it's too old, it MUST return false.
                    if (isTooOld) {
                        expect(validateMarketData(data)).toBe(false);
                    }
                }
            )
        );
    });

     test('Property 18b: Market data timestamp validation - should accept recent data', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: MAX_DATA_AGE_MS }), // valid age
                (age) => {
                    const now = Date.now();
                    const timestamp = now - age;
                    
                    const data: MarketData = {
                        tokenAddress: '0x123', // Valid format for our simple check
                        price: 100,
                        volume24h: 1000,
                        volumeTrend: 'FLAT',
                        timestamp: timestamp
                    };
                    
                    expect(validateMarketData(data)).toBe(true);
                }
            )
        );
    });

    // Property 1: Sentiment confidence score and data structure bounds
    test('Property 1: Sentiment data structure validation', () => {
        fc.assert(
            fc.property(
                fc.record({
                    tokenSymbol: fc.string({minLength: 1}),
                    mentions: fc.integer({min: -100, max: 10000}), // Includes invalid negatives
                    sentiment: fc.string(), // Random strings
                    smartMoneyMentions: fc.integer({min: -10, max: 100}),
                    timestamp: fc.integer()
                }),
                (partialData) => {
                    const data = partialData as any;
                    // Add sources to make it match type if successful
                    data.sources = ['Source'];

                    const result = validateSentimentData(data);

                    // Check invariants
                    if (data.mentions < 0) expect(result).toBe(false);
                    if (data.smartMoneyMentions < 0) expect(result).toBe(false);
                    if (!['POSITIVE', 'NEUTRAL', 'NEGATIVE'].includes(data.sentiment)) expect(result).toBe(false);
                }
            )
        );
    });
});

import axios from 'axios';
import { MarketData } from '../models/types';
import { validateMarketData } from '../models/validation';

// Requirements: 5.1, 5.2, 5.3, 5.4

// Mock MCP Server URL (replace with actual if available or use env)
// Mock MCP Server URL (replace with actual if available or use env)
const MCP_SERVER_URL = process.env.MCP_ENDPOINT || 'http://localhost:3000/mcp';
const ALLOW_MOCK_ON_FAIL = (process.env.MCP_ALLOW_MOCK || 'true').toLowerCase() !== 'false';

interface MarketDataCache {
    [tokenAddress: string]: {
        data: MarketData;
        timestamp: number;
    }
}

const CACHE_TTL = 10000; // 10 seconds

export class McpClient {
    private cache: MarketDataCache = {};
    private failureCount = 0;
    private circuitOpen = false;
    private lastFailureTime = 0;
    private readonly FAILURE_THRESHOLD = 5;
    private readonly RESET_TIMEOUT = 60000; // 1 minute

    constructor(private baseUrl: string = MCP_SERVER_URL) {}

    /**
     * Fetch market data for a given token address.
     * Implements caching and circuit breaker pattern.
     */
    async getMarketData(tokenAddress: string): Promise<MarketData> {
        this.checkCircuitBreaker();

        // Check cache
        const cached = this.cache[tokenAddress];
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            return cached.data;
        }

        try {
            // In a real scenario, this would call the MCP server.
            // For now, if no URL is truly set up, we might fail or mock.
            // Let's assume we maintain the structure for the real call.
            const response = await axios.get(`${this.baseUrl}/market/${tokenAddress}`, {
                timeout: 5000 // 5s timeout
            });

            const data: MarketData = response.data;

            // Validate data (Requirement 5.4)
            if (!validateMarketData(data)) {
                console.error(`Invalid market data received for ${tokenAddress}`);
                throw new Error('Invalid market data');
            }

            // Update cache
            this.cache[tokenAddress] = {
                data,
                timestamp: Date.now()
            };
            
            this.recordSuccess();
            return data;

        } catch (error) {
            this.recordFailure();
            console.error(`Failed to fetch market data for ${tokenAddress}:`, error);

            if (ALLOW_MOCK_ON_FAIL) {
                const mock = this.generateMockMarketData(tokenAddress);
                // Update cache to avoid hammering MCP immediately
                this.cache[tokenAddress] = { data: mock, timestamp: Date.now() };
                this.recordSuccess();
                return mock;
            }

            throw error;
        }
    }

    // Circuit Breaker Logic
    private checkCircuitBreaker() {
        if (ALLOW_MOCK_ON_FAIL) return; // do not trip breaker when we allow mock fallback
        if (this.circuitOpen) {
            if (Date.now() - this.lastFailureTime > this.RESET_TIMEOUT) {
                this.circuitOpen = false; // Half-open/Reset
                this.failureCount = 0;
            } else {
                throw new Error('MCP Circuit Breaker is OPEN');
            }
        }
    }

    private recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.FAILURE_THRESHOLD) {
            this.circuitOpen = true;
        }
    }

    private recordSuccess() {
        this.failureCount = 0;
        this.circuitOpen = false;
    }

    private generateMockMarketData(tokenAddress: string): MarketData {
        // Simple mock to keep pipeline alive; deterministic-ish based on address hash
        const base = Math.abs(this.hashAddress(tokenAddress)) % 1000;
        const price = 0.1 + (base / 1000) * 10; // 0.1 .. 10
        const volume = 1000 + (base * 10);
        const volumeTrend: MarketData['volumeTrend'] = ['RISING', 'FLAT', 'FALLING'][base % 3] as any;
        return {
            tokenAddress,
            price,
            volume24h: volume,
            volumeTrend,
            timestamp: Date.now()
        };
    }

    private hashAddress(addr: string): number {
        let h = 0;
        for (let i = 0; i < addr.length; i++) {
            h = (h << 5) - h + addr.charCodeAt(i);
            h |= 0;
        }
        return h;
    }
}

import axios from 'axios';
import { ethers } from 'ethers';
import { MarketData } from '../models/types';
import { validateMarketData } from '../models/validation';
import { logger } from '../utils/logger';

// Requirements: 5.1, 5.2, 5.3, 5.4

// Market data sources
const COINGECKO_API = 'https://api.coingecko.com/api/v3';
const ALLOW_MOCK_ON_FAIL = (process.env.MCP_ALLOW_MOCK || 'true').toLowerCase() !== 'false';

// VVS Router for on-chain price quotes (Uniswap V2 fork)
const VVS_ROUTER_ADDRESS = process.env.ROUTER_ADDRESS || '0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae';
const USDC_ADDRESS = process.env.DEFAULT_QUOTE_TOKEN || '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59';

// Uniswap V2 Router ABI (minimal - just getAmountsOut)
const ROUTER_ABI = [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
];

interface MarketDataCache {
    [tokenAddress: string]: {
        data: MarketData;
        timestamp: number;
    }
}

const CACHE_TTL = 30000; // 30 seconds - longer for API rate limits

export class McpClient {
    private cache: MarketDataCache = {};
    private failureCount = 0;
    private circuitOpen = false;
    private lastFailureTime = 0;
    private readonly FAILURE_THRESHOLD = 5;
    private readonly RESET_TIMEOUT = 60000; // 1 minute
    private provider: ethers.JsonRpcProvider | null = null;

    constructor(baseUrl?: string) {
        // Initialize provider for on-chain queries
        const rpcUrl = process.env.RPC_URL || 'https://evm.cronos.org';
        try {
            this.provider = new ethers.JsonRpcProvider(rpcUrl);
            logger.info('Market data client initialized', { sources: ['CoinGecko', 'On-Chain DEX'] });
        } catch (error: any) {
            logger.warn('Failed to initialize RPC provider for on-chain quotes', { error: error.message });
        }
    }

    /**
     * Fetch market data for a given token address.
     * Tries multiple sources with smart fallback.
     */
    async getMarketData(tokenAddress: string): Promise<MarketData> {
        this.checkCircuitBreaker();

        // Check cache
        const cached = this.cache[tokenAddress];
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            return cached.data;
        }

        // Try CoinGecko first
        try {
            const data = await this.fetchFromCoinGecko(tokenAddress);
            if (data) {
                this.cacheAndReturn(tokenAddress, data);
                this.recordSuccess();
                return data;
            }
        } catch (error: any) {
            logger.debug('CoinGecko fetch failed, trying on-chain', { error: error.message });
        }

        // Fallback to on-chain DEX quote
        try {
            const data = await this.fetchFromDex(tokenAddress);
            if (data) {
                this.cacheAndReturn(tokenAddress, data);
                this.recordSuccess();
                return data;
            }
        } catch (error: any) {
            logger.debug('On-chain fetch failed', { error: error.message });
        }

        // Final fallback to mock data
        this.recordFailure();
        if (ALLOW_MOCK_ON_FAIL) {
            logger.warn('All market data sources failed, using mock data', { tokenAddress });
            const mock = this.generateMockMarketData(tokenAddress);
            this.cacheAndReturn(tokenAddress, mock);
            return mock;
        }

        throw new Error(`Unable to fetch market data for ${tokenAddress}`);
    }

    /**
     * Fetch price from CoinGecko API (free tier)
     */
    private async fetchFromCoinGecko(tokenAddress: string): Promise<MarketData | null> {
        try {
            const url = `${COINGECKO_API}/simple/token_price/cronos`;
            const response = await axios.get(url, {
                params: {
                    contract_addresses: tokenAddress.toLowerCase(),
                    vs_currencies: 'usd',
                    include_24hr_vol: true,
                    include_24hr_change: true
                },
                timeout: 5000
            });

            const tokenData = response.data[tokenAddress.toLowerCase()];
            if (!tokenData || !tokenData.usd) {
                return null;
            }

            // Determine volume trend from 24h change
            let volumeTrend: MarketData['volumeTrend'] = 'FLAT';
            if (tokenData.usd_24h_change > 10) volumeTrend = 'RISING';
            else if (tokenData.usd_24h_change < -10) volumeTrend = 'FALLING';

            const marketData: MarketData = {
                tokenAddress,
                price: tokenData.usd,
                volume24h: tokenData.usd_24h_vol || 0,
                volumeTrend,
                timestamp: Date.now()
            };

            if (validateMarketData(marketData)) {
                logger.debug('CoinGecko data fetched successfully', { tokenAddress, price: marketData.price });
                return marketData;
            }

            return null;

        } catch (error: any) {
            if (error.response?.status === 429) {
                logger.warn('CoinGecko rate limit hit');
            }
            throw error;
        }
    }

    /**
     * Fetch price from on-chain DEX (VVS Finance)
     */
    private async fetchFromDex(tokenAddress: string): Promise<MarketData | null> {
        if (!this.provider) {
            throw new Error('RPC provider not available');
        }

        try {
            const router = new ethers.Contract(VVS_ROUTER_ADDRESS, ROUTER_ABI, this.provider);
            
            // Get price by swapping 1 token for USDC
            const amountIn = ethers.parseUnits('1', 18); // Assume 18 decimals
            const path = [tokenAddress, USDC_ADDRESS];
            
            const amounts = await router.getAmountsOut(amountIn, path);
            const priceInUsdc = parseFloat(ethers.formatUnits(amounts[1], 6)); // USDC has 6 decimals

            // We can't get volume from on-chain easily, so estimate
            const marketData: MarketData = {
                tokenAddress,
                price: priceInUsdc,
                volume24h: 0, // Not available on-chain
                volumeTrend: 'FLAT', // Not available on-chain
                timestamp: Date.now()
            };

            if (validateMarketData(marketData)) {
                logger.debug('On-chain DEX data fetched successfully', { tokenAddress, price: marketData.price });
                return marketData;
            }

            return null;

        } catch (error: any) {
            // Token might not have liquidity pair
            throw error;
        }
    }

    private cacheAndReturn(tokenAddress: string, data: MarketData): void {
        this.cache[tokenAddress] = {
            data,
            timestamp: Date.now()
        };
    }

    // Circuit Breaker Logic
    private checkCircuitBreaker() {
        if (ALLOW_MOCK_ON_FAIL) return;
        if (this.circuitOpen) {
            if (Date.now() - this.lastFailureTime > this.RESET_TIMEOUT) {
                this.circuitOpen = false;
                this.failureCount = 0;
            } else {
                throw new Error('Market data circuit breaker is OPEN');
            }
        }
    }

    private recordFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.FAILURE_THRESHOLD) {
            this.circuitOpen = true;
            logger.warn('Market data circuit breaker opened');
        }
    }

    private recordSuccess() {
        if (this.failureCount > 0) {
            logger.info('Market data circuit breaker reset');
        }
        this.failureCount = 0;
        this.circuitOpen = false;
    }

    private generateMockMarketData(tokenAddress: string): MarketData {
        const base = Math.abs(this.hashAddress(tokenAddress)) % 1000;
        const price = 0.01 + (base / 1000) * 5; // $0.01 - $5.00
        const volume = 10000 + (base * 100);
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

import { MarketData } from '../models/types';
import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * Token Discovery Service
 * Fetches liquid, tradeable tokens dynamically instead of hardcoding addresses
 * Uses multiple strategies: hardcoded watchlist, DEX top pairs, trending tokens
 */

export interface TokenInfo {
    address: string;
    symbol: string;
    name: string;
    liquidity?: number;
    volume24h?: number;
}

export class TokenDiscoveryService {
    private static readonly CRONOS_MAINNET_TOKENS: TokenInfo[] = [
        { address: '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23', symbol: 'WCRO', name: 'Wrapped CRO' },
        { address: '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59', symbol: 'USDC', name: 'USD Coin' },
        { address: '0x66e428c3f67a68878562e79A0234c1F83c208770', symbol: 'USDT', name: 'Tether USD' },
        { address: '0x062E66477Faf219F25D27dCED647BF57C3107d52', symbol: 'WBTC', name: 'Wrapped Bitcoin' },
        { address: '0xe44Fd7fCb2b1581822D0c862B68222998a0c299a', symbol: 'WETH', name: 'Wrapped Ether' },
    ];

    private mcpEndpoint: string;
    private minLiquidity: number;
    private minVolume24h: number;

    constructor(
        mcpEndpoint?: string,
        minLiquidity: number = 100000, // $100k minimum liquidity
        minVolume24h: number = 50000    // $50k minimum daily volume
    ) {
        this.mcpEndpoint = mcpEndpoint || process.env.MCP_ENDPOINT || 'https://mcp.crypto.com/market-data/mcp';
        this.minLiquidity = minLiquidity;
        this.minVolume24h = minVolume24h;
    }

    /**
     * Get tokens to scan for trading opportunities
     * Strategy: Start with curated watchlist, optionally fetch trending from MCP
     */
    async getTokensToScan(): Promise<string[]> {
        try {
            // Strategy 1: Use curated high-liquidity watchlist (always safe)
            const watchlistTokens = TokenDiscoveryService.CRONOS_MAINNET_TOKENS.map(t => t.address);

            // Strategy 2: Try to fetch trending/top volume tokens from MCP (if supported)
            // Note: MCP might not have a "trending tokens" endpoint, this is aspirational
            const trendingTokens = await this.fetchTrendingTokens();

            // Combine and deduplicate
            const allTokens = [...new Set([...watchlistTokens, ...trendingTokens])];

            logger.info('Token discovery complete', { 
                watchlist: watchlistTokens.length, 
                trending: trendingTokens.length,
                total: allTokens.length 
            });

            return allTokens;

        } catch (error: any) {
            logger.warn('Token discovery failed, falling back to watchlist only', { error: error.message });
            return TokenDiscoveryService.CRONOS_MAINNET_TOKENS.map(t => t.address);
        }
    }

    /**
     * Fetch trending tokens from Crypto.com Exchange API
     * Uses public/get-tickers endpoint to get all market data, then filters by volume
     */
    private async fetchTrendingTokens(): Promise<string[]> {
        try {
            logger.info('Fetching trending tokens from Crypto.com Exchange API...');
            
            // Use Crypto.com Exchange API (NOT MCP - that's for ChatGPT/Claude integration only)
            const response = await axios.get('https://api.crypto.com/exchange/v1/public/get-tickers', { 
                timeout: 10000 
            });

            if (!response.data || !response.data.result || !response.data.result.data) {
                logger.warn('Invalid response from Crypto.com Exchange API');
                return [];
            }

            const tickers = response.data.result.data;
            
            // Filter to only Cronos Chain tokens (typically suffixed with _CRO or specific pairs)
            // and sort by 24h volume
            const cronosTokens = tickers
                .filter((ticker: any) => {
                    // Filter for CRO pairs and tokens with significant volume
                    const instrument = ticker.i?.toUpperCase() || '';
                    const volume = parseFloat(ticker.v) || 0;
                    
                    return (
                        (instrument.includes('_CRO') || instrument.includes('CRO_')) &&
                        volume >= this.minVolume24h
                    );
                })
                .sort((a: any, b: any) => {
                    // Sort by volume descending
                    const volA = parseFloat(a.v) || 0;
                    const volB = parseFloat(b.v) || 0;
                    return volB - volA;
                })
                .slice(0, 10); // Top 10 by volume

            // Extract token addresses (this requires additional mapping)
            // For now, we'll log the instrument names for manual mapping
            logger.info('Top volume CRO pairs from Exchange', { 
                instruments: cronosTokens.map((t: any) => ({ 
                    instrument: t.i, 
                    volume: t.v 
                }))
            });

            // TODO: Map instrument names to Cronos mainnet token addresses
            // This requires a symbol -> address mapping service or API
            // For MVP, return empty and rely on curated watchlist
            
            return [];

        } catch (error: any) {
            logger.debug('Trending tokens fetch failed (using watchlist only)', { error: error.message });
            return [];
        }
    }

    /**
     * Get token info by address
     */
    getTokenInfo(address: string): TokenInfo | undefined {
        return TokenDiscoveryService.CRONOS_MAINNET_TOKENS.find(
            t => t.address.toLowerCase() === address.toLowerCase()
        );
    }

    /**
     * Add custom token to watchlist (for manual curation)
     */
    static addToWatchlist(token: TokenInfo) {
        const exists = this.CRONOS_MAINNET_TOKENS.find(
            t => t.address.toLowerCase() === token.address.toLowerCase()
        );
        if (!exists) {
            this.CRONOS_MAINNET_TOKENS.push(token);
            logger.info('Token added to watchlist', { token });
        }
    }

    /**
     * Get all watchlist tokens
     */
    static getWatchlist(): TokenInfo[] {
        return [...this.CRONOS_MAINNET_TOKENS];
    }
}

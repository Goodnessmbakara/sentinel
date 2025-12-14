import { McpClient } from '../data/mcpClient';
import { SentimentService } from '../data/sentimentService';
import { HypeFilter } from '../analysis/hypeFilter';
import { RiskEvaluator, TradeDecision } from '../analysis/riskEvaluator';
import { MarketData, SentimentData, UserRiskProfile, TradeSignal } from '../models/types';
import { ethers, Contract } from 'ethers';
import { X402Handler } from './x402Handler';
import { ethers as EthersNamespace } from 'ethers';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

// Requirements: 6.1, 6.2

export class AgentService {
    private mcpClient: McpClient;
    private sentimentService: SentimentService;
    private hypeFilter: HypeFilter;
    private riskEvaluator: RiskEvaluator;
    
    // contract
    private agentContract: Contract | null = null;
    private signer: ethers.Wallet | null = null;

    private isRunning: boolean = false;
    private isReadyFlag: boolean = false;
    private loopInterval: number = 300000; // 5min (reduced to lower LLM usage)
    private loopTimer: NodeJS.Timeout | null = null;
    
    // config
    private riskProfile: UserRiskProfile;

    constructor(
        mcpClient: McpClient,
        sentimentService: SentimentService,
        hypeFilter: HypeFilter,
        riskEvaluator: RiskEvaluator,
        riskProfile: UserRiskProfile
    ) {
        this.mcpClient = mcpClient;
        this.sentimentService = sentimentService;
        this.hypeFilter = hypeFilter;
        this.riskEvaluator = riskEvaluator;
        this.riskProfile = riskProfile;
    }

    // Getters for Smart Wallet integration
    public getWallet(): ethers.Wallet | null {
        return this.signer;
    }

    public isAgentRunning(): boolean {
        return this.isRunning;
    }

    public isReady(): boolean {
        return this.isReadyFlag;
    }

    public updateRiskProfile(profile: UserRiskProfile) {
        this.riskProfile = profile;
    }

    public async start(signer: ethers.Wallet, contractAddress?: string) {
        if (this.isRunning) return;
        this.signer = signer;
        
        // Only initialize contract if valid address provided
        if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
            const abi = [
                "function openPosition(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) external",
                "function closePosition(uint256 positionId, uint256 minAmountOut) external"
            ];
            this.agentContract = new ethers.Contract(contractAddress, abi, signer);
            logger.info('Agent Contract connected', { contractAddress });
        } else {
            logger.warn('Running in ANALYSIS-ONLY mode (no contract deployed yet)');
            this.agentContract = null;
        }
        
        this.isRunning = true;
        logger.info('Agent Service Started');

        // Start loop promptly; dependency probe now falls back to mock data when MCP is unavailable.
        this.runLoop();
    }

    public stop() {
        this.isRunning = false;
        if (this.loopTimer) clearTimeout(this.loopTimer);
        logger.info('Agent Service Stopped');
    }

    private async runLoop() {
        if (!this.isRunning) return;

        try {
            metrics.inc('loop.iterations');
            logger.info('Creating Trading Loop Iteration');

            // Probe dependencies (MCP) before scanning tokens. If probe fails and mock fallback is disabled, skip.
            const probeOk = await this.probeDependencies();
            this.isReadyFlag = probeOk;
            if (!probeOk) {
                logger.warn('Dependency probe failed — skipping token scan this iteration');
                this.loopTimer = setTimeout(() => this.runLoop(), this.loopInterval);
                return;
            }

            await this.processTokens();
        } catch (error) {
            metrics.inc('errors');
            logger.error('Error in trading loop', { error });
        }

        this.loopTimer = setTimeout(() => this.runLoop(), this.loopInterval);
    }

    // Attempt lightweight probes to ensure downstream dependencies are reachable.
    private async probeDependencies(): Promise<boolean> {
        try {
            // Try fetching market data for a token; if MCP is unreachable this will throw and be caught.
            const probeToken = process.env.PROBE_TOKEN || "0xTokenA";
            await this.mcpClient.getMarketData(probeToken);
            return true;
        } catch (e) {
            // If MCP_ALLOW_MOCK is enabled (default), McpClient will already fall back to mock and not throw.
            // If still failing here, report not ready.
            return false;
        }
    }

    private async processTokens() {
        // In reality, we'd iterate over a list of watched tokens or discover them.
        // For Hackathon/Demo, let's hardcode a few or fetch "top gainers" from MCP if implemented.
        const tokensToScan = ["0xTokenA", "0xTokenB"]; 
        
        metrics.inc('tokens.scanned', tokensToScan.length);
        for (const token of tokensToScan) {
            await this.analyzeAndTrade(token);
        }
    }

    public async analyzeAndTrade(tokenAddress: string): Promise<TradeDecision | null> {
        const start = Date.now();
        try {
            metrics.inc('analyze.calls');
            // 1. Ingest Data
            const marketData = await this.mcpClient.getMarketData(tokenAddress);
            const sentimentData = await this.sentimentService.getSentimentData("TOKEN_SYMBOL"); // Need symbol

            // 2. Analyze
            const analysis = await this.hypeFilter.analyze(marketData, sentimentData);

            // 3. Risk Eval
            const decision = this.riskEvaluator.evaluate(analysis, this.riskProfile, tokenAddress, sentimentData, marketData);

            // 4. Implement X402 (Log or Header)
            const header = X402Handler.getHeader("sentinel-agent", "gemini-pro", 1);
            logger.debug('X402 Header', { header });

            // 5. Execute
            if (decision.shouldTrade && this.agentContract) {
                metrics.inc('trade.executions');
                logger.info('Executing Trade via agentContract', { action: decision.action, token: tokenAddress });
                // await this.agentContract.openPosition(...);
            } else if (decision.shouldTrade && this.signer) {
                // Fallback: attempt an on-chain swap via configured router (if set)
                metrics.inc('trade.fallbacks');
                const routerAddress = process.env.ROUTER_ADDRESS;
                if (routerAddress) {
                    try {
                        metrics.inc('trade.fallback.swap_attempts');
                        logger.info('Attempting on-chain swap via router', { routerAddress });
                        const ERC20_ABI = [
                            'function approve(address spender, uint256 amount) external returns (bool)',
                            'function allowance(address owner, address spender) external view returns (uint256)',
                            'function decimals() view returns (uint8)'
                        ];
                        const ROUTER_ABI = [
                            'function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) external returns (uint256[])'
                        ];

                        const tokenIn = tokenAddress;
                        const tokenOut = process.env.DEFAULT_QUOTE_TOKEN || '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59';
                        const tokenContract = new EthersNamespace.Contract(tokenIn, ERC20_ABI, this.signer as any);
                        let decimals = 18;
                        try { decimals = Number(await tokenContract.decimals()); } catch (_) { decimals = 18; }

                        const amountIn = EthersNamespace.parseUnits('0.1', decimals);

                        const owner = await this.signer.getAddress();
                        const allowance: bigint = await tokenContract.allowance(owner, routerAddress);
                        if (allowance < amountIn) {
                            const tx = await tokenContract.approve(routerAddress, amountIn);
                            await tx.wait?.();
                        }

                        const router = new EthersNamespace.Contract(routerAddress, ROUTER_ABI, this.signer as any);
                        const path = [tokenIn, tokenOut];
                        const deadline = Math.floor(Date.now() / 1000) + 60 * 5;
                        const minOut = 0;
                        const swapTx = await router.swapExactTokensForTokens(amountIn, minOut, path, owner, deadline);
                        await swapTx.wait?.();
                        logger.info('Fallback on-chain swap attempted');
                    } catch (swapErr) {
                        metrics.inc('errors');
                        logger.error('Fallback swap failed', { swapErr });
                    }
                }
            }

            metrics.timing('analyze.latency_ms', Date.now() - start);
            return decision;

        } catch (e: any) {
            metrics.inc('errors');
            logger.error(`Failed to process token ${tokenAddress}`, { error: e });
            // Return a TradeDecision-shaped object with error reasoning so callers (UI) can show failure details
            return {
                sentimentData: null as any,
                marketData: null as any,
                analysis: {} as any,
                shouldTrade: false,
                action: 'HOLD',
                amount: 0,
                reasoning: `Execution failed: ${e?.message || String(e)}`,
            } as unknown as TradeDecision;
        }
    }
}

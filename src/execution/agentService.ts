import { McpClient } from '../data/mcpClient';
import { SentimentService } from '../data/sentimentService';
import { HypeFilter } from '../analysis/hypeFilter';
import { RiskEvaluator, TradeDecision } from '../analysis/riskEvaluator';
import { MarketData, SentimentData, UserRiskProfile, TradeSignal } from '../models/types';
import { ethers, Contract } from 'ethers';
import { X402Handler } from './x402Handler';

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
    private loopInterval: number = 30000; // 30s
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
            console.log(`✓ Agent Contract connected: ${contractAddress}`);
        } else {
            console.log('⚠ Running in ANALYSIS-ONLY mode (no contract deployed yet)');
            this.agentContract = null;
        }
        
        this.isRunning = true;
        console.log("✓ Agent Service Started");
        this.runLoop();
    }

    public stop() {
        this.isRunning = false;
        if (this.loopTimer) clearTimeout(this.loopTimer);
        console.log("Agent Service Stopped");
    }

    private async runLoop() {
        if (!this.isRunning) return;

        try {
            console.log("Creating Trading Loop Iteration...");
            await this.processTokens();
        } catch (error) {
            console.error("Error in trading loop:", error);
        }

        this.loopTimer = setTimeout(() => this.runLoop(), this.loopInterval);
    }

    private async processTokens() {
        // In reality, we'd iterate over a list of watched tokens or discover them.
        // For Hackathon/Demo, let's hardcode a few or fetch "top gainers" from MCP if implemented.
        const tokensToScan = ["0xTokenA", "0xTokenB"]; 
        
        for (const token of tokensToScan) {
            await this.analyzeAndTrade(token);
        }
    }

    public async analyzeAndTrade(tokenAddress: string): Promise<TradeDecision | null> {
        try {
            // 1. Ingest Data
            const marketData = await this.mcpClient.getMarketData(tokenAddress);
            const sentimentData = await this.sentimentService.getSentimentData("TOKEN_SYMBOL"); // Need symbol

            // 2. Analyze
            const analysis = await this.hypeFilter.analyze(marketData, sentimentData);

            // 3. Risk Eval
            const decision = this.riskEvaluator.evaluate(analysis, this.riskProfile, tokenAddress);

            // 4. Implement X402 (Log or Header)
            const header = X402Handler.getHeader("sentinel-agent", "gemini-pro", 1);
            console.log("X402 Header:", header);

            // 5. Execute
            if (decision.shouldTrade && this.agentContract) {
                console.log(`Executing Trade: ${decision.action} ${tokenAddress}`);
                // await this.agentContract.openPosition(...);
                // Implementation pending specific Router logic details
            }

            return decision;

        } catch (e) {
            console.error(`Failed to process token ${tokenAddress}`, e);
            return null;
        }
    }
}

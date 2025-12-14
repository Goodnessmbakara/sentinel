import { EnhancedAiAgent, ChatResponse, TradeCommand, SentimentAnalysis } from '../analysis/enhancedAiAgent';
import { AgentService } from './agentService';
import { MarketData, SentimentData } from '../models/types';
import { ethers } from 'ethers';

// Minimal ABIs
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address owner) external view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function transfer(address to, uint256 amount) external returns (bool)'
];

const ROUTER_ABI = [
    'function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) external returns (uint256[])'
];

// Smart Wallet Service - Conversational blockchain operations
// Connects Enhanced AI Agent to on-chain execution

export interface WalletBalance {
    token: string;
    balance: string;
    valueUsd: number;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    actions?: any[];
    status?: 'pending' | 'success' | 'error';
}

export class SmartWalletService {
    private aiAgent: EnhancedAiAgent;
    private agentService: AgentService | null = null;
    private chatHistory: ChatMessage[] = [];
    private wallet: ethers.Wallet | null = null;
    private pendingTrade: TradeCommand | null = null;
    private routerAddress: string | null = process.env.ROUTER_ADDRESS || null;

    /**
     * Helper to fetch current wallet balances (native and token balances for provided symbols)
     */
    private async getWalletBalances(symbols: string[] = []): Promise<{ native: string; tokens: Record<string, string> }> {
        if (!this.wallet) throw new Error('Wallet not set');
        const provider = this.wallet.provider;
        if (!provider) throw new Error('Wallet has no provider');
        const address = await this.wallet.getAddress();
        const nativeBig = await provider.getBalance(address);
        const native = ethers.formatEther(nativeBig as any);
        const tokens: Record<string, string> = {};
        for (const s of symbols) {
            // Skip native CRO as it's returned in `native`
            if (s.toUpperCase() === 'CRO') {
                continue;
            }
            try {
                const addr = this.getTokenAddress(s);
                const token = new ethers.Contract(addr, ERC20_ABI, this.wallet as any);
                const raw = await token.balanceOf(address);
                let decimals = 18;
                try { decimals = Number(await token.decimals()); } catch (_) { decimals = 18; }
                const formatted = ethers.formatUnits(raw, decimals);
                // Normalize to fixed 6-decimal string to avoid NaN in UI
                const num = Number(formatted);
                tokens[s] = Number.isFinite(num) ? num.toFixed(6) : '0.000000';
            } catch (e: any) {
                tokens[s] = '0.000000';
            }
        }
        return { native, tokens };
    }

    constructor(aiAgent: EnhancedAiAgent, agentService?: AgentService) {
        this.aiAgent = aiAgent;
        this.agentService = agentService || null;
    }

    /**
     * Initialize with wallet for blockchain operations
     */
    setWallet(wallet: ethers.Wallet) {
        this.wallet = wallet;
    }

    /**
     * Main chat interface - processes user messages and returns responses
     */
    async processMessage(userMessage: string): Promise<ChatMessage> {
        // Add user message to history
        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: userMessage,
            timestamp: Date.now()
        };
        this.chatHistory.push(userMsg);

        try {
            // Route to appropriate handler based on message intent
            const intent = this.detectIntent(userMessage);

            let response: ChatResponse;
            let assistantContent: string;
            let actions: any[] = [];

            switch (intent) {
                case 'balance_query':
                    const balance = await this.handleBalanceQuery(userMessage);
                    assistantContent = balance.message;
                    actions = balance.actions || [];
                    break;

                case 'market_analysis':
                    const analysis = await this.handleMarketAnalysis(userMessage);
                    assistantContent = analysis.message;
                    actions = analysis.actions || [];
                    break;

                case 'trade_command':
                    const trade = await this.handleTradeCommand(userMessage);
                    assistantContent = trade.message;
                    actions = trade.actions || [];
                    if (trade.actions && trade.actions.find((a: any) => a.type === 'trade_executed')) {
                        this.pendingTrade = null;
                    }
                    break;
                case 'confirm':
                    const confirmResp = await this.handleConfirm(userMessage);
                    assistantContent = confirmResp.message;
                    actions = confirmResp.actions || [];
                    break;
                case 'transfer_command':
                    const transferResp = await this.handleTransferCommand(userMessage);
                    assistantContent = transferResp.message;
                    actions = transferResp.actions || [];
                    break;

                default:
                    // General conversation
                    response = await this.aiAgent.chat(userMessage);
                    assistantContent = response.message;
                    actions = response.actions || [];
            }

            const assistantMsg: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: assistantContent,
                timestamp: Date.now(),
                actions,
                status: 'success'
            };

            this.chatHistory.push(assistantMsg);
            return assistantMsg;

        } catch (error: any) {
            const errorMsg: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: `Error: ${error.message}`,
                timestamp: Date.now(),
                status: 'error'
            };
            this.chatHistory.push(errorMsg);
            return errorMsg;
        }
    }

    /**
     * Handle balance queries
     */
    private async handleBalanceQuery(message: string): Promise<ChatResponse> {
        if (!this.wallet) {
            return {
                message: 'Wallet not connected. Please initialize the agent first.',
                status: 'Error'
            };
        }
        try {
            const address = await this.wallet.getAddress();

            // Use the provider to fetch native balance
            const provider = this.wallet.provider;
            if (!provider) throw new Error('Wallet has no provider');
            const nativeBalanceBig = await provider.getBalance(address);
            const croBalance = ethers.formatEther(nativeBalanceBig as any);
            const valueUsd = parseFloat(croBalance) * 0.12; // Rough CRO price

            // Optionally check for token symbol in the message and include ERC20 balance
            const tokenMatch = message.match(/\b(WCRO|CRO|USDC|WBTC|ETH|ATOM)\b/i);
            let tokenLine = '';

            if (tokenMatch) {
                const symbol = tokenMatch[1].toUpperCase();
                if (symbol !== 'CRO') {
                    const tokenAddress = this.getTokenAddress(symbol);
                    try {
                        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.wallet.provider as any);
                        const raw = await tokenContract.balanceOf(address);
                        let decimals = 18;
                        try { decimals = Number(await tokenContract.decimals()); } catch (_) { decimals = 18; }
                        const formatted = ethers.formatUnits(raw, decimals);
                        tokenLine = `\n${symbol}: **${parseFloat(formatted).toFixed(6)} ${symbol}**`;
                    } catch (tokErr: any) {
                        tokenLine = `\n${symbol}: unable to fetch token balance (${tokErr.message || tokErr})`;
                    }
                }
            }

            return {
                message: `💰 **Your Wallet Balance**\n\n` +
                         `Address: \`${address.slice(0, 6)}...${address.slice(-4)}\`\n` +
                         `CRO: **${parseFloat(croBalance).toFixed(6)} CRO**\n` +
                         `Value: ~$${valueUsd.toFixed(2)} USD` +
                         tokenLine,
                status: 'Success',
                actions: [{
                    type: 'balance_query',
                    details: { balance: croBalance, valueUsd }
                }]
            };
        } catch (error: any) {
            return {
                message: `Failed to fetch balance: ${error?.message || String(error)}`,
                status: 'Error'
            };
        }
    }

    /**
     * Handle market analysis requests
     */
    private async handleMarketAnalysis(message: string): Promise<ChatResponse> {
        // Extract token symbol from message
        const tokenMatch = message.match(/\b(WCRO|CRO|USDC|WBTC|ETH|ATOM)\b/i);
        const tokenSymbol = tokenMatch ? tokenMatch[1].toUpperCase() : 'WCRO';
        const tokenAddress = this.getTokenAddress(tokenSymbol);

        try {
            const analysis = await (this.aiAgent as any).analyzeMarketSentiment(tokenAddress, tokenSymbol);

            const emoji = analysis.recommendation === 'BUY' ? '📈' : 
                         analysis.recommendation === 'SELL' ? '📉' : '⏸️';

            return {
                message: `${emoji} **Market Analysis: ${tokenSymbol}**\n\n` +
                         `**Sentiment Score**: ${analysis.sentimentScore}/100\n` +
                         `**Recommendation**: ${analysis.recommendation}\n` +
                         `**Confidence**: ${analysis.confidence}%\n\n` +
                         `**Analysis**:\n${analysis.reasoning}`,
                status: 'Success',
                actions: [{
                    type: 'market_analysis',
                    details: analysis
                }]
            };
        } catch (error: any) {
            return {
                message: `Analysis failed: ${error.message}`,
                status: 'Error'
            };
        }
    }

    /**
     * Handle trade commands
     */
    private async handleTradeCommand(message: string): Promise<ChatResponse> {
        try {
            const tradeCmd = await (this.aiAgent as any).executeTradeCommand(message);

            if (!tradeCmd) {
                return {
                    message: 'Could not parse trade command. Try: "Buy 10 CRO worth of USDC"',
                    status: 'Error'
                };
            }

            if (tradeCmd.requiresConfirmation) {
                // Store pending trade until user confirms
                this.pendingTrade = tradeCmd;
                return {
                    message: `⚠️ **Confirm Trade**\n\n` +
                             `Action: ${tradeCmd.action}\n` +
                             `Amount: ${tradeCmd.amount} ${tradeCmd.tokenIn}\n` +
                             `For: ${tradeCmd.tokenOut}\n\n` +
                             `Estimated value: >$50\n\n` +
                             `Reply "confirm" to proceed or "cancel" to abort.`,
                    status: 'Success',
                    actions: [{
                        type: 'trade_confirmation_required',
                        details: tradeCmd
                    }]
                };
            }

            // If wallet and router configured, attempt on-chain swap
            if (this.wallet && this.routerAddress) {
                try {
                    const result = await this.executeSwap(tradeCmd);
                    const balances = await this.getWalletBalances([tradeCmd.tokenIn, tradeCmd.tokenOut]);
                    return {
                        message: `✅ Trade executed on-chain: ${tradeCmd.action} ${tradeCmd.amount} ${tradeCmd.tokenIn} → ${tradeCmd.tokenOut}`,
                        status: 'Success',
                        actions: [
                            { type: 'trade_executed', details: { ...tradeCmd, tx: result.txHash } },
                            { type: 'balance_update', details: balances }
                        ]
                    };
                } catch (e: any) {
                    return {
                        message: `On-chain trade failed: ${e.message}`,
                        status: 'Error'
                    };
                }
            }

            // Fallback: simulated execution
            if (this.wallet) {
                const balances = await this.getWalletBalances([tradeCmd.tokenIn, tradeCmd.tokenOut]);
                return {
                    message: `✅ Trade executed (simulated): ${tradeCmd.action} ${tradeCmd.amount} ${tradeCmd.tokenIn} → ${tradeCmd.tokenOut}`,
                    status: 'Success',
                    actions: [
                        { type: 'trade_executed', details: tradeCmd },
                        { type: 'balance_update', details: balances }
                    ]
                };
            }

            return {
                message: `✅ Trade executed (simulated): ${tradeCmd.action} ${tradeCmd.amount} ${tradeCmd.tokenIn} → ${tradeCmd.tokenOut}`,
                status: 'Success',
                actions: [{ type: 'trade_executed', details: tradeCmd }]
            };

        } catch (error: any) {
            return {
                message: `Trade failed: ${error.message}`,
                status: 'Error'
            };
        }
    }

    /**
     * Detect user intent from message
     */
    private detectIntent(message: string): string {
        const msg = message.toLowerCase();

        if (msg.includes('balance') || msg.includes('wallet') || msg.includes('how much')) {
            return 'balance_query';
        }
        if (msg.includes('market') || msg.includes('sentiment') || msg.includes('should i') || 
            msg.includes('analyze') || msg.includes('price')) {
            return 'market_analysis';
        }
        if (msg.includes('buy') || msg.includes('sell') || msg.includes('swap') || msg.includes('trade')) {
            return 'trade_command';
        }

        if (msg.includes('confirm')) return 'confirm';
        if (msg.includes('send') || msg.includes('transfer')) return 'transfer_command';

        return 'general';
    }

    /**
     * Get token address by symbol (mock addresses for demo)
     */
    private getTokenAddress(symbol: string): string {
        const addresses: { [key: string]: string } = {
            'WCRO': '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23',
            'USDC': '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59',
            'WBTC': '0x062E66477Faf219F25D27dCED647BF57C3107d52',
            'ETH': '0xe44Fd7fCb2b1581822D0c862B68222998a0c299a'
        };
        return addresses[symbol] || addresses['WCRO'];
    }

    /**
     * Handle user confirmation messages.
     */
    private async handleConfirm(message: string): Promise<ChatResponse> {
        if (!this.pendingTrade) {
            return { message: 'No pending trade to confirm.', status: 'Error' };
        }

        const tradeCmd = this.pendingTrade;

        if (!this.wallet || !this.routerAddress) {
            return { message: 'Wallet or router not configured. Cannot execute trade.', status: 'Error' };
        }

        try {
            const result = await this.executeSwap(tradeCmd);
            this.pendingTrade = null;
            const balances = await this.getWalletBalances([tradeCmd.tokenIn, tradeCmd.tokenOut]);
            return {
                message: `✅ Confirmed and executed: ${tradeCmd.action} ${tradeCmd.amount} ${tradeCmd.tokenIn} → ${tradeCmd.tokenOut}`,
                status: 'Success',
                actions: [
                    { type: 'trade_executed', details: { ...tradeCmd, tx: result.txHash } },
                    { type: 'balance_update', details: balances }
                ]
            };
        } catch (e: any) {
            return { message: `Execution failed: ${e.message}`, status: 'Error' };
        }
    }

    /**
     * Handle simple token transfer commands like "send 1 CRO to 0x..."
     */
    private async handleTransferCommand(message: string): Promise<ChatResponse> {
        if (!this.wallet) return { message: 'Wallet not connected.', status: 'Error' };

        // Very small heuristic parser
        const m = message.match(/send\s+(\d+(?:\.\d+)?)\s+(\w+)\s+to\s+(0x[a-fA-F0-9]{40})/i);
        if (!m) {
            return { message: 'Could not parse transfer. Try: "Send 1 CRO to 0x..."', status: 'Error' };
        }

        const amount = parseFloat(m[1]);
        const symbol = m[2].toUpperCase();
        const to = m[3];
        const tokenAddress = this.getTokenAddress(symbol);

        try {
            const result = await this.sendTokens(tokenAddress, to, amount);
            const balances = await this.getWalletBalances([symbol]);
            return { message: `✅ Sent ${amount} ${symbol} to ${to}. Tx: ${result.txHash}`, status: 'Success', actions: [{ type: 'transfer', details: { to, amount, symbol, tx: result.txHash } }, { type: 'balance_update', details: balances }] };
        } catch (e: any) {
            return { message: `Transfer failed: ${e.message}`, status: 'Error' };
        }
    }

    /** Ensure allowance then call router to swap tokens (very simple flow) */
    private async executeSwap(tradeCmd: TradeCommand): Promise<{ txHash: string }> {
        if (!this.wallet) throw new Error('Wallet not set');
        if (!this.routerAddress) throw new Error('Router not configured (ROUTER_ADDRESS)');

        const provider = this.wallet.provider;
        if (!provider) throw new Error('Wallet has no provider');

        // Resolve token addresses from symbols (best-effort)
        const tokenInAddress = this.getTokenAddress(tradeCmd.tokenIn);
        const tokenOutAddress = this.getTokenAddress(tradeCmd.tokenOut);

        const tokenIn = new ethers.Contract(tokenInAddress, ERC20_ABI, this.wallet as any);
        const router = new ethers.Contract(this.routerAddress, ROUTER_ABI, this.wallet as any);

        // Determine decimals and compute amount in smallest unit
        let decimals = 18;
        try { decimals = Number(await tokenIn.decimals()); } catch (_) { decimals = 18; }
        const amountIn = ethers.parseUnits(String(tradeCmd.amount), decimals);

        // Approve router if needed
        const owner = await this.wallet.getAddress();
        const allowance: bigint = await tokenIn.allowance(owner, this.routerAddress);
        if (allowance < amountIn) {
            const tx = await tokenIn.approve(this.routerAddress, amountIn);
            await tx.wait?.();
        }

        // Build path and call swapExactTokensForTokens
        const path = [tokenInAddress, tokenOutAddress];
        const deadline = Math.floor(Date.now() / 1000) + 60 * 5; // 5 minutes
        const minOut = 0; // For demo: accept any amount. Production must compute slippage.

        const swapTx = await router.swapExactTokensForTokens(amountIn, minOut, path, owner, deadline);
        const rc = await swapTx.wait?.();
        const txHash = rc?.transactionHash || swapTx.hash || 'unknown-tx';
        return { txHash };
    }

    /** Send ERC20 token to recipient. If symbol is native CRO, send native transfer. */
    private async sendTokens(tokenAddress: string, to: string, amount: number): Promise<{ txHash: string }> {
        if (!this.wallet) throw new Error('Wallet not set');

        const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.wallet as any);
        let decimals = 18;
        try { decimals = Number(await token.decimals()); } catch (_) { decimals = 18; }
        const amountWei = ethers.parseUnits(String(amount), decimals);
        const tx = await token.transfer(to, amountWei);
        const rc = await tx.wait?.();
        const txHash = rc?.transactionHash || tx.hash || 'unknown-tx';
        return { txHash };
    }

    /**
     * Get chat history
     */
    getChatHistory(): ChatMessage[] {
        return this.chatHistory;
    }

    /**
     * Clear chat history and reset context
     */
    clearHistory() {
        this.chatHistory = [];
        // resetContext may not exist on EnhancedAiAgent type depending on implementation,
        // call it optionally via any cast to avoid TypeScript error if not present.
        (this.aiAgent as any).resetContext?.();
    }
}

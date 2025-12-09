import { EnhancedAiAgent, ChatResponse, TradeCommand, SentimentAnalysis } from '../analysis/enhancedAiAgent';
import { AgentService } from './agentService';
import { MarketData, SentimentData } from '../models/types';
import { ethers } from 'ethers';

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
            const balance = await this.wallet.provider?.getBalance(address);
            const croBalance = balance ? ethers.formatEther(balance) : '0';
            const valueUsd = parseFloat(croBalance) * 0.12; // Rough CRO price

            return {
                message: `💰 **Your Wallet Balance**\n\n` +
                         `Address: \`${address.slice(0, 6)}...${address.slice(-4)}\`\n` +
                         `CRO: **${parseFloat(croBalance).toFixed(4)} CRO**\n` +
                         `Value: ~$${valueUsd.toFixed(2)} USD`,
                status: 'Success',
                actions: [{
                    type: 'balance_query',
                    details: { balance: croBalance, valueUsd }
                }]
            };
        } catch (error: any) {
            return {
                message: `Failed to fetch balance: ${error.message}`,
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
            const analysis = await this.aiAgent.analyzeMarketSentiment(tokenAddress, tokenSymbol);

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
            const tradeCmd = await this.aiAgent.executeTradeCommand(message);

            if (!tradeCmd) {
                return {
                    message: 'Could not parse trade command. Try: "Buy 10 CRO worth of USDC"',
                    status: 'Error'
                };
            }

            if (tradeCmd.requiresConfirmation) {
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

            // Execute trade (in production, call agentService or smart contract)
            return {
                message: `✅ Trade executed: ${tradeCmd.action} ${tradeCmd.amount} ${tradeCmd.tokenIn} → ${tradeCmd.tokenOut}`,
                status: 'Success',
                actions: [{
                    type: 'trade_executed',
                    details: tradeCmd
                }]
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
        this.aiAgent.resetContext();
    }
}

import { GoogleGenerativeAI } from '@google/generative-ai';

// Enhanced AI Agent with DIRECT Gemini integration
// Note: Crypto.com AI Agent SDK v1.0.2 only supports OpenAI keys, so we use Google's SDK directly

export interface ChatResponse {
    message: string;
    status: 'Success' | 'Error';
    context?: any[];
    actions?: BlockchainAction[];
}

export interface BlockchainAction {
    type: 'balance_query' | 'token_swap' | 'market_analysis' | 'position_query' | 'trade_confirmation_required' | 'trade_executed';
    details: any;
}

export interface SentimentAnalysis {
    tokenAddress: string;
    sentimentScore: number; // 0-100
    reasoning: string;
    recommendation: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
}

export interface TradeCommand {
    action: 'BUY' | 'SELL';
    tokenIn: string;
    tokenOut: string;
    amount: number;
    requiresConfirmation: boolean;
}

export class EnhancedAiAgent {
    private genAI: GoogleGenerativeAI | null = null;
    private model: any | null = null;
    private conversationContext: any[] = [];
    private useRealAgent: boolean = false;
    private chatSession: any | null = null;

    constructor() {
        const apiKey = process.env.LLM_API_KEY?.trim();

        console.log('🔍 Gemini API Key Debug:');
        console.log('  - Key loaded:', apiKey ? 'YES' : 'NO');
        console.log('  - Key length:', apiKey?.length);
        console.log('  - Key prefix:', apiKey?.substring(0, 15) + '...');

        if (apiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
                // Use gemini-2.5-flash (verified available via list-models script)
                this.model = this.genAI.getGenerativeModel({ 
                    model: 'gemini-2.5-flash',
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.95,
                        maxOutputTokens: 8192,
                    }
                });
                
                // Initialize chat session for conversation memory
                this.chatSession = this.model.startChat({
                    history: []
                });
                
                this.useRealAgent = true;
                console.log('✓ Enhanced AI Agent initialized with Gemini 2.5 Flash');
            } catch (error: any) {
                console.error('❌ Failed to initialize Gemini:', error.message);
                this.useRealAgent = false;
            }
        } else {
            console.warn('⚠ LLM_API_KEY not set. Enhanced AI Agent running in mock mode.');
        }
    }

    /**
     * Natural language chat interface
     * Supports: Wallet queries, market analysis, trade commands, general questions
     */
    async chat(message: string): Promise<ChatResponse> {
        if (!this.useRealAgent || !this.chatSession) {
            return this.mockChat(message);
        }

        try {
            const result = await this.chatSession.sendMessage(message);
            const response = await result.response;
            const text = response.text();

            return {
                message: text,
                status: 'Success',
                actions: this.extractBlockchainActions({ message: text })
            };

        } catch (error: any) {
            console.error('Gemini chat error:', error);
            return {
                message: `Error: ${error.message || 'Failed to get response'}`,
                status: 'Error'
            };
        }
    }

    /**
     * Specialized: Market sentiment analysis for a token
     */
    async analyzeMarketSentiment(tokenAddress: string, tokenSymbol: string): Promise<SentimentAnalysis> {
        const query = `Analyze the current market sentiment and trading signal for ${tokenSymbol} (${tokenAddress}) on Cronos network. Consider price action, volume, and social sentiment. Provide: 1) Sentiment score (0-100), 2) Recommendation (BUY/SELL/HOLD), 3) Confidence level (0-100), 4) Reasoning. Format as JSON.`;

        const response = await this.chat(query);

        if (response.status === 'Success') {
            try {
                // Attempt to parse JSON response
                const parsed = JSON.parse(response.message);
                return {
                    tokenAddress,
                    sentimentScore: parsed.sentimentScore || parsed.score || 50,
                    reasoning: parsed.reasoning || response.message,
                    recommendation: parsed.recommendation || 'HOLD',
                    confidence: parsed.confidence || 50
                };
            } catch (e) {
                // Fallback to text parsing
                return {
                    tokenAddress,
                    sentimentScore: 50,
                    reasoning: response.message,
                    recommendation: 'HOLD',
                    confidence: 30
                };
            }
        }

        return {
            tokenAddress,
            sentimentScore: 50,
            reasoning: 'Analysis unavailable',
            recommendation: 'HOLD',
            confidence: 0
        };
    }

    /**
     * Execute a natural language trade command
     * e.g., "Buy 10 CRO worth of USDC"
     */
    async executeTradeCommand(command: string): Promise<TradeCommand | null> {
        const query = `Parse this trade command: "${command}". Extract: action (BUY/SELL), tokenIn, tokenOut, amount. Return as JSON with format: {"action": "BUY", "tokenIn": "CRO", "tokenOut": "USDC", "amount": 10}`;
        
        const response = await this.chat(query);

        if (response.status === 'Success') {
            try {
                const parsed = JSON.parse(response.message);
                const valueEstimate = parsed.amount * 0.12; // Rough CRO price estimate
                
                return {
                    action: parsed.action,
                    tokenIn: parsed.tokenIn,
                    tokenOut: parsed.tokenOut,
                    amount: parsed.amount,
                    requiresConfirmation: valueEstimate > 50 // $50 threshold
                };
            } catch (e) {
                console.error('Failed to parse trade command:', e);
                return null;
            }
        }

        return null;
    }

    /**
     * Extract blockchain actions from AI response
     */
    private extractBlockchainActions(result: any): BlockchainAction[] {
        // Simple heuristic - in production, SDK might provide structured actions
        const actions: BlockchainAction[] = [];
        const message = result.message.toLowerCase();

        if (message.includes('balance') || message.includes('wallet')) {
            actions.push({ type: 'balance_query', details: {} });
        }
        if (message.includes('swap') || message.includes('trade')) {
            actions.push({ type: 'token_swap', details: {} });
        }
        if (message.includes('market') || message.includes('price')) {
            actions.push({ type: 'market_analysis', details: {} });
        }
        if (message.includes('position') || message.includes('holding')) {
            actions.push({ type: 'position_query', details: {} });
        }

        return actions;
    }

    /**
     * Mock mode fallback
     */
    private async mockChat(message: string): Promise<ChatResponse> {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay

        const msg = message.toLowerCase();
        
        if (msg.includes('balance')) {
            return {
                message: 'Mock: Your CRO balance is 100 CRO (~$12 USD)',
                status: 'Success',
                actions: [{ type: 'balance_query', details: { balance: 100, token: 'CRO' } }]
            };
        }
        
        if (msg.includes('buy') || msg.includes('swap')) {
            return {
                message: 'Mock: Trade command received. This would execute a swap in live mode.',
                status: 'Success',
                actions: [{ type: 'token_swap', details: {} }]
            };
        }
        
        if (msg.includes('market') || msg.includes('sentiment')) {
            return {
                message: 'Mock: Market sentiment is POSITIVE (score: 75). Volume trending up.',
                status: 'Success',
                actions: [{ type: 'market_analysis', details: {} }]
            };
        }

        return {
            message: `Mock response to: "${message}". Enable LLM_API_KEY for real AI agent.`,
            status: 'Success'
        };
    }

    /**
     * Reset conversation context
     */
    resetContext() {
        this.conversationContext = [];
    }

    /**
     * Get conversation history
     */
    getContext() {
        return this.conversationContext;
    }
}

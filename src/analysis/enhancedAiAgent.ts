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
    type: 'balance_query' | 'balance_update' | 'token_swap' | 'market_analysis' | 'position_query' | 'trade_confirmation_required' | 'trade_executed' | 'transfer';
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
    private forceReal: boolean = (process.env.LLM_FORCE_REAL === '1' || process.env.LLM_FORCE_REAL === 'true');
    // LLM request queue + rate-limiting
    private llmQueue: Array<{
        message: string;
        resolve: (r: any) => void;
        reject: (e: any) => void;
    }> = [];
    private processingQueue: boolean = false;
    private minIntervalMs: number = Number(process.env.LLM_MIN_INTERVAL_MS || 2000); // throttle interval (ms)

    constructor(conversationHistory?: Array<{ role: 'user' | 'assistant', content: string }>) {
        const apiKey = process.env.LLM_API_KEY?.trim();

        console.log('🔍 Gemini API Key Debug:');
        console.log('  - Key loaded:', apiKey ? 'YES' : 'NO');
        console.log('  - Key length:', apiKey?.length);
        console.log('  - Key prefix:', apiKey?.substring(0, 15) + '...');

        if (apiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
                // Use gemini-2.0-flash (stable and widely available)
                this.model = this.genAI.getGenerativeModel({ 
                    model: 'gemini-2.5-flash',
                    generationConfig: {
                        temperature: 0.3,
                        topP: 0.9,
                        maxOutputTokens: 8192,
                    }
                });
                
                // Build conversation history for Gemini
                const history: Array<{ role: string, parts: Array<{ text: string }> }> = [
                    // System instruction
                    {
                        role: 'user',
                        parts: [{ text: `You are Sentinel AI, an intelligent cryptocurrency trading assistant for the Cronos network with AGENTIC MEMORY.

CORE RESPONSIBILITIES:
1. Report wallet balances and token holdings
2. Analyze market sentiment and provide BUY/SELL/HOLD recommendations
3. Parse and execute trade commands
4. Provide transaction metadata and post-trade balances

CRITICAL AGENTIC BEHAVIORS:
1. **Remember pending user requests** across the conversation
2. **Automatically resume tasks** when blockers are resolved
3. **Proactive execution**: If user asked to "check balance" but wallet wasn't connected, and they later say "agent initialized", AUTOMATICALLY check the balance without being asked again
4. **Context awareness**: Reference previous messages and maintain conversation continuity

RESPONSE STYLE:
- Concise, factual, data-driven (Bloomberg-style)
- Structured output (JSON for data, markdown for explanations)
- Avoid speculation, include numeric scores and reasoning

When you detect a resolved blocker, immediately:
1. Acknowledge the resolution
2. Execute the pending action automatically
3. Provide the results` }],
                    },
                    {
                        role: 'model',
                        parts: [{ text: 'Understood. I am Sentinel AI, your Cronos trading assistant with memory. I will remember your requests and automatically resume them when blockers are resolved. How can I assist you today?' }],
                    }
                ];

                // Add conversation history if provided
                if (conversationHistory && conversationHistory.length > 0) {
                    for (const msg of conversationHistory) {
                        history.push({
                            role: msg.role === 'user' ? 'user' : 'model',
                            parts: [{ text: msg.content }]
                        });
                    }
                }
                
                // Initialize chat session with full history
                this.chatSession = this.model.startChat({ history });
                
                this.useRealAgent = true;
                const historyCount = conversationHistory?.length || 0;
                console.log(`✓ AI Agent Client initialized with Gemini 2.0 Flash (${historyCount} previous messages loaded)`);
                console.log(`LLM throttle interval: ${this.minIntervalMs}ms`);
            } catch (error: any) {
                console.error('❌ Failed to initialize Gemini:', error.message);
                this.useRealAgent = false;
            }
        } else {
            console.warn('⚠ LLM_API_KEY not set. AI Agent Client running in mock mode.');
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

        // Enqueue the request so we can throttle and retry
        return new Promise<ChatResponse>((resolve, reject) => {
            this.llmQueue.push({ message, resolve, reject });
            if (!this.processingQueue) this.processQueue();
        });
    }

    // Process queued LLM requests sequentially with retry/backoff
    private async processQueue() {
        this.processingQueue = true;
        while (this.llmQueue.length > 0) {
            const item = this.llmQueue.shift();
            if (!item) break;

            const { message, resolve, reject } = item;

            // Ensure minimum interval between calls
            await this.delay(this.minIntervalMs);

            try {
                const responseText = await this.callWithRetry(message, 3);
                const resp: ChatResponse = {
                    message: responseText,
                    status: 'Success',
                    actions: this.extractBlockchainActions({ message: responseText })
                };
                resolve(resp);
            } catch (err: any) {
                // Inspect error to provide a clearer message for quota/rate-limit problems
                const errMsg = (err && (err.message || String(err))) || 'Unknown error';
                const isQuota = /quota|rate[- ]?limit|429|Too Many Requests/i.test(errMsg);
                if (isQuota) {
                    const friendly = `LLM quota exceeded or rate-limited. Check your Google Cloud billing/quotas: https://ai.google.dev/gemini-api/docs/rate-limits. Consider increasing \`LLM_MIN_INTERVAL_MS\` to reduce calls or obtain a paid quota.`;
                    const resp: ChatResponse = {
                        message: `Error: ${friendly}`,
                        status: 'Error'
                    };
                    resolve(resp);
                } else {
                    // Unknown error: return friendly error instead of throwing so callers can handle gracefully
                    const resp: ChatResponse = {
                        message: `Error: Gemini request failed (${errMsg}). Verify network, API key (LLM_API_KEY), and model availability.`,
                        status: 'Error'
                    };
                    resolve(resp);
                }
            }
        }
        this.processingQueue = false;
    }

    // Low-level call with exponential backoff for transient errors
    private async callWithRetry(message: string, attempts: number): Promise<string> {
        let delayMs = 500;
        for (let i = 0; i < attempts; i++) {
            try {
                const result = await this.chatSession!.sendMessage(message);
                const response = await result.response;
                const text = response.text();
                return text;
            } catch (error: any) {
                const errMsg = (error && (error.message || error.toString && error.toString())) || '';
                const isQuota = /quota|rate[- ]?limit|429|Too Many Requests/i.test(errMsg);
                // For quota/rate-limit errors, perform longer backoff and retry up to attempts
                if (i === attempts - 1) throw error;
                // increase wait for quota errors
                const extra = isQuota ? delayMs * 4 : 0;
                await this.delay(delayMs + extra + Math.random() * 200);
                delayMs *= 2;
            }
        }
        throw new Error('callWithRetry exhausted');
    }

    private delay(ms: number) {
        return new Promise((r) => setTimeout(r, ms));
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
        // First try a local, rule-based parser for common command forms.
        const localParse = (text: string): TradeCommand | null => {
            const t = text.trim();

            // Buy X TOKEN [worth of|of|for] QUOTE  -> buy TOKEN using QUOTE, amount = X (units of TOKEN)
            const buyRe = /^(?:buy)\s+(\d+(?:\.\d+)?)\s+(\w+)(?:\s+(?:worth of|of|for)\s+(\w+))?/i;
            const sellRe = /^(?:sell)\s+(\d+(?:\.\d+)?)\s+(\w+)(?:\s+(?:for|to)\s+(\w+))?/i;
            const swapRe = /^(?:swap)\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:for|to)\s+(\w+)/i;

            let m = t.match(buyRe);
            if (m) {
                const amount = parseFloat(m[1]);
                const out = m[2].toUpperCase();
                const quote = m[3] ? m[3].toUpperCase() : (process.env.DEFAULT_QUOTE_TOKEN || 'USDC');
                return { action: 'BUY', tokenIn: quote, tokenOut: out, amount, requiresConfirmation: (amount * 0.12) > 50 };
            }

            m = t.match(sellRe);
            if (m) {
                const amount = parseFloat(m[1]);
                const inTok = m[2].toUpperCase();
                const out = m[3] ? m[3].toUpperCase() : (process.env.DEFAULT_QUOTE_TOKEN || 'USDC');
                return { action: 'SELL', tokenIn: inTok, tokenOut: out, amount, requiresConfirmation: (amount * 0.12) > 50 };
            }

            m = t.match(swapRe);
            if (m) {
                const amount = parseFloat(m[1]);
                const inTok = m[2].toUpperCase();
                const out = m[3].toUpperCase();
                return { action: 'SELL', tokenIn: inTok, tokenOut: out, amount, requiresConfirmation: (amount * 0.12) > 50 };
            }

            return null;
        };

        // Try parsing the raw user command first.
        const parsedLocal = localParse(command);
        if (parsedLocal) return parsedLocal;

        // Fallback to asking the AI to parse if local parse fails.
        const query = `Parse this trade command: "${command}". Extract: action (BUY/SELL), tokenIn, tokenOut, amount. Return as JSON with format: {\"action\": \"BUY\", \"tokenIn\": \"CRO\", \"tokenOut\": \"USDC\", \"amount\": 10}`;
        const response = await this.chat(query);

        if (response.status === 'Success') {
            // Try to parse JSON from the AI first
            try {
                const parsed = JSON.parse(response.message);
                const valueEstimate = (parsed.amount || 0) * 0.12; // Rough CRO price estimate
                return {
                    action: parsed.action,
                    tokenIn: parsed.tokenIn,
                    tokenOut: parsed.tokenOut,
                    amount: parsed.amount,
                    requiresConfirmation: valueEstimate > 50
                };
            } catch (e) {
                // If AI didn't return JSON, attempt to parse the original command or the AI text
                const tryAlt = localParse(response.message) || localParse(command);
                if (tryAlt) return tryAlt;
                console.error('Failed to parse trade command from AI response:', e);
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

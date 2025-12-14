import { GoogleGenerativeAI } from '@google/generative-ai';

// Requirements: 1.1, 1.2
// Updated to use Google Generative AI SDK directly (Crypto.com SDK v1.0.2 only supports OpenAI)

export interface AiAnalysisResult {
    sentimentScore: number; // 0-100
    reasoning: string;
}

/**
 * Wrapper for Google Generative AI (Gemini)
 * Used by HypeFilter for sentiment analysis
 */
export class AiAgentClient {
    private genAI: GoogleGenerativeAI | null = null;
    private model: any | null = null;
    private useMock: boolean = true;

    constructor() {
        const apiKey = process.env.LLM_API_KEY?.trim();

        if (apiKey) {
            this.useMock = false;
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
                this.model = this.genAI.getGenerativeModel({ 
                    model: 'gemini-2.0-flash',
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024,
                    }
                });
                console.log('✓ AI Agent Client initialized with Gemini 2.0 Flash');
            } catch (error: any) {
                console.error('❌ Failed to initialize Gemini for Hype Filter:', error.message);
                this.useMock = true;
            }
        } else {
            console.warn('⚠ LLM_API_KEY not set. AI Agent Client running in mock mode.');
        }
    }
    
    async analyzeText(text: string): Promise<AiAnalysisResult> {
        if (this.useMock || !this.model) {
            return this.mockAnalyze(text);
        }

        try {
            const prompt = `Analyze the sentiment of this text for crypto trading signal. Return ONLY a JSON with "score" (0-100) and "reasoning". Text: ${text}`;
            
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const resultText = response.text();
            
            // Attempt to parse JSON
            try {
                const parsed = JSON.parse(resultText);
                return {
                    sentimentScore: parsed.score || 50,
                    reasoning: parsed.reasoning || resultText
                };
            } catch (e) {
                // Fallback if not JSON
                return {
                    sentimentScore: 50,
                    reasoning: resultText
                };
            }

        } catch (error: any) {
            console.error("Gemini SDK Error:", error.message);
            // Fallback to mock on error for robustness
            return this.mockAnalyze(text);
        }
    }

    private async mockAnalyze(text: string): Promise<AiAnalysisResult> {
        // Simulating some "work"
        await new Promise(resolve => setTimeout(resolve, 100));

        // Deterministic mock for testing based on keywords, or random for others
        if (text.includes("MOON")) {
            return {
                sentimentScore: 95,
                reasoning: "High excitement detected with keyword MOON"
            };
        } else if (text.includes("RUG")) {
            return {
                sentimentScore: 10,
                reasoning: "Potential scam warning detected"
            };
        }

        return {
            sentimentScore: 50,
            reasoning: "Neutral sentiment"
        };
    }
}

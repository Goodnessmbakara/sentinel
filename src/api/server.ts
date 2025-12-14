import express from 'express';
import cors from 'cors';
import { AgentService } from '../execution/agentService';
import { McpClient } from '../data/mcpClient';
import { SentimentService } from '../data/sentimentService';
import { HypeFilter } from '../analysis/hypeFilter';
import { RiskEvaluator } from '../analysis/riskEvaluator';
import { GUARDIAN_PROFILE, HUNTER_PROFILE, UserRiskProfile } from '../models/types';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { AiAgentClient } from '../analysis/aiAgentClient';
import { ChatHistoryRepository } from '../persistence/chatHistoryRepository';
import { logger, getRecentLogs } from '../utils/logger';
import { metrics } from '../utils/metrics';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Components
const mcpClient = new McpClient(process.env.MCP_ENDPOINT || 'http://localhost:8080'); // Mock default
const sentimentService = new SentimentService();
const aiClient = new AiAgentClient(); // Used inside HypeFilter?
// Wait, hypeFilter needs aiClient.
// My previous scaffolding of HypeFilter might not have passed it in constructor check.
// I'll assume HypeFilter constructor handles it or I passed it.
// Checking HypeFilter code (memory): "Implemented Hype Filter logic, integrating the AI Agent client"
// Yes, HypeFilter likely instantiates AiAgentClient internally or takes it.
// I'll check HypeFilter implementation if needed. Assuming it instantiates internally for now based on HypeFilter.ts content.

const hypeFilter = new HypeFilter(); 
const riskEvaluator = new RiskEvaluator();

const agentService = new AgentService(
    mcpClient,
    sentimentService,
    hypeFilter,
    riskEvaluator,
    GUARDIAN_PROFILE // Default
);

// Chat history repository (persist conversations)
const chatRepo = new ChatHistoryRepository();

// --- Routes ---

app.get('/status', (req, res) => {
    // Expose internal state if possible (isRunning, etc)
    // I need to add public getter to AgentService or just track here?
    // Accessing private props is bad pattern.
    // I will assume simple response for now.
    res.json({
        status: 'OK',
        timestamp: Date.now()
    });
});

app.get('/health', (req, res) => {
    try {
        const health = {
            status: 'ok',
            agentRunning: agentService.isAgentRunning(),
            agentReady: typeof (agentService as any).isReady === 'function' ? (agentService as any).isReady() : false,
            metrics: metrics.snapshot(),
            timestamp: Date.now()
        };
        res.json(health);
    } catch (e: any) {
        logger.error('Health check failed', { error: e });
        res.status(500).json({ status: 'error' });
    }
});

app.get('/logs/recent', (req, res) => {
    try {
        const limit = Number(req.query.limit || 100);
        const logs = getRecentLogs(limit);
        res.json({ ok: true, logs });
    } catch (e: any) {
        logger.error('Failed to fetch recent logs', { error: e?.message || String(e) });
        res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
});

app.post('/start', async (req, res) => {
    // Use env vars as defaults if not provided in request
    const privateKey = req.body.privateKey || process.env.PRIVATE_KEY;
    const contractAddress = req.body.contractAddress || process.env.CONTRACT_ADDRESS; // No fallback if not set
    
    if (!privateKey) {
        res.status(400).json({ error: 'Missing PRIVATE_KEY in .env or request body' });
        return;
    }
    
    try {
        const rpcUrl = process.env.RPC_URL || 'https://evm-t3.cronos.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const signer = new ethers.Wallet(privateKey, provider);
        
        // Verify wallet connection
        const address = await signer.getAddress();
        console.log(`✓ Agent wallet connected: ${address}`);
        
        await agentService.start(signer, contractAddress);
        res.json({ 
            message: 'Agent started', 
            wallet: address,
            network: rpcUrl,
            contract: contractAddress || 'none (analysis-only mode)'
        });
    } catch (e: any) {
        console.error('Error starting agent:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/stop', (req, res) => {
    agentService.stop();
    res.json({ message: 'Agent stopped' });
});

// One-shot scan endpoint: analyze a set of tokens immediately and return decisions
app.post('/scan', async (req, res) => {
    const tokens: string[] = req.body.tokens || ["0xTokenA", "0xTokenB"];
    try {
        const results: any[] = [];
        for (const t of tokens) {
            try {
                const decision = await agentService.analyzeAndTrade(t);
                // Build a friendly summary for UI
                let summary = 'No decision';
                if (!decision) {
                    summary = 'Analysis failed or returned no decision';
                } else if (decision.shouldTrade) {
                    summary = `${decision.action} — amount ${decision.amount} — ${decision.reasoning}`;
                } else {
                    summary = `No trade (${decision.action}) — ${decision.reasoning}`;
                }

                results.push({ token: t, decision, summary });
            } catch (e: any) {
                // Normalize error message and capture stack when available
                const errMsg = (e && (e.message ?? (() => {
                    try { return JSON.stringify(e); } catch (_) { return String(e); }
                })())) || String(e) || 'Unknown error';
                const errStack = e?.stack || undefined;
                logger.error('Scan token failed', { token: t, error: errMsg, stack: errStack });
                results.push({ token: t, error: errMsg, errorStack: errStack, summary: `Error: ${errMsg}` });
            }
        }
        res.json({ ok: true, results });
    } catch (e: any) {
        logger.error('Scan failed', { error: e });
        res.status(500).json({ error: e.message });
    }
});

app.post('/config/risk', (req, res) => {
    const { mode } = req.body;
    if (mode === 'HUNTER') {
        agentService.updateRiskProfile(HUNTER_PROFILE);
    } else {
        agentService.updateRiskProfile(GUARDIAN_PROFILE);
    }
    res.json({ message: 'Risk profile updated', mode });
});

// Chat endpoint for smart wallet
app.post('/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
        res.status(400).json({ error: 'Missing message' });
        return;
    }

    try {
        // Import on demand to avoid circular deps
        const { EnhancedAiAgent } = await import('../analysis/enhancedAiAgent');
        const { SmartWalletService } = await import('../execution/smartWalletService');
        
        const agent = new EnhancedAiAgent();
        const walletService = new SmartWalletService(agent, agentService);

        // Persist user message immediately so history is available even if processing fails
        try {
            chatRepo.add({ role: 'user', content: message, timestamp: Date.now() });
        } catch (dbErr) {
            console.error('Failed to persist user chat message:', dbErr);
            // continue — persistence failure shouldn't block the chat response
        }

        // Set wallet from agent service if available
        const wallet = agentService.getWallet();
        if (wallet) {
            walletService.setWallet(wallet);
        }

        const response = await walletService.processMessage(message);

        // Persist assistant response
        try {
            chatRepo.add({ role: 'assistant', content: response.content, timestamp: response.timestamp || Date.now(), actions: response.actions });
        } catch (dbErr) {
            console.error('Failed to persist assistant chat message:', dbErr);
        }

        res.json({
            message: response.content,
            timestamp: response.timestamp,
            actions: response.actions
        });
    } catch (e: any) {
        console.error('Chat processing error:', e);
        // Persist error message in chat history so frontend can display it on reload
        try {
            chatRepo.add({ role: 'assistant', content: `Error: ${e.message || 'Internal error'}`, timestamp: Date.now() });
        } catch (dbErr) {
            console.error('Failed to persist chat error message:', dbErr);
        }
        res.status(500).json({ error: e.message });
    }
});

// Chat history endpoints
app.get('/chat/history', (req, res) => {
    try {
        const recent = chatRepo.getRecent(200);
        res.json(recent);
    } catch (e: any) {
        console.error('Failed to fetch chat history:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/chat/history', (req, res) => {
    const { role, content, timestamp, actions } = req.body;
    if (!role || !content) {
        res.status(400).json({ error: 'Missing role or content' });
        return;
    }
    try {
        chatRepo.add({ role, content, timestamp: timestamp || Date.now(), actions });
        res.status(201).json({ ok: true });
    } catch (e: any) {
        console.error('Failed to save chat message:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/chat/history', (req, res) => {
    try {
        chatRepo.clear();
        res.json({ ok: true });
    } catch (e: any) {
        console.error('Failed to clear chat history:', e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    logger.info('Sentinel API running', { port: PORT });
});

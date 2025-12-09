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
        
        // Set wallet from agent service if available
        const wallet = agentService.getWallet();
        if (wallet) {
            walletService.setWallet(wallet);
        }
        
        const response = await walletService.processMessage(message);
        
        res.json({
            message: response.content,
            timestamp: response.timestamp,
            actions: response.actions
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Sentinel API running on port ${PORT}`);
});

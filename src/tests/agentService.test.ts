import { AgentService } from '../execution/agentService';
import { McpClient } from '../data/mcpClient';
import { SentimentService } from '../data/sentimentService';
import { HypeFilter } from '../analysis/hypeFilter';
import { RiskEvaluator } from '../analysis/riskEvaluator';
import { UserRiskProfile } from '../models/types';
import { ethers } from 'ethers';

// Mocks
jest.mock('../data/mcpClient');
jest.mock('../data/sentimentService');
jest.mock('../analysis/hypeFilter');
jest.mock('../analysis/riskEvaluator');
jest.mock('../data/tokenDiscoveryService');

const mockAnalyze = jest.fn();
jest.mock('../analysis/godAnalystService', () => ({
    GodAnalystService: jest.fn().mockImplementation(() => ({
        analyze: mockAnalyze
    }))
}));

import { TokenDiscoveryService } from '../data/tokenDiscoveryService';
import { GodAnalystService } from '../analysis/godAnalystService';

describe('AgentService Integration', () => {
    let service: AgentService;
    let mcpClient: jest.Mocked<McpClient>;
    let sentimentService: jest.Mocked<SentimentService>;
    let hypeFilter: jest.Mocked<HypeFilter>;
    let riskEvaluator: jest.Mocked<RiskEvaluator>;
    let tokenDiscovery: jest.Mocked<TokenDiscoveryService>;
    let godAnalyst: jest.Mocked<GodAnalystService>;
    
    // Test Data
    const mockProfile: UserRiskProfile = {
        mode: 'HUNTER',
        allowedTokens: [],
        minConfidenceScore: 70,
        stopLossPercent: -15,
        maxPositionSize: 1000
    };

    beforeEach(() => {
        mcpClient = new McpClient('http://mock') as any;
        sentimentService = new SentimentService() as any;
        hypeFilter = new HypeFilter() as any;
        riskEvaluator = new RiskEvaluator() as any;
        tokenDiscovery = new TokenDiscoveryService() as any;
        godAnalyst = new GodAnalystService() as any;
        
        // Mock the discovery return
        tokenDiscovery.getTokensToScan.mockResolvedValue(['0x1A']);
        tokenDiscovery.getTokenInfo.mockReturnValue({ name: 'Token', symbol: 'TOK', address: '0x1A' });
        
        service = new AgentService(
            mcpClient,
            sentimentService,
            hypeFilter,
            riskEvaluator,
            mockProfile
        );
    });

    test('analyzeAndTrade should proceed to execution if decision is valid', async () => {
        // Setup Mocks
        mcpClient.getMarketData.mockResolvedValue({
            tokenAddress: '0x1A', price: 100, volume24h: 50000, volumeTrend: 'RISING', timestamp: Date.now()
        });
        sentimentService.getSentimentData.mockResolvedValue({
            tokenSymbol: 'TOK', sentiment: 'POSITIVE', mentions: 100, smartMoneyMentions: 5, sources: [], timestamp: Date.now()
        });
        
        // Mock God Analyst
        mockAnalyze.mockResolvedValue({
            action: 'BUY',
            confidence: 85,
            reasoning: 'AI says go',
            technicalScore: 80,
            sentimentScore: 90,
            fundamentalScore: 85,
            riskLevel: 'LOW',
            suggestedPositionSize: 100,
            timestamp: Date.now()
        });
        
        // Mock the dynamic import if possible, or ensure the service uses the mocked instance
        // Since AgentService creates it internally, we rely on jest.mock and dynamic import behavior

        // Spy on console to check execution logging (since contract is mocked/null in unit test)
        const logSpy = jest.spyOn(console, 'log');

        const decision = await service.analyzeAndTrade('0x1A');

        expect(decision?.shouldTrade).toBe(true);
        expect(mcpClient.getMarketData).toHaveBeenCalledWith('0x1A');
        // riskEvaluator is no longer called directly in analyzeAndTrade, 
        // as GodAnalyst replaces it or we use raw result
        
        // Check "Executing Trade" log as proxy for contract interaction in this mock scope
        // (In real logic, we'd mock the contract instance)
        // Since contract is null in default constructor unless started is called with a signer.
        
        // Start service with mock signer to set agentContract
        const mockSigner = { provider: {}, getAddress: () => '0xUser' } as any;
        // Mock ethers.Contract constructor?
        // Harder to mock 'new ethers.Contract' in this scope without complex jest mock.
        // For now, check logic flow up to point of contract call.
    });

    test('analyzeAndTrade should halt if risk evaluation fails', async () => {
        mcpClient.getMarketData.mockResolvedValue({} as any);
        sentimentService.getSentimentData.mockResolvedValue({} as any);
        
        mockAnalyze.mockResolvedValue({
            action: 'HOLD',
            confidence: 40,
            reasoning: 'Too risky',
            technicalScore: 30,
            sentimentScore: 40,
            fundamentalScore: 30,
            riskLevel: 'HIGH',
            suggestedPositionSize: 0,
            timestamp: Date.now()
        });

        const decision = await service.analyzeAndTrade('0x1B');
        
        expect(decision?.shouldTrade).toBe(false);
    });
});

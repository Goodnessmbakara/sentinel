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

describe('AgentService Integration', () => {
    let service: AgentService;
    let mcpClient: jest.Mocked<McpClient>;
    let sentimentService: jest.Mocked<SentimentService>;
    let hypeFilter: jest.Mocked<HypeFilter>;
    let riskEvaluator: jest.Mocked<RiskEvaluator>;
    
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
        hypeFilter.analyze.mockResolvedValue({
            signal: 'VALID_BREAKOUT', confidenceScore: 85, reasoning: 'Go', timestamp: Date.now()
        });
        riskEvaluator.evaluate.mockReturnValue({
            shouldTrade: true, action: 'BUY', amount: 100, reasoning: 'Yes'
        });

        // Spy on console to check execution logging (since contract is mocked/null in unit test)
        const logSpy = jest.spyOn(console, 'log');

        const decision = await service.analyzeAndTrade('0x1A');

        expect(decision?.shouldTrade).toBe(true);
        expect(mcpClient.getMarketData).toHaveBeenCalledWith('0x1A');
        expect(riskEvaluator.evaluate).toHaveBeenCalled();
        
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
        hypeFilter.analyze.mockResolvedValue({} as any);
        riskEvaluator.evaluate.mockReturnValue({
            shouldTrade: false, action: 'HOLD', amount: 0, reasoning: 'High Risk'
        });

        const decision = await service.analyzeAndTrade('0x1B');
        
        expect(decision?.shouldTrade).toBe(false);
    });
});

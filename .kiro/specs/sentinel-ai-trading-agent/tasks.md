# Implementation Plan

- [ ] 1. Set up project structure and development environment
  - Initialize Node.js/TypeScript project with proper configuration
  - Set up Hardhat for smart contract development with Cronos mainnet fork
  - Configure testing frameworks: Jest for unit tests, fast-check for property-based tests
  - Install dependencies: Crypto.com AI Agent SDK, ethers.js, OpenZeppelin contracts
  - Create directory structure: src/data, src/analysis, src/execution, src/contracts, src/tests
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 2. Implement core data models and interfaces
  - Define TypeScript interfaces for MarketData, SentimentData, HypeAnalysis, Position, TradeSignal
  - Create RiskProfile and UserRiskProfile types with Guardian and Hunter modes
  - Implement data validation functions for all models
  - Create database schema for positions, trade_signals, and agent_events tables
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 3. Build Data Ingestion Module
  - [ ] 3.1 Implement MCP server integration for market data
    - Create MCP client with connection management and retry logic
    - Implement getMarketData function to fetch price and volume data
    - Add data validation to ensure timestamps are within 60 seconds
    - Implement caching layer with 10-second TTL for market data
    - _Requirements: 5.1, 5.2, 5.4_
  
  - [ ] 3.2 Write property test for MCP data timestamp validation
    - **Property 18: Market data timestamp validation**
    - **Validates: Requirements 5.4**
  
  - [ ] 3.3 Implement sentiment data collection
    - Create social media API clients (mock for hackathon)
    - Implement getSentimentData function to aggregate sentiment from sources
    - Add smart money wallet mention tracking
    - Implement caching layer with 30-second TTL for sentiment data
    - _Requirements: 1.1_
  
  - [ ] 3.4 Write property test for sentiment data processing
    - **Property 1: Sentiment confidence score bounds**
    - **Validates: Requirements 1.2**

- [ ] 4. Implement Hype Filter with LLM analysis
  - [ ] 4.1 Integrate Crypto.com AI Agent SDK
    - Set up SDK authentication and configuration
    - Create LLM client wrapper with error handling
    - Implement sentiment analysis function using SDK
    - Add circuit breaker pattern for API failures
    - _Requirements: 1.1, 1.2_
  
  - [ ] 4.2 Build Hype Filter decision logic
    - Implement analyze function combining market and sentiment data
    - Create decision matrix for FAKE_PUMP, VALID_BREAKOUT, ACCUMULATION, NOISE classifications
    - Add confidence score calculation (0-100 range)
    - Implement reasoning generation for each classification
    - _Requirements: 1.3, 1.4_
  
  - [ ] 4.3 Write property tests for Hype Filter classifications
    - **Property 2: Noise classification for high sentiment with flat volume**
    - **Validates: Requirements 1.3**
  
  - [ ] 4.4 Write property test for valid signal classification
    - **Property 3: Valid signal classification for high sentiment with rising volume**
    - **Validates: Requirements 1.4**

- [ ] 5. Build Risk Evaluator module
  - [ ] 5.1 Implement risk profile management
    - Create UserRiskProfile class with Guardian and Hunter mode configurations
    - Implement Guardian mode with CRO, USDC, WBTC token whitelist
    - Implement Hunter mode with all-token allowance
    - Set stop loss thresholds: -2% for Guardian, -15% for Hunter
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ] 5.2 Write property tests for risk profile enforcement
    - **Property 4: Guardian mode confidence threshold enforcement**
    - **Validates: Requirements 1.5**
  
  - [ ] 5.3 Write property test for Guardian mode token restriction
    - **Property 5: Guardian mode token restriction**
    - **Validates: Requirements 2.2**
  
  - [ ] 5.4 Write property test for Hunter mode token allowance
    - **Property 6: Hunter mode token allowance**
    - **Validates: Requirements 2.3**
  
  - [ ] 5.5 Implement trade decision logic
    - Create evaluate function that checks signal against risk profile
    - Implement confidence score threshold checking (90 for Guardian)
    - Add token allowlist validation
    - Calculate optimal position sizes based on risk profile
    - _Requirements: 1.5, 2.2, 2.3_

- [ ] 6. Develop Agent Smart Contract
  - [ ] 6.1 Create base Agent contract with OpenZeppelin
    - Implement contract initialization with owner and risk profile
    - Add session key management with expiration
    - Implement ReentrancyGuard for all external calls
    - Add emergency pause functionality
    - _Requirements: 3.3, 6.1_
  
  - [ ] 6.2 Implement VVS Finance integration
    - Add IUniswapV2Router02 interface
    - Implement executeSwap function calling swapExactTokensForTokens
    - Add slippage protection and deadline parameters
    - Implement gas price adjustment logic
    - _Requirements: 3.1, 3.2, 6.2_
  
  - [ ] 6.3 Write property tests for VVS integration
    - **Property 7: VVS Router interface usage**
    - **Validates: Requirements 3.1**
  
  - [ ] 6.4 Write property test for buy order execution
    - **Property 8: Buy order function call correctness**
    - **Validates: Requirements 3.2**
  
  - [ ] 6.5 Implement position management
    - Add position tracking with entry/exit prices
    - Implement stop loss monitoring and automatic sell triggers
    - Create closePosition function with profit calculation
    - _Requirements: 3.4, 4.1_
  
  - [ ] 6.6 Write property test for stop loss trigger
    - **Property 10: Stop loss trigger**
    - **Validates: Requirements 3.4**
  
  - [ ] 6.7 Write property test for profit calculation
    - **Property 11: Profit calculation correctness**
    - **Validates: Requirements 4.1**
  
  - [ ] 6.8 Write unit tests for smart contract
    - Test initialization with different risk profiles
    - Test session key authorization
    - Test emergency pause functionality
    - Test reentrancy protection
    - _Requirements: 3.3, 6.1_

- [ ] 7. Implement x402 fee distribution system
  - [ ] 7.1 Build x402 Fee Handler
    - Implement calculateFee function: 5% of profit if positive, 0% otherwise
    - Create x402 protocol header construction
    - Implement distributeProceedsWithFee function with 95/5 split
    - Add fee transaction event emission
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ] 7.2 Write property tests for fee calculation
    - **Property 12: Fee calculation for profitable trades**
    - **Validates: Requirements 4.2**
  
  - [ ] 7.3 Write property test for profitable trade distribution
    - **Property 13: Profitable trade distribution**
    - **Validates: Requirements 4.3**
  
  - [ ] 7.4 Write property test for non-profitable trades
    - **Property 14: No fee for non-profitable trades**
    - **Validates: Requirements 4.4**
  
  - [ ] 7.5 Write property test for fee event emission
    - **Property 15: Fee transaction event emission**
    - **Validates: Requirements 4.5**
  
  - [ ] 7.6 Integrate x402 into Agent contract
    - Add fee distribution logic to closePosition function
    - Implement 95% user / 5% agent split for profitable trades
    - Ensure 100% user allocation for losses
    - Emit FeeDistributed event with profit and fee amounts
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [ ] 8. Build Agent Service orchestration layer
  - [ ] 8.1 Create main Agent Service class
    - Implement continuous trading loop: ingest → analyze → evaluate → execute
    - Add state management for active positions
    - Implement error handling with circuit breakers
    - Add graceful shutdown handling
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 8.2 Integrate all modules
    - Wire Data Ingestion Module to Hype Filter
    - Connect Hype Filter to Risk Evaluator
    - Link Risk Evaluator to Agent Smart Contract
    - Add logging and monitoring throughout pipeline
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [ ] 8.3 Implement session key management
    - Create session key generation and storage
    - Add key expiration monitoring
    - Implement automatic key rotation
    - Add owner key backup and recovery
    - _Requirements: 3.3_
  
  - [ ] 8.4 Write property test for session key signing
    - **Property 9: Session key signing**
    - **Validates: Requirements 3.3**

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement data persistence layer
  - [ ] 10.1 Set up PostgreSQL database
    - Create positions, trade_signals, and agent_events tables
    - Add indexes for timestamp and status queries
    - Implement connection pooling
    - _Requirements: 8.1, 8.2_
  
  - [ ] 10.2 Build repository pattern for data access
    - Create PositionRepository with CRUD operations
    - Create TradeSignalRepository for signal logging
    - Create AgentEventRepository for event logging
    - Implement transaction support for atomic operations
    - _Requirements: 8.1, 8.2, 8.4_
  
  - [ ] 10.3 Write property tests for data persistence
    - **Property 21: Trade recording completeness**
    - **Validates: Requirements 8.1**
  
  - [ ] 10.4 Write property test for trading history retrieval
    - **Property 22: Trading history completeness**
    - **Validates: Requirements 8.2**
  
  - [ ] 10.5 Write property test for performance metrics
    - **Property 23: Performance metrics calculation**
    - **Validates: Requirements 8.3**
  
  - [ ] 10.6 Write property test for noise detection logging
    - **Property 24: Noise detection logging**
    - **Validates: Requirements 8.4**

- [ ] 11. Build API server for dashboard
  - [ ] 11.1 Create Express.js API server
    - Set up Express with TypeScript
    - Add CORS and security middleware
    - Implement authentication for user endpoints
    - Add rate limiting
    - _Requirements: 8.2, 8.3, 8.5_
  
  - [ ] 11.2 Implement API endpoints
    - POST /api/agent/configure - Set risk profile
    - GET /api/agent/status - Get current agent state
    - GET /api/positions - Get open positions
    - GET /api/history - Get trading history
    - GET /api/metrics - Get performance metrics
    - POST /api/agent/pause - Emergency pause
    - _Requirements: 8.2, 8.3, 8.5_
  
  - [ ] 11.3 Add WebSocket support for real-time updates
    - Implement WebSocket server for live position updates
    - Push trade execution notifications
    - Stream market data updates
    - _Requirements: 8.5_

- [ ] 12. Create dashboard UI
  - [ ] 12.1 Set up React application
    - Initialize React with TypeScript
    - Set up routing with React Router
    - Add state management (Context API or Redux)
    - Configure API client with axios
    - _Requirements: 8.5_
  
  - [ ] 12.2 Build configuration interface
    - Create risk profile selector (Guardian/Hunter)
    - Add token allowlist configuration for Guardian mode
    - Implement stop loss threshold display
    - Add session key management UI
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ] 12.3 Build trading dashboard
    - Display active positions with entry prices and current P&L
    - Show recent trade signals with confidence scores
    - Display performance metrics: total P&L, win rate, fees paid
    - Add real-time market data display
    - Implement trade history table with filtering
    - _Requirements: 8.2, 8.3, 8.5_
  
  - [ ] 12.4 Add monitoring and alerts
    - Display agent status (active/paused)
    - Show recent errors and warnings
    - Add noise detection log viewer
    - Implement emergency pause button
    - _Requirements: 8.4, 8.5_

- [ ] 13. Implement error handling and resilience
  - [ ] 13.1 Add retry logic with exponential backoff
    - Implement retryWithBackoff utility function
    - Apply to MCP server calls (max 3 attempts)
    - Apply to LLM API calls (max 3 attempts)
    - Apply to RPC calls (max 3 attempts)
    - _Requirements: 5.3, 6.4_
  
  - [ ] 13.2 Implement circuit breakers
    - Create CircuitBreaker class with OPEN/CLOSED/HALF_OPEN states
    - Apply to MCP server (opens after 5 failures)
    - Apply to LLM API (opens after 5 failures)
    - Add 60-second cooldown before retry
    - _Requirements: 5.3_
  
  - [ ] 13.3 Add comprehensive error logging
    - Create ErrorLog interface with severity levels
    - Implement error logging for all modules
    - Add context information (component, operation, token address)
    - Store errors in agent_events table
    - _Requirements: 7.5_
  
  - [ ] 13.4 Implement graceful degradation
    - Halt trading when MCP server is unavailable
    - Skip trades on LLM API failures
    - Use backup RPC endpoints on primary failure
    - Notify user of degraded operation
    - _Requirements: 5.3_

- [ ] 14. Deploy and test on Cronos testnet
  - [ ] 14.1 Deploy smart contracts to testnet
    - Deploy Agent contract to Cronos testnet
    - Verify contract on block explorer
    - Test with testnet CRO and tokens
    - _Requirements: 6.1, 6.5_
  
  - [ ] 14.2 Configure testnet environment
    - Set up testnet RPC endpoints
    - Configure testnet VVS Finance addresses
    - Use test MCP endpoints
    - Create test social media data feeds
    - _Requirements: 6.5_
  
  - [ ] 14.3 Run end-to-end integration tests
    - Test complete trading loop on testnet
    - Verify Guardian mode restrictions
    - Verify Hunter mode behavior
    - Test stop loss triggers
    - Test x402 fee distribution
    - Verify dashboard displays correct data
    - _Requirements: All_

- [ ] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Prepare for mainnet deployment
  - [ ] 16.1 Security audit preparation
    - Review all smart contract code
    - Check for reentrancy vulnerabilities
    - Verify access control on all functions
    - Test emergency pause functionality
    - _Requirements: 3.3, 6.1_
  
  - [ ] 16.2 Create deployment scripts
    - Write Hardhat deployment script for mainnet
    - Add contract verification script
    - Create configuration management for mainnet addresses
    - Document deployment process
    - _Requirements: 6.1, 6.2_
  
  - [ ] 16.3 Set up monitoring and alerting
    - Configure error rate alerts (> 5% in 5 minutes)
    - Add MCP server downtime alerts (> 1 minute)
    - Set up unusual volume alerts (> 10x normal)
    - Add session key expiration alerts (< 24 hours)
    - Monitor smart contract balance
    - _Requirements: 8.5_
  
  - [ ] 16.4 Create user documentation
    - Write user guide for risk profile configuration
    - Document Guardian vs Hunter mode differences
    - Explain x402 fee structure
    - Create troubleshooting guide
    - _Requirements: 2.1, 4.2_

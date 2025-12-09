# Requirements Document

## Introduction

Sentinel AI is an autonomous trading agent designed for the Cronos EVM network that addresses the critical challenge of distinguishing genuine market signals from noise in cryptocurrency trading. The system combines Large Language Model (LLM) analysis of market sentiment with real-time on-chain data to make informed trading decisions on VVS Finance. The agent operates on a performance-based fee model using the x402 standard, charging fees only when generating profits or preventing losses, thereby aligning its incentives with user success.

## Glossary

- **Sentinel AI**: The autonomous trading agent system that analyzes market sentiment and executes trades
- **Hype Filter**: The core algorithm that uses LLM analysis to distinguish genuine market signals from noise
- **VVS Finance**: A Uniswap V2 fork decentralized exchange on Cronos network where trades are executed
- **Cronos EVM**: The Ethereum Virtual Machine compatible blockchain network where the agent operates
- **x402 Protocol**: A payment standard that enables performance-based fee collection
- **MCP**: Model Context Protocol server providing real-time market data
- **Risk Profile**: User-defined configuration that determines trading strategy and risk tolerance
- **Guardian Mode**: Low-risk trading profile with strict hype filtering and tight stop losses
- **Hunter Mode**: High-risk trading profile with loose hype filtering and wide stop losses
- **Session Keys**: Cryptographic keys that enable the agent to execute trades without requiring user signatures for each transaction
- **Smart Money Wallet**: Cryptocurrency wallets associated with experienced or institutional traders
- **Sentiment Score**: A numerical representation of market sentiment derived from social media and news sources

## Requirements

### Requirement 1

**User Story:** As a retail crypto trader, I want the agent to analyze market sentiment using LLMs, so that I can distinguish genuine trading opportunities from fake hype.

#### Acceptance Criteria

1. WHEN social media data and news feeds are ingested, THE Sentinel AI SHALL process the text content using the Crypto.com AI Agent SDK
2. WHEN sentiment analysis is performed, THE Sentinel AI SHALL generate a confidence score between 0 and 100 representing the likelihood that the sentiment is genuine
3. WHEN high sentiment scores coincide with flat trading volume, THE Sentinel AI SHALL classify the signal as noise and prevent trade execution
4. WHEN high sentiment scores coincide with rising trading volume, THE Sentinel AI SHALL classify the signal as valid and proceed with trade evaluation
5. WHERE the user has configured Guardian Mode, THE Sentinel AI SHALL require a minimum confidence score of 90 before executing any trade

### Requirement 2

**User Story:** As a user, I want to configure my risk tolerance through a simple interface, so that the agent trades according to my comfort level.

#### Acceptance Criteria

1. WHEN a user initializes the agent, THE Sentinel AI SHALL accept a risk profile configuration of either Guardian Mode or Hunter Mode
2. WHERE Guardian Mode is selected, THE Sentinel AI SHALL restrict trading to established tokens including CRO, USDC, and WBTC
3. WHERE Hunter Mode is selected, THE Sentinel AI SHALL enable trading of meme coins and newly listed tokens on VVS Finance
4. WHERE Guardian Mode is active, THE Sentinel AI SHALL apply a stop loss threshold of negative 2 percent
5. WHERE Hunter Mode is active, THE Sentinel AI SHALL apply a stop loss threshold of negative 15 percent

### Requirement 3

**User Story:** As a trader, I want the agent to execute trades autonomously on VVS Finance, so that I can capture opportunities without manual intervention.

#### Acceptance Criteria

1. WHEN a valid trading signal is identified, THE Sentinel AI SHALL construct a transaction using the VVS Finance IUniswapV2Router02 interface
2. WHEN executing a buy order, THE Sentinel AI SHALL call the swapExactTokensForTokens function with the calculated optimal entry amount
3. WHEN a trade is executed, THE Sentinel AI SHALL use session keys to sign transactions without requiring user approval for each trade
4. WHEN a position reaches the configured stop loss threshold, THE Sentinel AI SHALL automatically execute a sell order to limit losses
5. WHEN network conditions change, THE Sentinel AI SHALL adjust gas price parameters to ensure transaction execution within acceptable time frames

### Requirement 4

**User Story:** As a user, I want to pay fees only when the agent generates profit, so that my interests are aligned with the agent's performance.

#### Acceptance Criteria

1. WHEN a trading position is closed, THE Sentinel AI SHALL calculate the profit as the difference between exit price and entry price
2. IF the calculated profit is greater than zero, THEN THE Sentinel AI SHALL construct an x402 protocol header requesting 5 percent of the profit
3. WHEN distributing proceeds from a profitable trade, THE Sentinel AI SHALL allocate 95 percent to the user wallet and 5 percent to the agent wallet
4. IF the calculated profit is zero or negative, THEN THE Sentinel AI SHALL transfer 100 percent of proceeds to the user wallet without charging any fee
5. WHEN an x402 fee transaction is executed, THE Sentinel AI SHALL emit an event containing the profit amount and fee amount for transparency

### Requirement 5

**User Story:** As a trader, I want the agent to access real-time market data, so that trading decisions are based on current conditions.

#### Acceptance Criteria

1. WHEN evaluating a trading opportunity, THE Sentinel AI SHALL query the MCP server for current price data of the target token
2. WHEN analyzing market conditions, THE Sentinel AI SHALL retrieve trading volume trends from the MCP server for the relevant time period
3. WHEN the MCP server is unavailable, THE Sentinel AI SHALL halt trading operations and log an error condition
4. WHEN market data is received, THE Sentinel AI SHALL validate that the data timestamp is within 60 seconds of the current time
5. WHEN multiple data sources provide conflicting information, THE Sentinel AI SHALL use the most recent data from the primary MCP server

### Requirement 6

**User Story:** As a user, I want the agent to operate on the Cronos network, so that I can benefit from low transaction costs and VVS Finance liquidity.

#### Acceptance Criteria

1. WHEN the agent is initialized, THE Sentinel AI SHALL connect to the Cronos EVM network using the configured RPC endpoint
2. WHEN executing trades, THE Sentinel AI SHALL interact with VVS Finance smart contracts deployed on Cronos mainnet
3. WHEN submitting transactions, THE Sentinel AI SHALL use CRO as the native token for gas fee payment
4. WHEN a transaction fails due to insufficient gas, THE Sentinel AI SHALL retry with increased gas limit up to a maximum of 3 attempts
5. WHEN operating on a forked network for testing, THE Sentinel AI SHALL use the Hardhat local fork configuration

### Requirement 7

**User Story:** As a developer, I want the agent to maintain a clear separation between data ingestion, analysis, and execution, so that the system is maintainable and testable.

#### Acceptance Criteria

1. WHEN the agent processes market data, THE Sentinel AI SHALL use dedicated data ingestion modules that are independent of the analysis logic
2. WHEN sentiment analysis is performed, THE Sentinel AI SHALL use the Hype Filter module without direct coupling to execution components
3. WHEN trades are executed, THE Sentinel AI SHALL use execution modules that receive validated signals from the analysis layer
4. WHEN any module is updated, THE Sentinel AI SHALL ensure that other modules continue to function without modification through stable interfaces
5. WHEN errors occur in one module, THE Sentinel AI SHALL isolate the failure and prevent cascading errors to other modules

### Requirement 8

**User Story:** As a user, I want to view my trading history and agent performance, so that I can evaluate the effectiveness of the agent.

#### Acceptance Criteria

1. WHEN a trade is executed, THE Sentinel AI SHALL record the transaction hash, entry price, exit price, and profit or loss amount
2. WHEN a user requests trading history, THE Sentinel AI SHALL retrieve and display all completed trades with timestamps
3. WHEN displaying performance metrics, THE Sentinel AI SHALL calculate and show total profit or loss, win rate, and total fees paid
4. WHEN the agent prevents a trade due to noise detection, THE Sentinel AI SHALL log the decision with the confidence score and reasoning
5. WHEN a user accesses the dashboard, THE Sentinel AI SHALL display real-time status including active positions and current market conditions

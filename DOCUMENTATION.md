# Sentinel AI - Documentation

**Autonomous Trading Agent with Smart Wallet Capabilities**

Platform: Cronos EVM | AI: Google Gemini 2.5 Flash | Status: Live ✅

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Setup & Installation](#setup--installation)
5. [Usage Guide](#usage-guide)
6. [API Reference](#api-reference)
7. [Smart Contract](#smart-contract)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## Overview

Sentinel AI is a sophisticated autonomous trading agent that combines:
- **AI-Powered Analysis**: Gemini 2.5 Flash for market sentiment and signal classification
- **Smart Wallet**: Natural language blockchain operations
- **Risk Management**: Guardian and Hunter trading profiles
- **x402 Protocol**: Transparent fee distribution
- **VVS Finance**: DEX integration on Cronos

### Key Capabilities

- ✅ Conversational trading via chat interface
- ✅ Autonomous hype detection and filtering
- ✅ Multi-tier risk profiles
- ✅ Real-time market analysis
- ✅ Session key management
- ✅ Analysis-only mode (no contract required)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Dashboard (React)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ Agent Status │  │ Chat Widget  │  │  Activity │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
└─────────────────────────┬───────────────────────────┘
                          │ HTTP
┌─────────────────────────▼───────────────────────────┐
│              Express API Server                     │
│  /start  /stop  /chat  /config  /status             │
└────┬────────────────────┬────────────────────┬──────┘
     │                    │                    │
┌────▼─────┐    ┌────────▼─────────┐    ┌─────▼──────┐
│  Agent   │    │  Smart Wallet    │    │   Risk     │
│ Service  │◄───┤    Service       │    │ Evaluator  │
└────┬─────┘    └──────────────────┘    └────────────┘
     │
┌────▼──────────────────────────────────────────────┐
│  Hype Filter   │  MCP Client  │  Sentiment Data  │
└───────────────────────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │  Google Gemini API    │
              └───────────────────────┘
```

### Core Modules

| Module | Purpose | Technology |
|--------|---------|------------|
| `enhancedAiAgent.ts` | Smart Wallet AI | Google Generative AI SDK |
| `aiAgentClient.ts` | Hype Filter AI | Google Generative AI SDK |
| `agentService.ts` | Trading Orchestration | TypeScript |
| `smartWalletService.ts` | NL Command Processing | TypeScript |
| `hypeFilter.ts` | Signal Classification | Property-based testing |
| `riskEvaluator.ts` | Risk Management | Guardian/Hunter profiles |
| `Agent.sol` | On-chain Execution | Solidity + OpenZeppelin |

---

## Features

### 1. Smart Wallet Chat Interface

Natural language blockchain operations:

```
User: "What's my balance?"
Bot: 💰 Your Wallet Balance
     Address: 0x40a2...4461
     CRO: 0.0000 CRO
     Value: ~$0.00 USD

User: "Analyze WCRO market"
Bot: 📈 Market Analysis: WCRO
     Sentiment Score: 75/100
     Recommendation: BUY
     Confidence: 80%
```

**Supported Commands**:
- Balance queries: `"How much CRO do I have?"`
- Market analysis: `"Should I buy WCRO?"`
- Trade execution: `"Buy 10 CRO worth of USDC"`
- General questions: `"What is my wallet address?"`

### 2. Hype Filter

Classifies trading signals using AI:

- **VALID_BREAKOUT**: Legitimate price movement with strong fundamentals
- **FAKE_PUMP**: Artificial hype without substance
- **ACCUMULATION**: Gradual buildup, potential opportunity
- **NOISE**: Random fluctuations, ignore

### 3. Risk Profiles

**Guardian Mode** (Conservative):
- Stop-loss: -2%
- Confidence threshold: 90%
- Token allowlist: Verified tokens only

**Hunter Mode** (Aggressive):
- Stop-loss: -15%
- Confidence threshold: 50%
- Token allowlist: Expanded

### 4. x402 Protocol

Transparent fee structure:
- 5% profit fee on successful trades
- Distributed via x402 protocol headers
- Verifiable on-chain

---

## Setup & Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Cronos testnet wallet with CRO
- Google AI API key (Gemini)

### Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/Goodnessmbakara/sentinel.git
cd sentinel

# 2. Install dependencies
npm install
cd src/dashboard && npm install && cd ../..

# 3. Configure environment
cp .env.example .env
# Edit .env with your keys
```

### Environment Variables

```bash
# Required
LLM_API_KEY=your_gemini_api_key_here
PRIVATE_KEY=your_wallet_private_key
RPC_URL=https://evm-t3.cronos.org

# Optional
MCP_ENDPOINT=http://localhost:8080
PORT=3001
CONTRACT_ADDRESS=  # Set after deployment
```

### Get API Keys

1. **Gemini API Key**: https://aistudio.google.com/app/apikey
2. **Cronos Testnet**: https://cronos.org/faucet
3. **Explorer API**: https://cronos.org/explorer/testnet3

---

## Usage Guide

### Running the System

```bash
# Terminal 1: API Server
npm run start:api

# Terminal 2: Dashboard
cd src/dashboard && npm run dev

# Open browser
http://localhost:5173
```

### Using the Dashboard

1. **Initialize Agent**
   - Click "Initialize Agent" button
   - Wait for confirmation in Activity Log
   
2. **Chat with Smart Wallet**
   - Type natural language commands
   - View balance, analyze markets, execute trades
   
3. **Switch Risk Profile**
   - Toggle between Guardian/Hunter modes
   - Changes take effect immediately

### Analysis-Only Mode

The agent runs without a deployed contract:
- Market analysis ✅
- Balance queries ✅
- Signal classification ✅
- Trade execution ❌ (requires deployed contract)

To enable trading:
1. Deploy `Agent.sol` to testnet
2. Set `CONTRACT_ADDRESS` in `.env`
3. Restart API server

---

## API Reference

### Endpoints

#### `GET /status`
Health check endpoint.

**Response**:
```json
{
  "status": "OK",
  "timestamp": 1702995847123
}
```

#### `POST /start`
Initialize trading agent.

**Request Body** (optional):
```json
{
  "privateKey": "0x...",
  "contractAddress": "0x..."
}
```

**Response**:
```json
{
  "message": "Agent started",
  "wallet": "0x40a2Aa83271dd2F86e7C50C05b60bf3873bA4461",
  "network": "https://evm-t3.cronos.org",
  "contract": "none (analysis-only mode)"
}
```

#### `POST /stop`
Stop trading agent.

#### `POST /chat`
Smart wallet chat interface.

**Request**:
```json
{
  "message": "What's my balance?"
}
```

**Response**:
```json
{
  "message": "💰 Your Wallet Balance...",
  "timestamp": 1702995847123,
  "actions": [
    { "type": "balance_query", "details": {...} }
  ]
}
```

#### `POST /config/risk`
Update risk profile.

**Request**:
```json
{
  "mode": "HUNTER"
}
```

---

## Smart Contract

### Agent.sol

Autonomous trading contract with:
- Position management
- VVS Finance Router integration
- Session key delegation
- x402 fee distribution
- Emergency stop mechanism

### Deployment

```bash
# Compile contracts
npx hardhat compile

# Deploy to testnet
npx hardhat run scripts/deploy.ts --network cronosTestnet

# Verify on explorer
npx hardhat verify --network cronosTestnet DEPLOYED_ADDRESS
```

---

## Testing

### Unit Tests

```bash
npm test
```

### Property-Based Tests

```bash
npm run test:prop
```

### Smart Contract Tests

```bash
npx hardhat test
```

### Coverage

```bash
npx hardhat coverage
```

---

## Deployment

### Testnet Deployment

1. **Fund Wallet**: Get CRO from faucet
2. **Deploy Contract**: `npx hardhat run scripts/deploy.ts --network cronosTestnet`
3. **Update .env**: Set `CONTRACT_ADDRESS`
4. **Test Trading**: Execute small test trades

### Mainnet Preparation

- [ ] Security audit
- [ ] Gas optimization
- [ ] Multi-sig setup
- [ ] Insurance fund
- [ ] Monitoring infrastructure

---

## Troubleshooting

### Common Issues

**Q: Chat returns "Wallet not connected"**
A: Click "Initialize Agent" first

**Q: Gemini API errors (401/404)**
A: Verify `LLM_API_KEY` is valid Gemini key from AI Studio

**Q: Agent won't start**
A: Check `PRIVATE_KEY` in `.env` is set correctly

**Q: Trading disabled**
A: Set `CONTRACT_ADDRESS` after deploying smart contract

### Debug Mode

Enable detailed logging:
```bash
DEBUG=sentinel:* npm run start:api
```

### Support

- GitHub Issues: https://github.com/Goodnessmbakara/sentinel/issues
- Documentation: This file
- Walkthrough: See `walkthrough.md` in artifacts

---

## Project Status

### ✅ Completed
- Core trading logic (Hype Filter, Risk Evaluator, Agent Service)
- Smart Wallet integration with Gemini 2.5 Flash
- React dashboard with glassmorphism UI
- Chat interface with natural language processing
- Smart contract with VVS integration
- Property-based testing suite

### ❌ Not Yet Implemented
- PostgreSQL data persistence
- Advanced trading strategies (grid, DCA)
- Multi-chain support
- Mobile application

### 🚀 Next Steps
1. Deploy smart contract to testnet
2. Implement data persistence layer
3. Add stop-loss automation
4. Create demo video
5. Security audit preparation

---

## License

MIT License - See LICENSE file for details

## Contributors

- **Goodness Mbakara** - Initial work

---

**Built with ❤️ for the Cronos ecosystem**

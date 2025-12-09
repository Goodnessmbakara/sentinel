// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IUniswapV2Router02.sol";

// Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 6.1, 6.2

contract Agent is Ownable, ReentrancyGuard {
    
    // Config
    IUniswapV2Router02 public immutable router;
    address public agentWallet; // Wallet to receive 5% fee
    
    // Risk Profile Structs
    enum RiskMode { GUARDIAN, HUNTER }
    
    struct UserRiskProfile {
        RiskMode mode;
        uint256 minConfidenceScore;
        int256 stopLossPercent; // e.g., -2 for -2%
        uint256 maxPositionSize;
    }
    
    UserRiskProfile public riskProfile;
    mapping(address => bool) public allowedTokens; // For Guardian mode
    
    // Position Structs
    struct Position {
        uint256 id;
        address tokenAddress;
        uint256 entryPrice; // In Base Token (e.g. USDC or CRO)
        uint256 entryAmount;
        uint256 entryTimestamp;
        bool isOpen;
    }
    
    mapping(uint256 => Position) public positions;
    uint256 public nextPositionId;
    
    // Session Keys
    mapping(address => uint256) public sessionKeys; // Address -> Expiry Timestamp
    
    // Events
    event TradeExecuted(uint256 indexed positionId, string action, address token, uint256 amount, uint256 price);
    event PositionClosed(uint256 indexed positionId, uint256 profit, uint256 fee);
    event FeeDistributed(uint256 profit, uint256 feeAmount);

    constructor(address _router, address _agentWallet) Ownable(msg.sender) {
        router = IUniswapV2Router02(_router);
        agentWallet = _agentWallet;
    }
    
    // -- Configuration --
    
    function setRiskProfile(
        RiskMode _mode, 
        uint256 _minScore, 
        int256 _stopLoss, 
        uint256 _maxSize,
        address[] calldata _allowedTokens
    ) external onlyOwner {
        riskProfile = UserRiskProfile({
            mode: _mode,
            minConfidenceScore: _minScore,
            stopLossPercent: _stopLoss,
            maxPositionSize: _maxSize
        });
        
        // Reset allowed tokens (simplified for MVP, iterating to clear is costly in production)
        // For MVP we assume re-deployment or additive changes, OR we just ignore old allowed if mode switches.
        // Proper way: keep a list or version of allowlist.
        for(uint i=0; i<_allowedTokens.length; i++) {
            allowedTokens[_allowedTokens[i]] = true;
        }
    }
    
    function registerSessionKey(address _sessionKey, uint256 _duration) external onlyOwner {
        sessionKeys[_sessionKey] = block.timestamp + _duration;
    }
    
    modifier onlySessionKey() {
        require(
            msg.sender == owner() || sessionKeys[msg.sender] > block.timestamp, 
            "Unauthorized or expired session key"
        );
        _;
    }
    
    // -- Trading Execution --

    /**
     * @dev Execute a swap (Buy)
     * Requirement 3.2: call swapExactTokensForTokens
     */
    function openPosition(
        address tokenIn, 
        address tokenOut, 
        uint256 amountIn, 
        uint256 minAmountOut
    ) external onlySessionKey nonReentrant {
        // Transfer tokens from user (contract owner) to this contract? 
        // OR assume contract holds funds? 
        // "Agent.sol (Smart Contract wallet)" implies contract holds funds.
        
        require(amountIn <= riskProfile.maxPositionSize, "Exceeds max position size");
        
        // Guardian checks on chain (safety net)
        if (riskProfile.mode == RiskMode.GUARDIAN) {
            require(allowedTokens[tokenOut], "Token not allowed in Guardian mode");
        }
        
        IERC20(tokenIn).approve(address(router), amountIn);
        
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint[] memory amounts = router.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            block.timestamp + 300
        );
        
        // Record Position
        positions[nextPositionId] = Position({
            id: nextPositionId,
            tokenAddress: tokenOut,
            entryPrice: 0, // Need oracle or calculate from swap ratio? simplified: amountIn/amountOut
            entryAmount: amounts[1],
            entryTimestamp: block.timestamp,
            isOpen: true
        });
        
        emit TradeExecuted(nextPositionId, "BUY", tokenOut, amounts[1], 0);
        nextPositionId++;
    }
    
    /**
     * @dev Close position and handle fees (Requirement 4.1 - 4.4)
     */
    function closePosition(uint256 positionId, uint256 minAmountOut) external onlySessionKey nonReentrant {
        Position storage pos = positions[positionId];
        require(pos.isOpen, "Position not open");
        
        address tokenOut = pos.tokenAddress;
        // Assuming we swap back to stable or native. Let's assume wrapped native / stable is configured.
        // For simplicity, let's assume we are trading Token -> USDC or Token -> CRO.
        // We need the 'tokenIn' (base currency) address saved in Position or passed in.
        // Let's assume we use WETH (CRO) as base for simplicity of V2 interface.
        address tokenBase = router.WETH(); 

        IERC20(tokenOut).approve(address(router), pos.entryAmount);
        
        address[] memory path = new address[](2);
        path[0] = tokenOut;
        path[1] = tokenBase;
        
        uint[] memory amounts = router.swapExactTokensForTokens(
            pos.entryAmount,
            minAmountOut,
            path,
            address(this),
            block.timestamp + 300
        );
        
        uint256 exitAmount = amounts[1];
        
        // Calculate Profit (Approximation for MVP: ExitAmount - EntryCost)
        // We need EntryCost. In openPosition we just stored amounts. 
        // We should store cost basis. 
        // Let's assume we track PnL in the base token amount.
        
        // TODO: Store cost basis in openPosition for accurate PnL
        uint256 costBasis = 0; // Simplified
        
        // x402 Fee Logic
        // Profit = exitAmount - costBasis
        // If profit > 0, fee = 5% of profit
        
        uint256 fee = 0;
        uint256 userAmount = exitAmount;
        
        // Assuming we made profit (logic placeholder)
        // if (exitAmount > costBasis) {
        //     uint256 profit = exitAmount - costBasis;
        //     fee = (profit * 5) / 100;
        //     userAmount = exitAmount - fee;
        // }
        // For Hackathon Demo: consistently apply fee if "winning"
        
        if (fee > 0) {
             IERC20(tokenBase).transfer(agentWallet, fee);
             emit FeeDistributed(exitAmount, fee); // Simplified event
        }
        
        pos.isOpen = false;
        emit PositionClosed(positionId, exitAmount, fee);
    }

    receive() external payable {}
}

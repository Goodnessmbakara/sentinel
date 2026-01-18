// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/AggregatorV3Interface.sol";

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
    
    // Chainlink Price Feeds
    mapping(address => address) public priceFeeds; // token => Chainlink price feed address
    
    // Position Structs
    struct Position {
        uint256 id;
        address tokenIn;        // Base token used to enter (e.g. WCRO, USDC)
        address tokenOut;       // Token purchased
        uint256 costBasis;      // Amount of tokenIn spent to enter position
        uint256 tokenAmount;    // Amount of tokenOut received
        uint256 entryTimestamp;
        bool isOpen;
    }
    
    mapping(uint256 => Position) public positions;
    uint256 public nextPositionId;
    
    // Session Keys
    mapping(address => uint256) public sessionKeys; // Address -> Expiry Timestamp
    
    // Events
    event PositionOpened(uint256 indexed positionId, address indexed tokenIn, address indexed tokenOut, uint256 costBasis, uint256 tokenAmount);
    event PositionClosed(uint256 indexed positionId, uint256 costBasis, uint256 exitAmount, int256 profit, uint256 fee);
    event FeeDistributed(address indexed agentWallet, uint256 feeAmount, uint256 profit);
    event RiskProfileUpdated(RiskMode mode, uint256 minConfidenceScore, int256 stopLossPercent, uint256 maxPositionSize);
    event SessionKeyRegistered(address indexed sessionKey, uint256 expiryTimestamp);
    event PriceFeedSet(address indexed token, address indexed priceFeed);
    event StopLossTriggered(uint256 indexed positionId, int256 priceChange, int256 stopLossPercent);

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
        
        // Add allowed tokens (additive approach to avoid gas issues with clearing)
        for(uint i=0; i<_allowedTokens.length; i++) {
            allowedTokens[_allowedTokens[i]] = true;
        }
        
        emit RiskProfileUpdated(_mode, _minScore, _stopLoss, _maxSize);
    }
    
    /**
     * @dev Set Chainlink price feed for a token
     * @param _token Token address
     * @param _priceFeed Chainlink price feed address
     */
    function setPriceFeed(address _token, address _priceFeed) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        require(_priceFeed != address(0), "Invalid price feed address");
        priceFeeds[_token] = _priceFeed;
        emit PriceFeedSet(_token, _priceFeed);
    }
    
    function registerSessionKey(address _sessionKey, uint256 _duration) external onlyOwner {
        uint256 expiryTime = block.timestamp + _duration;
        sessionKeys[_sessionKey] = expiryTime;
        emit SessionKeyRegistered(_sessionKey, expiryTime);
    }
    
    modifier onlySessionKey() {
        require(
            msg.sender == owner() || sessionKeys[msg.sender] > block.timestamp, 
            "Unauthorized or expired session key"
        );
        _;
    }
    
    // -- Price Oracle Functions --
    
    /**
     * @dev Get current price from Chainlink oracle
     * @param _token Token address
     * @return price Current price (scaled by 1e8)
     */
    function getCurrentPrice(address _token) public view returns (int256 price) {
        address priceFeed = priceFeeds[_token];
        require(priceFeed != address(0), "Price feed not set for token");
        
        AggregatorV3Interface feed = AggregatorV3Interface(priceFeed);
        (
            /* uint80 roundID */,
            int256 answer,
            /* uint256 startedAt */,
            uint256 updatedAt,
            /* uint80 answeredInRound */
        ) = feed.latestRoundData();
        
        require(answer > 0, "Invalid price from oracle");
        require(updatedAt > 0, "Price data is stale");
        require(block.timestamp - updatedAt < 3600, "Price data too old (>1 hour)");
        
        return answer;
    }
    
    /**
     * @dev Check if position has hit stop-loss
     * @param positionId Position ID to check
     * @return shouldLiquidate True if position should be liquidated
     * @return currentPriceChange Percentage change from entry (scaled by 100)
     */
    function checkStopLoss(uint256 positionId) public view returns (bool shouldLiquidate, int256 currentPriceChange) {
        Position storage pos = positions[positionId];
        require(pos.isOpen, "Position not open");
        
        // Get current prices for both tokens
        int256 currentPriceIn = getCurrentPrice(pos.tokenIn);
        int256 currentPriceOut = getCurrentPrice(pos.tokenOut);
        
        // Calculate entry ratio (how much tokenOut per tokenIn at entry)
        // entryRatio = tokenAmount / costBasis
        uint256 entryRatio = (pos.tokenAmount * 1e18) / pos.costBasis;
        
        // Calculate current ratio using oracle prices
        // currentRatio = (currentPriceOut / currentPriceIn)
        uint256 currentRatio = (uint256(currentPriceOut) * 1e18) / uint256(currentPriceIn);
        
        // Calculate percentage change: ((current - entry) / entry) * 100
        int256 ratioChange = int256(currentRatio) - int256(entryRatio);
        currentPriceChange = (ratioChange * 100) / int256(entryRatio);
        
        // Check if price change exceeds stop-loss threshold
        shouldLiquidate = currentPriceChange <= riskProfile.stopLossPercent;
        
        return (shouldLiquidate, currentPriceChange);
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
    ) external onlySessionKey nonReentrant returns (uint256 positionId) {
        require(amountIn > 0, "Amount must be greater than 0");
        require(amountIn <= riskProfile.maxPositionSize, "Exceeds max position size");
        require(tokenIn != tokenOut, "Cannot swap same token");
        
        // Guardian mode: only allow whitelisted tokens
        if (riskProfile.mode == RiskMode.GUARDIAN) {
            require(allowedTokens[tokenOut], "Token not allowed in Guardian mode");
        }
        
        // Check contract has sufficient balance
        require(IERC20(tokenIn).balanceOf(address(this)) >= amountIn, "Insufficient balance");
        
        // Approve router to spend tokens
        IERC20(tokenIn).approve(address(router), amountIn);
        
        // Execute swap
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
        
        // Store position with proper cost basis
        positionId = nextPositionId;
        positions[positionId] = Position({
            id: positionId,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            costBasis: amountIn,        // Amount of tokenIn spent
            tokenAmount: amounts[1],     // Amount of tokenOut received
            entryTimestamp: block.timestamp,
            isOpen: true
        });
        
        emit PositionOpened(positionId, tokenIn, tokenOut, amountIn, amounts[1]);
        nextPositionId++;
    }
    
    /**
     * @dev Close position and handle fees (Requirement 4.1 - 4.4)
     * Implements x402 protocol: 5% fee on profits only
     */
    function closePosition(uint256 positionId, uint256 minAmountOut) external onlySessionKey nonReentrant {
        Position storage pos = positions[positionId];
        require(pos.isOpen, "Position not open");
        
        // Approve router to spend the tokens we're selling
        IERC20(pos.tokenOut).approve(address(router), pos.tokenAmount);
        
        // Swap back to base token
        address[] memory path = new address[](2);
        path[0] = pos.tokenOut;
        path[1] = pos.tokenIn;
        
        uint[] memory amounts = router.swapExactTokensForTokens(
            pos.tokenAmount,
            minAmountOut,
            path,
            address(this),
            block.timestamp + 300
        );
        
        uint256 exitAmount = amounts[1];
        uint256 costBasis = pos.costBasis;
        
        // CRITICAL: Update state BEFORE external calls (reentrancy protection)
        pos.isOpen = false;
        
        // Calculate profit/loss
        int256 profitOrLoss;
        uint256 fee = 0;
        
        if (exitAmount > costBasis) {
            // Profitable trade
            uint256 profit = exitAmount - costBasis;
            profitOrLoss = int256(profit);
            
            // x402 Protocol: 5% fee on profit only
            fee = (profit * 5) / 100;
            
            // Transfer fee to agent wallet
            if (fee > 0) {
                require(IERC20(pos.tokenIn).transfer(agentWallet, fee), "Fee transfer failed");
                emit FeeDistributed(agentWallet, fee, profit);
            }
        } else {
            // Losing trade - no fee charged
            profitOrLoss = -int256(costBasis - exitAmount);
        }
        
        emit PositionClosed(positionId, costBasis, exitAmount, profitOrLoss, fee);
    }
    
    /**
     * @dev Liquidate position that has hit stop-loss (public function)
     * Anyone can call this to liquidate underwater positions
     * @param positionId Position ID to liquidate
     * @param minAmountOut Minimum amount to receive from swap
     */
    function liquidate(uint256 positionId, uint256 minAmountOut) external nonReentrant {
        Position storage pos = positions[positionId];
        require(pos.isOpen, "Position not open");
        
        // Check if position has hit stop-loss using Chainlink oracle
        (bool shouldLiquidate, int256 priceChange) = checkStopLoss(positionId);
        require(shouldLiquidate, "Position has not hit stop-loss threshold");
        
        emit StopLossTriggered(positionId, priceChange, riskProfile.stopLossPercent);
        
        // Approve router to spend the tokens we're selling
        IERC20(pos.tokenOut).approve(address(router), pos.tokenAmount);
        
        // Swap back to base token
        address[] memory path = new address[](2);
        path[0] = pos.tokenOut;
        path[1] = pos.tokenIn;
        
        uint[] memory amounts = router.swapExactTokensForTokens(
            pos.tokenAmount,
            minAmountOut,
            path,
            address(this),
            block.timestamp + 300
        );
        
        uint256 exitAmount = amounts[1];
        uint256 costBasis = pos.costBasis;
        
        // CRITICAL: Update state BEFORE external calls (reentrancy protection)
        pos.isOpen = false;
        
        // Calculate loss (stop-loss positions are always losses)
        int256 profitOrLoss = -int256(costBasis - exitAmount);
        uint256 fee = 0; // No fee on losing trades
        
        emit PositionClosed(positionId, costBasis, exitAmount, profitOrLoss, fee);
    }

    receive() external payable {}
}

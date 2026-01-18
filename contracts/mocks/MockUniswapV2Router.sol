// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockUniswapV2Router {
   uint256[] private mockAmounts;
    
    function setAmountsOut(uint256[] memory amounts) external {
        mockAmounts = amounts;
    }
    
    function getAmountsOut(uint256, address[] memory) external view returns (uint256[] memory) {
        return mockAmounts;
    }
    
    function swapExactTokensForTokens(
        uint256,
        uint256,
        address[] memory,
        address,
        uint256
    ) external returns (uint256[] memory) {
        return mockAmounts;
    }
}

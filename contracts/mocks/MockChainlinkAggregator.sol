// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockChainlinkAggregator {
    int256 private price;
    uint8 public decimals;
    uint256 private updatedAtTimestamp;
    
    constructor(uint8 _decimals) {
        decimals = _decimals;
        updatedAtTimestamp = block.timestamp;
    }
    
    function setPrice(int256 _price) external {
        price = _price;
        updatedAtTimestamp = block.timestamp;
    }
    
    function setUpdatedAt(uint256 _timestamp) external {
        updatedAtTimestamp = _timestamp;
    }
    
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (1, price, block.timestamp, updatedAtTimestamp, 1);
    }
}

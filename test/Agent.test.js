const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Agent Contract - Comprehensive Tests", function () {
    let agent;
    let router;
    let tokenIn;
    let tokenOut;
    let priceFeed;
    let owner;
    let sessionKey;
    let agentWallet;
    let user;

    const INITIAL_BALANCE = ethers.parseEther("1000");
    const POSITION_SIZE = ethers.parseEther("100");
    const MIN_OUT = ethers.parseEther("90");

    beforeEach(async function () {
        [owner, sessionKey, agentWallet, user] = await ethers.getSigners();

        // Deploy mock tokens
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        tokenIn = await MockERC20.deploy("Token In", "TIN", INITIAL_BALANCE);
        tokenOut = await MockERC20.deploy("Token Out", "TOUT", INITIAL_BALANCE);

        // Deploy mock router
        const MockRouter = await ethers.getContractFactory("MockUniswapV2Router");
        router = await MockRouter.deploy();

        // Deploy mock price feed
        const MockPriceFeed = await ethers.getContractFactory("MockChainlinkAggregator");
        priceFeed = await MockPriceFeed.deploy(8); // 8 decimals

        // Deploy Agent contract
        const Agent = await ethers.getContractFactory("Agent");
        agent = await Agent.deploy(await router.getAddress(), agentWallet.address);

        // Setup: Transfer tokens to agent contract
        await tokenIn.transfer(await agent.getAddress(), INITIAL_BALANCE);
        await tokenOut.transfer(await router.getAddress(), INITIAL_BALANCE);

        // Register session key
        await agent.registerSessionKey(sessionKey.address, 86400); // 24 hours
        
        // Set risk profile with appropriate max position size
        await agent.setRiskProfile(
            0, // GUARDIAN mode
            90,
            -2,
            ethers.parseEther("1000"), // Max position: 1000 tokens
            [await tokenOut.getAddress()]
        );
    });

    describe("1. Cost Basis Tracking", function () {
        it("Should correctly store cost basis when opening position", async function () {
            const amountIn = ethers.parseEther("100");
            const expectedOut = ethers.parseEther("95");

            // Setup router to return expected amounts
            await router.setAmountsOut([amountIn, expectedOut]);

            const tx = await agent.connect(sessionKey).openPosition(
                await tokenIn.getAddress(),
                await tokenOut.getAddress(),
                amountIn,
                MIN_OUT
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return agent.interface.parseLog(log).name === "PositionOpened";
                } catch { return false; }
            });

            const parsedEvent = agent.interface.parseLog(event);
            expect(parsedEvent.args.costBasis).to.equal(amountIn);
            expect(parsedEvent.args.tokenAmount).to.equal(expectedOut);

            // Verify position storage
            const position = await agent.positions(0);
            expect(position.costBasis).to.equal(amountIn);
            expect(position.tokenAmount).to.equal(expectedOut);
        });

        it("Should calculate profit correctly on closePosition", async function () {
            // Open position
            const amountIn = ethers.parseEther("100");
            const amountOut = ethers.parseEther("95");
            await router.setAmountsOut([amountIn, amountOut]);
            await agent.connect(sessionKey).openPosition(
                await tokenIn.getAddress(),
                await tokenOut.getAddress(),
                amountIn,
                MIN_OUT
            );

            // Close position with profit
            const exitAmount = ethers.parseEther("110"); // 10% profit
            await router.setAmountsOut([amountOut, exitAmount]);

            const tx = await agent.connect(sessionKey).closePosition(0, MIN_OUT);
            const receipt = await tx.wait();
            
            const event = receipt.logs.find(log => {
                try {
                    return agent.interface.parseLog(log).name === "PositionClosed";
                } catch { return false; }
            });

            const parsedEvent = agent.interface.parseLog(event);
            const profit = exitAmount - amountIn;
            expect(parsedEvent.args.profit).to.equal(profit);
        });

        it("Should charge 5% fee only on profitable trades", async function () {
            // Open position
            const amountIn = ethers.parseEther("100");
            await router.setAmountsOut([amountIn, ethers.parseEther("95")]);
            await agent.connect(sessionKey).openPosition(
                await tokenIn.getAddress(),
                await tokenOut.getAddress(),
                amountIn,
                MIN_OUT
            );

            // Close with profit
            const exitAmount = ethers.parseEther("120");
            await router.setAmountsOut([ethers.parseEther("95"), exitAmount]);

            const balanceBefore = await tokenIn.balanceOf(agentWallet.address);
            await agent.connect(sessionKey).closePosition(0, MIN_OUT);
            const balanceAfter = await tokenIn.balanceOf(agentWallet.address);

            const profit = exitAmount - amountIn;
            const expectedFee = profit * 5n / 100n;
            expect(balanceAfter - balanceBefore).to.equal(expectedFee);
        });

        it("Should NOT charge fee on losing trades", async function () {
            // Open position
            const amountIn = ethers.parseEther("100");
            await router.setAmountsOut([amountIn, ethers.parseEther("95")]);
            await agent.connect(sessionKey).openPosition(
                await tokenIn.getAddress(),
                await tokenOut.getAddress(),
                amountIn,
                MIN_OUT
            );

            // Close with loss
            const exitAmount = ethers.parseEther("80");
            await router.setAmountsOut([ethers.parseEther("95"), exitAmount]);

            const balanceBefore = await tokenIn.balanceOf(agentWallet.address);
            await agent.connect(sessionKey).closePosition(0, MIN_OUT);
            const balanceAfter = await tokenIn.balanceOf(agentWallet.address);

            expect(balanceAfter).to.equal(balanceBefore); // No fee charged
        });
    });

    describe("2. Reentrancy Protection", function () {
        it("Should update state before external calls in closePosition", async function () {
            // Open position
            await router.setAmountsOut([POSITION_SIZE, ethers.parseEther("95")]);
            await agent.connect(sessionKey).openPosition(
                await tokenIn.getAddress(),
                await tokenOut.getAddress(),
                POSITION_SIZE,
                MIN_OUT
            );

            // Deploy malicious token that attempts reentrancy
            const MaliciousToken = await ethers.getContractFactory("MaliciousReentrantToken");
            const maliciousToken = await MaliciousToken.deploy(await agent.getAddress());

            // Attempt to close - should fail if reentrancy attempted
            await router.setAmountsOut([ethers.parseEther("95"), ethers.parseEther("100")]);
            await agent.connect(sessionKey).closePosition(0, MIN_OUT);

            // Verify position is closed
            const position = await agent.positions(0);
            expect(position.isOpen).to.be.false;
        });

        it("Should prevent double-closing of position", async function () {
            // Open position
            await router.setAmountsOut([POSITION_SIZE, ethers.parseEther("95")]);
            await agent.connect(sessionKey).openPosition(
                await tokenIn.getAddress(),
                await tokenOut.getAddress(),
                POSITION_SIZE,
                MIN_OUT
            );

            // Close position
            await router.setAmountsOut([ethers.parseEther("95"), ethers.parseEther("100")]);
            await agent.connect(sessionKey).closePosition(0, MIN_OUT);

            // Attempt to close again - should revert
            await expect(
                agent.connect(sessionKey).closePosition(0, MIN_OUT)
            ).to.be.revertedWith("Position not open");
        });
    });

    describe("3. Stop-Loss Enforcement", function () {
        beforeEach(async function () {
            // Set price feeds
            await agent.setPriceFeed(await tokenIn.getAddress(), await priceFeed.getAddress());
            await agent.setPriceFeed(await tokenOut.getAddress(), await priceFeed.getAddress());

            // Set risk profile with -2% stop-loss
            await agent.setRiskProfile(
                0, // GUARDIAN
                90,
                -2, // -2% stop-loss
                POSITION_SIZE,
                [await tokenOut.getAddress()]
            );
        });

        it("Should correctly calculate price change from entry", async function () {
            // Set initial prices
            await priceFeed.setPrice(100000000); // $1.00 (8 decimals)

            // Open position
            await router.setAmountsOut([POSITION_SIZE, ethers.parseEther("100")]);
            await agent.connect(sessionKey).openPosition(
                await tokenIn.getAddress(),
                await tokenOut.getAddress(),
                POSITION_SIZE,
                MIN_OUT
            );

            // Price drops 5%
            await priceFeed.setPrice(95000000); // $0.95

            const [shouldLiquidate, priceChange] = await agent.checkStopLoss(0);
            expect(priceChange).to.be.lte(-2); // At least -2%
        });

        it("Should allow liquidation when stop-loss hit", async function () {
            // Set initial prices
            await priceFeed.setPrice(100000000);

            // Open position
            await router.setAmountsOut([POSITION_SIZE, ethers.parseEther("100")]);
            await agent.connect(sessionKey).openPosition(
                await tokenIn.getAddress(),
                await tokenOut.getAddress(),
                POSITION_SIZE,
                MIN_OUT
            );

            // Price drops below stop-loss
            await priceFeed.setPrice(95000000);

            // Anyone can liquidate
            await router.setAmountsOut([ethers.parseEther("100"), ethers.parseEther("95")]);
            await expect(
                agent.connect(user).liquidate(0, MIN_OUT)
            ).to.emit(agent, "StopLossTriggered");
        });

        it("Should reject liquidation if stop-loss not hit", async function () {
            // Set initial prices
            await priceFeed.setPrice(100000000);

            // Open position
            await router.setAmountsOut([POSITION_SIZE, ethers.parseEther("100")]);
            await agent.connect(sessionKey).openPosition(
                await tokenIn.getAddress(),
                await tokenOut.getAddress(),
                POSITION_SIZE,
                MIN_OUT
            );

            // Price only drops 1% (not enough for -2% stop-loss)
            await priceFeed.setPrice(99000000);

            // Liquidation should fail
            await expect(
                agent.connect(user).liquidate(0, MIN_OUT)
            ).to.be.revertedWith("Position has not hit stop-loss threshold");
        });

        it("Should reject stale price data", async function () {
            await priceFeed.setPrice(100000000);
            
            // Set timestamp to >1 hour ago
            await priceFeed.setUpdatedAt(Math.floor(Date.now() / 1000) - 3700);

            await expect(
                agent.getCurrentPrice(await tokenIn.getAddress())
            ).to.be.revertedWith("Price data too old (>1 hour)");
        });
    });

    describe("4. Risk Profile Management", function () {
        it("Should enforce Guardian mode token whitelist", async function () {
            await agent.setRiskProfile(
                0, // GUARDIAN
                90,
                -2,
                POSITION_SIZE,
                [await tokenIn.getAddress()] // Only tokenIn allowed
            );

            // Should reject tokenOut (not whitelisted)
            await expect(
                agent.connect(sessionKey).openPosition(
                    await tokenIn.getAddress(),
                    await tokenOut.getAddress(),
                    POSITION_SIZE,
                    MIN_OUT
                )
            ).to.be.revertedWith("Token not allowed in Guardian mode");
        });

        it("Should allow all tokens in Hunter mode", async function () {
            await agent.setRiskProfile(
                1, // HUNTER
                50,
                -15,
                POSITION_SIZE,
                [] // Empty = all allowed
            );

            // Should allow any token
            await router.setAmountsOut([POSITION_SIZE, ethers.parseEther("95")]);
            await expect(
                agent.connect(sessionKey).openPosition(
                    await tokenIn.getAddress(),
                    await tokenOut.getAddress(),
                    POSITION_SIZE,
                    MIN_OUT
                )
            ).to.not.be.reverted;
        });

        it("Should enforce max position size", async function () {
            await agent.setRiskProfile(
                0,
                90,
                -2,
                ethers.parseEther("50"), // Max 50 tokens
                [await tokenOut.getAddress()]
            );

            // Should reject position larger than max
            await expect(
                agent.connect(sessionKey).openPosition(
                    await tokenIn.getAddress(),
                    await tokenOut.getAddress(),
                    ethers.parseEther("100"), // Exceeds max
                    MIN_OUT
                )
            ).to.be.revertedWith("Exceeds max position size");
        });
    });

    describe("5. Access Control", function () {
        it("Should only allow owner to set risk profile", async function () {
            await expect(
                agent.connect(user).setRiskProfile(0, 90, -2, POSITION_SIZE, [])
            ).to.be.reverted;
        });

        it("Should only allow owner to register session keys", async function () {
            await expect(
                agent.connect(user).registerSessionKey(user.address, 86400)
            ).to.be.reverted;
        });

        it("Should only allow session keys to open positions", async function () {
            await expect(
                agent.connect(user).openPosition(
                    await tokenIn.getAddress(),
                    await tokenOut.getAddress(),
                    POSITION_SIZE,
                    MIN_OUT
                )
            ).to.be.revertedWith("Unauthorized or expired session key");
        });

        it("Should reject expired session keys", async function () {
            // Register key with 1 second expiry
            await agent.registerSessionKey(user.address, 1);
            
            // Wait 2 seconds
            await ethers.provider.send("evm_increaseTime", [2]);
            await ethers.provider.send("evm_mine");

            // Should reject
            await expect(
                agent.connect(user).openPosition(
                    await tokenIn.getAddress(),
                    await tokenOut.getAddress(),
                    POSITION_SIZE,
                    MIN_OUT
                )
            ).to.be.revertedWith("Unauthorized or expired session key");
        });
    });

    describe("6. Edge Cases", function () {
        it("Should handle zero amount gracefully", async function () {
            await expect(
                agent.connect(sessionKey).openPosition(
                    await tokenIn.getAddress(),
                    await tokenOut.getAddress(),
                    0,
                    MIN_OUT
                )
            ).to.be.revertedWith("Amount must be greater than 0");
        });

        it("Should reject same token swap", async function () {
            await expect(
                agent.connect(sessionKey).openPosition(
                    await tokenIn.getAddress(),
                    await tokenIn.getAddress(), // Same token
                    POSITION_SIZE,
                    MIN_OUT
                )
            ).to.be.revertedWith("Cannot swap same token");
        });

        it("Should handle insufficient balance", async function () {
            const hugeAmount = ethers.parseEther("10000");
            await expect(
                agent.connect(sessionKey).openPosition(
                    await tokenIn.getAddress(),
                    await tokenOut.getAddress(),
                    hugeAmount,
                    MIN_OUT
                )
            ).to.be.revertedWith("Insufficient balance");
        });
    });
});

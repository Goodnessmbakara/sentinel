const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying Agent contract to Cronos Testnet...\n");

    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    // Check balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance), "CRO\n");

    if (balance === 0n) {
        console.error("❌ Error: Deployer account has no CRO balance!");
        console.log("Please fund your account from the Cronos testnet faucet:");
        console.log("https://cronos.org/faucet\n");
        process.exit(1);
    }

    // Deployment parameters
    const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS || "0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae"; // VVS Router
    const AGENT_WALLET = deployer.address; // Use deployer as agent wallet for fees

    console.log("Deployment Parameters:");
    console.log("- Router Address:", ROUTER_ADDRESS);
    console.log("- Agent Wallet (fee recipient):", AGENT_WALLET);
    console.log("");

    // Deploy Agent contract
    console.log("Deploying Agent contract...");
    const Agent = await hre.ethers.getContractFactory("Agent");
    const agent = await Agent.deploy(ROUTER_ADDRESS, AGENT_WALLET);

    await agent.waitForDeployment();
    const agentAddress = await agent.getAddress();

    console.log("✅ Agent contract deployed to:", agentAddress);
    console.log("");

    // Configure initial risk profile (Guardian mode)
    console.log("Configuring initial risk profile (Guardian mode)...");
    const tx = await agent.setRiskProfile(
        0, // GUARDIAN mode
        90, // minConfidenceScore
        -2, // stopLossPercent (-2%)
        hre.ethers.parseEther("1000"), // maxPositionSize
        [
            "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23", // WCRO
            "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59", // USDC
        ]
    );
    await tx.wait();
    console.log("✅ Risk profile configured");
    console.log("");

    // Configure Chainlink price feeds (if available on testnet)
    console.log("Note: Chainlink price feeds must be configured separately");
    console.log("Use setPriceFeed() function after deployment");
    console.log("");

    // Summary
    console.log("📋 Deployment Summary:");
    console.log("=".repeat(60));
    console.log("Contract Address:", agentAddress);
    console.log("Network:", "Cronos Testnet (Chain ID: 338)");
    console.log("Deployer:", deployer.address);
    console.log("Router:", ROUTER_ADDRESS);
    console.log("Agent Wallet:", AGENT_WALLET);
    console.log("=".repeat(60));
    console.log("");

    console.log("📝 Next Steps:");
    console.log("1. Update .env file:");
    console.log(`   CONTRACT_ADDRESS=${agentAddress}`);
    console.log("");
    console.log("2. Configure Chainlink price feeds:");
    console.log("   npx hardhat run scripts/configurePriceFeeds.js --network cronos_testnet");
    console.log("");
    console.log("3. Restart API server:");
    console.log("   npm run start:api");
    console.log("");
    console.log("4. Fund the contract with test tokens for trading");
    console.log("");

    // Save deployment info to file
    const fs = require('fs');
    const deploymentInfo = {
        network: "cronos_testnet",
        chainId: 338,
        contractAddress: agentAddress,
        deployer: deployer.address,
        router: ROUTER_ADDRESS,
        agentWallet: AGENT_WALLET,
        timestamp: new Date().toISOString(),
        blockNumber: await hre.ethers.provider.getBlockNumber()
    };
    
    fs.writeFileSync(
        'deployment-info.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("✅ Deployment info saved to deployment-info.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

const hre = require("hardhat");

async function main() {
    console.log("🔧 Configuring Chainlink Price Feeds...\n");

    // Get contract address from deployment
    const fs = require('fs');
    let agentAddress;
    
    try {
        const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
        agentAddress = deploymentInfo.contractAddress;
        console.log("Agent Contract:", agentAddress);
    } catch (error) {
        console.error("❌ Error: deployment-info.json not found!");
        console.log("Please deploy the contract first:");
        console.log("npx hardhat run scripts/deploy.js --network cronos_testnet\n");
        process.exit(1);
    }

    const [deployer] = await hre.ethers.getSigners();
    console.log("Configuring with account:", deployer.address);
    console.log("");

    // Get Agent contract
    const agent = await hre.ethers.getContractAt("Agent", agentAddress);

    // Chainlink Price Feed Addresses for Cronos Testnet
    // Note: These may need to be updated based on actual Chainlink deployment
    const priceFeeds = [
        {
            name: "WCRO",
            token: "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23",
            feed: "0x00Cb80Cf097D9aA9A3779ad8EE7cF98437eaE050" // CRO/USD (verify on Chainlink docs)
        },
        {
            name: "USDC",
            token: "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59",
            feed: "0x..." // USDC/USD (update with actual address)
        }
    ];

    console.log("Setting price feeds...");
    console.log("=".repeat(60));

    for (const { name, token, feed } of priceFeeds) {
        if (feed === "0x...") {
            console.log(`⚠️  Skipping ${name} - price feed address not configured`);
            continue;
        }

        try {
            console.log(`Setting ${name} price feed...`);
            console.log(`  Token: ${token}`);
            console.log(`  Feed:  ${feed}`);
            
            const tx = await agent.setPriceFeed(token, feed);
            await tx.wait();
            
            console.log(`✅ ${name} price feed configured`);
            console.log("");
        } catch (error) {
            console.error(`❌ Error setting ${name} price feed:`, error.message);
            console.log("");
        }
    }

    console.log("=".repeat(60));
    console.log("");

    // Verify price feeds
    console.log("Verifying price feeds...");
    for (const { name, token, feed } of priceFeeds) {
        if (feed === "0x...") continue;

        try {
            const configuredFeed = await agent.priceFeeds(token);
            if (configuredFeed === feed) {
                console.log(`✅ ${name}: Verified`);
                
                // Try to get current price
                try {
                    const price = await agent.getCurrentPrice(token);
                    console.log(`   Current price: ${price.toString()} (scaled by 1e8)`);
                } catch (priceError) {
                    console.log(`   ⚠️  Could not fetch price: ${priceError.message}`);
                }
            } else {
                console.log(`❌ ${name}: Mismatch!`);
            }
        } catch (error) {
            console.log(`❌ ${name}: Error verifying - ${error.message}`);
        }
    }

    console.log("");
    console.log("✅ Price feed configuration complete!");
    console.log("");
    console.log("📝 Note: Update price feed addresses in this script with actual Chainlink addresses");
    console.log("   Check: https://docs.chain.link/data-feeds/price-feeds/addresses?network=cronos");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

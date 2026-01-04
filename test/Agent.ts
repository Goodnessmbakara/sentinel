import { expect } from "chai";
import "@nomicfoundation/hardhat-ethers";
import { ethers } from "hardhat";
// import { Agent } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Agent Contract", function () {
  let agent: any;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let mockRouter: any;
  let mockToken: any;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    // Mock Router (Simplified for just address check or deployment)
    // For unit testing logic without forking, we mock the contract.
    // Ideally we use a mock contract artifact.
    // const MockRouter = await ethers.getContractFactory("MockUniswapV2Router"); 
    // Or just deploy a dummy contract.
    
    // Let's create a minimal Mock contract inline or assume we can just deploy Agent
    // We will deploy the Agent with a dummy address for router if we don't need to call it in basic tests
    
    const AgentFactory = await ethers.getContractFactory("Agent");
    // Deploy with dummy router address and agent wallet
    agent = await AgentFactory.deploy(owner.address, addr1.address);
  });

  it("Should set risk profile correctly", async function () {
    const allowedTokens = [owner.address]; // dummy
    await agent.setRiskProfile(0, 90, -2, 1000, allowedTokens); // 0 = GUARDIAN
    
    const profile = await agent.riskProfile();
    expect(profile.mode).to.equal(0);
    expect(profile.minConfidenceScore).to.equal(90);
  });

  it("Should register session key", async function () {
    await agent.registerSessionKey(addr1.address, 3600);
    const expiry = await agent.sessionKeys(addr1.address);
    expect(expiry).to.be.gt(Math.floor(Date.now()/1000));
  });
});

require("@nomicfoundation/hardhat-toolbox");
require("ts-node").register();
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      forking: {
        url: "https://evm.cronos.org",
        enabled: false,
      },
      chainId: 25,
    },
    cronos_testnet: {
        url: "https://evm-t3.cronos.org",
        chainId: 338,
        accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    }
  },
};

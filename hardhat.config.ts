import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-storage-layout";
import "hardhat-tracer";
import "@primitivefi/hardhat-dodoc";
import "hardhat-contract-sizer";
// import 'hardhat-exposed';
import { config as dotEnvConfig } from 'dotenv';

dotEnvConfig();

const config: HardhatUserConfig = {
  dodoc: {
    runOnCompile: true,
    debugMode: false,
    freshOutput: true,
    include: ["TokenSale"]
  },
  defaultNetwork: 'hardhat',
  gasReporter: {
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    showTimeSpent: true,
    enabled: true,
    excludeContracts: ["ERC20", "MockERC20"]
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: ["TokenSale"],
  },
  paths: {
    sources: './contracts',
    tests: './test',
    artifacts: './artifacts',
    cache: './cache',
  },
  solidity: {
    compilers: [
      {
        version: '0.8.21',
        settings: {
          evmVersion: 'london',
          // evmVersion: 'paris',
          optimizer: {
            enabled: true,
            runs: 1_000,
          },
          metadata: {
            bytecodeHash: 'none',
          },
        },
      }
    ]
  },
  networks: {
    hardhat: {
      chainId: 1088,// metis
      forking: {
        url: `${process.env.ARCHIVE_NODE_RPC_URL}`,
        blockNumber: parseInt(process.env.FORK_BLOCK ?? '' as string, 10),
      },
      allowUnlimitedContractSize: false,
      allowBlocksWithSameTimestamp: true,
      blockGasLimit: 40000000,
      gas: 40000000,
      gasPrice: 'auto',
      loggingEnabled: false,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 5,
        accountsBalance: '1000000000000000000000000000000000',
        passphrase: "",
      },
    },
    metis: {
      url: "https://andromeda.metis.io/?owner=1088", // public endpoint
      chainId: 1088,
      gas: 'auto',
      gasMultiplier: 1.2,
      gasPrice: 'auto',
      accounts: [`${process.env.PRIVATE_KEY}`],
      loggingEnabled: true,
    },
    development: {
      url: 'http://127.0.0.1:8545',
      gas: 'auto',
      gasMultiplier: 1.2,
      gasPrice: 'auto',
      accounts: [`${process.env.PRIVATE_KEY}`],
    },
  },
  mocha: {
    timeout: 100000,
  }
};

export default config;

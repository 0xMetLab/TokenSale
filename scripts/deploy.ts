import hardhat, { ethers } from "hardhat";

async function main() {

    const [deployer] = await ethers.getSigners();
    const network = hardhat.network.name;

    console.log(
        `[${network}] deployer address: ${deployer.address}`
    );

    let SALE_TOKEN_ADDRESS = "";
    let WHET9_ADDRESS = "";
    let ORACLE_ADDRESS = "";

    if (network === "metis") {
        // SALE_TOKEN_ADDRESS = "";
        WHET9_ADDRESS = "0x75cb093E4D61d2A2e65D8e0BBb01DE8d89b53481"; //WMETIS
        ORACLE_ADDRESS = "0xc78A189Aa13445294813309F0c24319C20FB2bcA"; // METIS-USD
    }
    const TokenSaleFactory = await ethers.getContractFactory("TokenSale");
    const tokenSale = await TokenSaleFactory.deploy(SALE_TOKEN_ADDRESS, WHET9_ADDRESS, ORACLE_ADDRESS);
    await tokenSale.waitForDeployment();
    const tokenSaleAddress = await tokenSale.getAddress();
    console.log(
        `TokenSale with saleTokenAddress:${SALE_TOKEN_ADDRESS} deployed to ${tokenSaleAddress}`
    );

    console.log("done!");
    process.exit(0);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

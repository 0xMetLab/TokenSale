import {
  time,
  mine,
  mineUpTo,
  takeSnapshot,
  SnapshotRestorer,
  impersonateAccount,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import { IERC20, MockERC20, IWETH, TokenSale } from "../typechain-types";

describe("TokenSale", function () {
  const WMETIS_ADDRESS = "0x75cb093E4D61d2A2e65D8e0BBb01DE8d89b53481"; //WMETIS
  const WMETIS_ORACLE_ADDRESS = "0xc78A189Aa13445294813309F0c24319C20FB2bcA"; // METIS-USD
  const TOTAL_SALES_SUPPLY = ethers.parseUnits("10000000", 18);
  const SALE_PERIOD = time.duration.days(3);
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let tokenSale: TokenSale;
  let saleToken: MockERC20;
  let saleTokenAddress: string;
  let weth9: IWETH;
  let snapshot: SnapshotRestorer;

  // Utility function to setup the environment before each test
  before(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const SaleTokenFactory = await ethers.getContractFactory("MockERC20"); // Assuming there is an ERC20Mock contract
    saleToken = await SaleTokenFactory.deploy("TestToken", "TT", 18);

    saleTokenAddress = await saleToken.getAddress();

    weth9 = await ethers.getContractAt("IWETH", WMETIS_ADDRESS);
    weth9.connect(owner).deposit({ value: ethers.parseUnits("100000", 18) });
    weth9.connect(alice).deposit({ value: ethers.parseUnits("1000000", 18) });
    weth9.connect(bob).deposit({ value: ethers.parseUnits("1000000", 18) });


    const TokenSaleFactory = await ethers.getContractFactory("TokenSale");
    tokenSale = await TokenSaleFactory.deploy(saleTokenAddress, WMETIS_ADDRESS, WMETIS_ORACLE_ADDRESS);

    weth9.connect(owner).approve(tokenSale.getAddress(), ethers.MaxUint256);
    weth9.connect(alice).approve(tokenSale.getAddress(), ethers.MaxUint256);
    weth9.connect(bob).approve(tokenSale.getAddress(), ethers.MaxUint256);

    await saleToken.mint(tokenSale.getAddress(), TOTAL_SALES_SUPPLY); // Mint enough tokens for the sale
  });

  it("should deploy with correct initial settings", async function () {
    expect(await tokenSale.saleToken()).to.equal(saleTokenAddress);
  });

  it("Should not allow purchase when sale is not started", async function () {
    await expect(tokenSale.connect(alice).purchaseExactPay(1000000, 0)).to.be.revertedWith(
      "sales haven't started yet"
    );
  });

  it("should let only owner start the sale", async function () {
    const initialRate = ethers.parseUnits("605", 18); // ~ $0.2 per token
    await expect(tokenSale.connect(alice).startSale(initialRate)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    await tokenSale.connect(owner).startSale(initialRate);
    const timestamp = await time.latest();
    expect(await tokenSale.endTime()).to.equal(timestamp + SALE_PERIOD);
    expect(await tokenSale.initialSaleTokenRate()).to.equal(initialRate);
  });

  it('should return the correct price of the asset in USD', async function () {
    const expectedPrice = "0.20"; // Assume $0.20 per METIS
    const priceInUSD = await tokenSale.currentPriceInUSD();
    //console.log("priceInUSD", ethers.formatUnits(priceInUSD, 18));
    expect(parseFloat(ethers.formatUnits(priceInUSD, 18)).toFixed(2)).to.eq(expectedPrice);
  });

  it("should not allow purchase a zero amount", async function () {
    await expect(tokenSale.connect(alice).purchaseExactPay(0, 0)).to.be.revertedWith("amount is too small");
  });

  it("should not allow purchase an amount greater than the supply", async function () {
    await expect(
      tokenSale.connect(alice).purchaseExactPurchased(TOTAL_SALES_SUPPLY + 1n, ethers.MaxUint256, { value: 0 })
    ).to.be.revertedWith("amount is too large");
  });

  it("should revert when minimum purchased output is not met", async function () {
    const paymentAmount = ethers.parseUnits("1", 18);
    const value = ethers.parseUnits("1", 18);
    const minPurchasedOut = await tokenSale.calculatePurchaseAmount(paymentAmount + value);
    const badMinPurchasedOut = minPurchasedOut + ethers.parseUnits("2000", "wei"); // Value intentionally set too high

    // Expect the transaction to fail due to the minPurchasedOut requirement
    await expect(
      tokenSale.connect(alice).purchaseExactPay(paymentAmount, badMinPurchasedOut, { value: value })
    ).to.be.revertedWith("insufficient purchased");
  });

  it("should allow purchasing the exact pay with valid amounts", async function () {
    // First setup the environment if needed (e.g., provide user with payment token)
    const paymentAmount = ethers.parseUnits("1", 18);
    const delimiter = ethers.parseUnits("1", 18);
    const initialSaleTokenRate = await tokenSale.initialSaleTokenRate();
    const initialBalance = await weth9.balanceOf(await tokenSale.getAddress());
    const value = ethers.parseUnits("1", 18);
    const minPurchasedOut = await tokenSale.calculatePurchaseAmount(paymentAmount + value);
    const initialSaleTokenBalance = await tokenSale.tokenBalanceOf(await alice.getAddress());
    // Attempt to make a purchase
    await expect(tokenSale.connect(alice).purchaseExactPay(paymentAmount, minPurchasedOut, { value: value }))
      .to.emit(tokenSale, 'PurchaseExactPay')
      .withArgs(await alice.getAddress(), paymentAmount + value, anyValue); // anyValue assumes we don't know the exact output
    const newBalance = await weth9.balanceOf(await tokenSale.getAddress());
    const newSaleTokenBalance = await tokenSale.tokenBalanceOf(await alice.getAddress());
    expect(newBalance - initialBalance).to.equal(paymentAmount + value);
    expect(newSaleTokenBalance - initialSaleTokenBalance).to.equal((paymentAmount + value) * initialSaleTokenRate / delimiter);
    // console.log("newSaleTokenBalance", ethers.formatUnits(newSaleTokenBalance - initialSaleTokenBalance, 18));
    // Check resulting balances, supply, etc.
  });

  it('should emit Purchase event on receiving Ether', async function () {
    const paymentAmount = ethers.parseUnits("1", 18);
    const initialBalance = await weth9.balanceOf(await tokenSale.getAddress());
    const minPurchasedOut = await tokenSale.calculatePurchaseAmount(paymentAmount);
    // Listen for the event
    await expect(
      alice.sendTransaction({
        to: await tokenSale.getAddress(),
        value: paymentAmount, // Sending 1 Ether
      })
    )
      .to.emit(tokenSale, 'Purchase')
      .withArgs(await alice.getAddress(), paymentAmount, minPurchasedOut);
    const newBalance = await weth9.balanceOf(await tokenSale.getAddress());
    expect(newBalance - initialBalance).to.equal(paymentAmount);
  });


  it("should revert if payment amount exceeds maxPaymentAmount", async () => {
    const purchaseAmountOut = ethers.parseEther("600");
    const maxPaymentAmount = await tokenSale.calculatePaymentAmount(purchaseAmountOut) - 1n;

    // Attempt to make a purchase with max payment less than required payment amount.
    await expect(tokenSale.connect(alice).purchaseExactPurchased(purchaseAmountOut, maxPaymentAmount))
      .to.be.revertedWith("payment too high");
    await expect(tokenSale.connect(alice).purchaseExactPurchased(purchaseAmountOut, 0, { value: maxPaymentAmount }))
      .to.be.revertedWith("payment too high");
  });

  it("purchase an exact amount should be successful when payment is adequate", async () => {
    const initialBalance = await weth9.balanceOf(await tokenSale.getAddress());
    const purchaseAmountOut = ethers.parseEther("600");//saleToken
    const maxPaymentAmount1 = await tokenSale.calculatePaymentAmount(purchaseAmountOut);

    let tx = await tokenSale.connect(alice).purchaseExactPurchased(purchaseAmountOut, maxPaymentAmount1);
    await expect(tx).to.emit(tokenSale, "PurchaseExactPurchased")
      .withArgs(await alice.getAddress(), maxPaymentAmount1, purchaseAmountOut);
    const maxPaymentAmount2 = await tokenSale.calculatePaymentAmount(purchaseAmountOut);
    tx = await tokenSale.connect(alice).purchaseExactPurchased(purchaseAmountOut, 0, { value: maxPaymentAmount2 });
    await expect(tx).to.emit(tokenSale, "PurchaseExactPurchased")
      .withArgs(await alice.getAddress(), maxPaymentAmount2, purchaseAmountOut);
    const newBalance = await weth9.balanceOf(await tokenSale.getAddress());
    expect(newBalance - initialBalance).to.equal(maxPaymentAmount1 + maxPaymentAmount2);

  });

  it("should refund ETH if sent value exceeds payment amount", async () => {
    const purchaseAmountOut = ethers.parseEther("600");
    const maxPaymentAmount = await tokenSale.calculatePaymentAmount(purchaseAmountOut);
    const extraPaymentEth = ethers.parseEther("0.5");
    const totalValueSent = maxPaymentAmount + extraPaymentEth;

    // Record initial balance before transaction
    const initialBalance = await ethers.provider.getBalance(bob.address);

    const tx = await tokenSale.connect(bob).purchaseExactPurchased(purchaseAmountOut, 0, { value: totalValueSent });

    // Calculate gas cost
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;

    // Record final balance after transaction
    const finalBalance = await ethers.provider.getBalance(bob.address);

    expect(finalBalance).to.equal(initialBalance - (maxPaymentAmount + gasCost),
      "Incorrect ETH refund after purchasing tokens");
  });

  it("should allow the owner to withdraw WMETIS", async function () {
    await expect(
      tokenSale.connect(owner).withdrawWrappedNativeToken(owner.address)
    ).to.be.not.reverted;
  });

  it('should grow the saleToken price correctly: $0.20 => $1.00', async function () {
    // initial price: $0.20
    const expectedPrice = "0.60"; //50% sold(growth +200%) :  GROWTH_COEFFICIENT = 4
    const expectedPrice2 = "1.00"; //100% sold(growth +400%): GROWTH_COEFFICIENT = 4
    const availableAmount = await tokenSale.availablePurchaseVolume();
    const TOTAL_SALES_SUPPLY = await tokenSale.TOTAL_SALES_SUPPLY();

    const purchaseAmountOut = TOTAL_SALES_SUPPLY / 2n - (TOTAL_SALES_SUPPLY - availableAmount);//50% sold
    const maxPaymentAmount = await tokenSale.calculatePaymentAmount(purchaseAmountOut);
    await tokenSale.connect(bob).purchaseExactPurchased(purchaseAmountOut, maxPaymentAmount);

    const priceInUSD = await tokenSale.currentPriceInUSD();
    // console.log("priceInUSD", ethers.formatUnits(priceInUSD, 18));
    expect(parseFloat(ethers.formatUnits(priceInUSD, 18)).toFixed(2)).to.eq(expectedPrice);
    snapshot = await takeSnapshot();
    const purchaseAmountOut2 = TOTAL_SALES_SUPPLY / 2n;//100% sold
    const maxPaymentAmount2 = await tokenSale.calculatePaymentAmount(purchaseAmountOut2);
    await tokenSale.connect(alice).purchaseExactPurchased(purchaseAmountOut2, maxPaymentAmount2);

    const priceInUSD2 = await tokenSale.currentPriceInUSD();
    // console.log("priceInUSD", ethers.formatUnits(priceInUSD, 18));
    expect(parseFloat(ethers.formatUnits(priceInUSD2, 18)).toFixed(2)).to.eq(expectedPrice2);
  });

  it("should fail when a non-owner tries to withdraw WMETIS", async function () {
    await snapshot.restore();//50% sold
    await time.increase(SALE_PERIOD);
    await expect(
      tokenSale.connect(bob).withdrawWrappedNativeToken(bob.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should allow the owner to withdraw unsold tokens", async function () {
    const unsoldBalance = TOTAL_SALES_SUPPLY / 2n;//50% sold
    // Listen for the WithdrawUnsold event
    await expect(tokenSale.connect(owner).withdrawUnsold())
      .to.emit(tokenSale, "WithdrawUnsold")
      .withArgs(unsoldBalance);

    // After withdrawal, the contract's balance of saleToken should be zero
    expect(await saleToken.balanceOf(await saleToken.getAddress())).to.equal(ethers.parseEther("0"));

    // And the owner's balance should have increased by the unsold amount
    expect(await saleToken.balanceOf(owner.address)).to.equal(unsoldBalance);
  });

  it("should revert if there are no unsold tokens", async function () {
    await expect(
      tokenSale.connect(owner).withdrawUnsold()
    ).to.be.revertedWith("no unsold tokens");
  });

  it("should allow the owner to withdraw WMETIS when the sale is over", async function () {

    const balanceOwner = await weth9.balanceOf(owner.address);
    const balanceContract = await weth9.balanceOf(await tokenSale.getAddress());

    await tokenSale.connect(owner).withdrawWrappedNativeToken(owner.address);

    expect(await weth9.balanceOf(owner.address)).to.equal(balanceOwner + balanceContract);
  });

  it("should work a vesting correctly", async () => {
    let aliceSaleTokenAmount = await tokenSale.tokenBalanceOf(alice.address);
    let bobSaleTokenAmount = await tokenSale.tokenBalanceOf(bob.address);

    const endTime = await tokenSale.endTime();
    const vestingPeriod = await tokenSale.vestingPeriod();
    const currentTime = await time.latest();
    await time.increase(vestingPeriod / 2n - (BigInt(currentTime) - endTime));// 50% of vesting period

    await expect(
      tokenSale.connect(alice).exit()
    ).to.be.revertedWith("too early");
    await expect(
      tokenSale.connect(alice).exit()
    ).to.be.revertedWith("too early");

    const aliceEstimateUnlockedAmount = await tokenSale.estimateUnlockedAmount(alice.address);
    await time.setNextBlockTimestamp(await time.latest());

    await tokenSale.connect(alice).exitEarly();
    const aliceBalance = await saleToken.balanceOf(alice.address);
    expect(aliceBalance).to.equal(aliceEstimateUnlockedAmount);

    await expect(tokenSale.connect(owner).withdrawUnsold())
      .to.emit(tokenSale, "WithdrawUnsold")
      .withArgs(aliceSaleTokenAmount - aliceEstimateUnlockedAmount);

    await time.increase(vestingPeriod / 2n);// 100% of vesting period

    const bobEstimateUnlockedAmount = await tokenSale.estimateUnlockedAmount(bob.address);
    await time.setNextBlockTimestamp(await time.latest());

    await tokenSale.connect(bob).exit();
    const bobBalance = await saleToken.balanceOf(bob.address);
    expect(bobBalance).to.equal(bobSaleTokenAmount);
    expect(bobBalance).to.equal(bobEstimateUnlockedAmount);
    await expect(
      tokenSale.connect(owner).withdrawUnsold()
    ).to.be.revertedWith("no unsold tokens");

  });

});

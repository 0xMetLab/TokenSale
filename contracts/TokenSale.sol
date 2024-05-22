// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.21;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IWETH } from "./interfaces/IWETH.sol";
import "./interfaces/IOracle.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

/**
 * @title TokenSale contract
 */
contract TokenSale is Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH;

    /// @title Constants.

    /// @notice Total number of tokens available for sale
    uint256 public constant TOTAL_SALES_SUPPLY = 10_000_000 * 1e18;
    /// @notice The period over which the sale will be open
    uint256 public constant SALE_PERIOD = 3 days;
    /// @notice Base point unit used for growth calculations
    uint256 public constant BP = 1e4;
    /// @notice Growth coefficient in basis points to calculate token price increase
    uint256 public constant GROWTH_COEFFICIENT_BP = 4 * 1e4;

    /// @title State variables

    /// @notice The token being sold in the sale
    IERC20 public immutable saleToken;
    /// @notice Wrapped native token on current network
    IWETH public immutable weth9;
    /// @notice The oracle contract implementing the `IOracle` interface for weth9 valuation ( optionally )
    IOracle public nativeTokenOracle;
    /// @notice The vesting period for purchased tokens
    uint256 public vestingPeriod = 365 days;
    /// @notice Initial rate of tokens per weth9 at the start of the sale
    uint256 public initialSaleTokenRate;
    /// @notice Timestamp when the token sale ends
    uint256 public endTime;
    /// @notice Total amount of tokens purchased across all buyers
    uint256 public totalPurchased;
    /// @notice Total amount of tokens still locked due to vesting
    uint256 public totalLocked;
    /// @notice Mapping of user balances representing the amount of tokens owned by each user
    mapping(address /**user*/ => uint256 /**balance*/) public tokenBalanceOf;

    // Modifiers
    modifier checkSaleIsNotOver() {
        require(saleIsNotOver(), "sale is over");
        _;
    }

    modifier checkSaleIsOver() {
        require(!saleIsNotOver(), "sale is NOT over");
        _;
    }
    // Events
    event StartSale(uint256 saleTokenRate);
    event WithdrawUnsold(uint256 unsold);
    event Purchase(address purchaser, uint256 paymentAmount, uint256 purchaseAmount);
    event PurchaseExactPay(address purchaser, uint256 paymentAmount, uint256 purchaseAmount);
    event PurchaseExactPurchased(address purchaser, uint256 paymentAmount, uint256 purchaseAmount);
    event Exit(address user, uint256 amount);
    event UpVestingPeriod(uint256 period);
    event UpNativeTokenOracle(address oracle);

    /**
     * @notice Creates a new `TokenSale` contract instance.
     * @dev Initializes the contract with references to the sale token, wrapped native token, and optionally an oracle for price information.
     * @param saleTokenAddress The ERC-20 token being sold.
     * @param wrappedNativeTokenAddress The wrapped native token's contract address, typically WETH.
     * @param nativeTokenOracleAddress The oracle's contract address used for price information. Can be zero if the oracle is not yet available or needed.
     */
    constructor(
        address saleTokenAddress,
        address wrappedNativeTokenAddress,
        address nativeTokenOracleAddress
    ) {
        require(
            saleTokenAddress != address(0) && wrappedNativeTokenAddress != address(0),
            "address cannot be zero"
        );
        saleToken = IERC20(saleTokenAddress);
        weth9 = IWETH(wrappedNativeTokenAddress);
        // optionally set oracle
        if (nativeTokenOracleAddress != address(0)) {
            require(IOracle(nativeTokenOracleAddress).peekSpot("") != 0, "unsupported oracle");
            nativeTokenOracle = IOracle(nativeTokenOracleAddress);
        }
    }

    /**
     * @notice Allows the sending of Ether to the contract to purchase tokens automatically at the current rate.
     * @dev When Ether is sent to the contract, it calculates the token amount, purchases tokens, and wraps the Ether into weth9.
     * Emits a `Purchase` event upon completion.
     */
    receive() external payable {
        uint256 purchasedOut = calculatePurchaseAmount(msg.value);
        _purchase(purchasedOut);
        weth9.deposit{ value: msg.value }();
        emit Purchase(msg.sender, msg.value, purchasedOut);
    }

    /**
     * @notice Checks if the sale period is still active.
     * @dev Returns whether the current block timestamp is less than the `endTime` and there is available purchase volume.
     * Reverts if the sales have not started (i.e., `endTime` is not set).
     * @return The status of the sale; true if the sale is ongoing, false otherwise.
     */
    function saleIsNotOver() public view returns (bool) {
        uint256 _endTime = endTime;
        require(_endTime > 0, "sales haven't started yet");
        return (block.timestamp < _endTime && availablePurchaseVolume() > 0);
    }

    /**
     * @notice Calculates the available volume for purchase based on the total sales supply.
     * @dev Subtracts `totalPurchased` from `TOTAL_SALES_SUPPLY` to determine remaining supply.
     * @return The quantity of tokens that are still available for purchase.
     */
    function availablePurchaseVolume() public view returns (uint256) {
        return TOTAL_SALES_SUPPLY - totalPurchased;
    }

    /**
     * @notice Determines the volume of tokens that can be withdrawn by owner after the sale is over.
     * @dev Subtracts `totalLocked` from the balance of sale tokens held by the contract.
     * Requires `checkSaleIsOver` modifier to enforce execution only after the sale ends.
     * @return unsold Amount of unsold tokens that can be withdrawn.
     */
    function availableWithdrawVolume() public view checkSaleIsOver returns (uint256 unsold) {
        unsold = saleToken.balanceOf(address(this)) - totalLocked;
    }

    /**
     * @notice Estimates the amount of unlocked tokens available for a user after the vesting started.
     * @dev Calculates the unlocked token amount for a given user based on the internal logic of `_calculateUnlockedAmount`.
     * Requires `checkSaleIsOver` modifier to ensure sale has concluded.
     * @param user The address of the user for whom to calculate the unlocked token amount.
     * @return unlockedAmount The calculated amount of tokens that the user can potentially unlock.
     */
    function estimateUnlockedAmount(
        address user
    ) external view checkSaleIsOver returns (uint256 unlockedAmount) {
        uint256 userAmount = tokenBalanceOf[user];
        unlockedAmount = _calculateUnlockedAmount(userAmount);
    }

    /**
     * @notice Calculate the current saleToken rate based on the total purchased amount.
     * @dev This function computes the rate considering a growth coefficient which adjusts the rate
     * based on the total sales. The rate grows proportionally to the total tokens purchased so far.
     * @return saleTokenRate The current rate of saleToken.
     */
    function currentSaleTokenRate() public view returns (uint256 saleTokenRate) {
        uint256 growthBPs = (totalPurchased * GROWTH_COEFFICIENT_BP) / TOTAL_SALES_SUPPLY;
        saleTokenRate = (initialSaleTokenRate * BP) / (BP + growthBPs);
    }

    /**
     * @notice Retrieves the current saleToken price in USD.
     * @dev Requires that the nativeTokenOracle is set before calling (not equal to the zero address).
     * @return price The current price of the asset in USD with 18 decimal places.
     */
    function currentPriceInUSD() external view returns (uint256 price) {
        require(address(nativeTokenOracle) != address(0), "nativeTokenOracle is not set");
        uint256 saleTokenRate = currentSaleTokenRate();
        uint256 wethPriceInUSD = nativeTokenOracle.peekSpot("");
        price = (wethPriceInUSD * 1e18) / saleTokenRate;
    }

    /**
     * @notice Calculates the purchase amount a user receives for a given payment.
     * @dev The purchase amount is calculated based on an increase in price relative to the total amount already purchased.
     * This uses a growth formula where the price grows as more tokens are sold, based on a fixed growth coefficient.
     * @param paymentAmount Amount of the payment currency (e.g., ETH) used to purchase tokens.
     * @return purchaseAmount The resulting amount of tokens that can be purchased with the specified `paymentAmount`.
     */
    function calculatePurchaseAmount(
        uint256 paymentAmount
    ) public view returns (uint256 purchaseAmount) {
        uint256 saleTokenRate = currentSaleTokenRate();
        purchaseAmount = (paymentAmount * saleTokenRate) / 1e18;
    }

    /**
     * @notice Calculates the payment amount required for purchasing a specific amount of tokens.
     * @dev The payment amount is determined based on the dynamically changing token rate due to the sales growth formula.
     * It ensures that if the result is not an integer, it will be rounded up to the next whole unit of the payment currency.
     * @param purchaseAmount The desired amount of tokens to purchase.
     * @return paymentAmount The corresponding amount of payment currency needed to purchase the `purchaseAmount` of tokens.
     */
    function calculatePaymentAmount(
        uint256 purchaseAmount
    ) public view returns (uint256 paymentAmount) {
        uint256 saleTokenRate = currentSaleTokenRate();
        uint256 intermediate = (purchaseAmount * 1e18);
        paymentAmount = intermediate / saleTokenRate;
        require(paymentAmount > 0, "amount is too small");
        //round up
        if (intermediate % saleTokenRate > 0) {
            paymentAmount += 1;
        }
    }

    /**
     * @notice Sets the oracle address for weth9 valuation.
     * @dev Can only be called by the contract owner.
     * @param oracle The address of the new oracle contract implementing the `IOracle` interface.
     * Requirements:
     * - The caller must be the contract's owner.
     * - The new oracle must return a non-zero value for `peekSpot("")`.
     */
    function setNativeTokenOracle(address oracle) external onlyOwner {
        require(IOracle(oracle).peekSpot("") != 0, "unsupported oracle");
        nativeTokenOracle = IOracle(oracle);
        emit UpNativeTokenOracle(oracle);
    }

    /**
     * @notice Reduces the vesting period for token sale participants.
     * @dev Can only be called by the contract owner. Emits an event upon reducing the vesting period.
     * @param _vestingPeriod The new, reduced vesting period in seconds.
     */
    function reduceVestingPeriod(uint256 _vestingPeriod) external onlyOwner {
        require(_vestingPeriod > 0, "period cannot be zero");
        require(_vestingPeriod < vestingPeriod, "period should be less than current");
        vestingPeriod = _vestingPeriod;
        emit UpVestingPeriod(_vestingPeriod);
    }

    /**
     * @notice Initiates the sale process with a given rate for the sale token.
     * @dev Sets the initial rate for the token sale and starts the countdown for the sale. Can only be initiated once.
     * This function also ensures that the initial rate set is valid and that the contract holds enough tokens to cover the sale supply.
     * The `onlyOwner` modifier ensures the function can only be called by the contract owner.
     * @param _initialSaleTokenRate The initial rate at which tokens are sold (number of tokens per payment currency unit).
     */
    function startSale(uint256 _initialSaleTokenRate) public onlyOwner {
        require(initialSaleTokenRate == 0, "only once");
        require((_initialSaleTokenRate * BP) / (BP + GROWTH_COEFFICIENT_BP) > 0, "invalid rate");
        require(
            saleToken.balanceOf(address(this)) >= TOTAL_SALES_SUPPLY,
            "saleToken.balance too low"
        );

        initialSaleTokenRate = _initialSaleTokenRate;
        endTime = block.timestamp + SALE_PERIOD;
        emit StartSale(_initialSaleTokenRate);
    }

    /**
     * @notice Withdraws unsold tokens from the contract.
     * @dev Uses safeTransfer to send the unsold tokens to the owner's address.
     * Can only be called by the owner of the contract. The amount of unsold tokens is determined by the availableWithdrawVolume function.
     */
    function withdrawUnsold() external onlyOwner {
        uint256 unsold = availableWithdrawVolume();
        require(unsold > 0, "no unsold tokens");
        saleToken.safeTransfer(owner(), unsold);
        emit WithdrawUnsold(unsold);
    }

    /**
     * @notice Withdraws weth9 collected during the sale.
     * @dev Uses safeTransfer to send the weth9 balance from the contract to the specified address.
     * @param to The recipient address for withdrawing weth9.
     */
    function withdrawWrappedNativeToken(address to) external onlyOwner {
        uint256 balance = weth9.balanceOf(address(this));
        require(balance > 0, "no tokens to withdraw");
        if (balance > 0) {
            weth9.safeTransfer(to, balance);
        }
    }

    /// @title Purchase Functions for Exact Payment and Purchased Amount Management

    /**
     * @notice Allows users to purchase tokens with an exact payment amount.
     * @dev Executes a token purchase by calculating the output amount and performing checks and internal transfers.
     * Emits a PurchaseExactPay event upon completion.
     * @param paymentAmount The amount of payment provided in tokens.
     * @param minPurchasedOut The minimum amount of tokens to be purchased, required for the transaction to succeed.
     */
    function purchaseExactPay(uint256 paymentAmount, uint256 minPurchasedOut) external payable {
        uint256 purchasedOut = calculatePurchaseAmount(paymentAmount + msg.value);
        require(purchasedOut >= minPurchasedOut, "insufficient purchased");
        _purchase(purchasedOut);
        _pay(paymentAmount, msg.value);
        emit PurchaseExactPay(msg.sender, paymentAmount + msg.value, purchasedOut);
    }

    /**
     * @notice Allows users to purchase a specified amount of tokens, not exceeding a maximum payment.
     * @dev Calculates necessary payment for a fixed purchase amount, validates it against maxPaymentAmount,
     * enacts the purchase, and handles refunds if necessary. Emits a PurchaseExactPurchased event when done.
     * @param purchaseAmountOut The exact amount of tokens the user wants to purchase.
     * @param maxPaymentAmount The maximum amount of payment the user is willing to provide for this purchase.
     */
    function purchaseExactPurchased(
        uint256 purchaseAmountOut,
        uint256 maxPaymentAmount
    ) external payable {
        uint256 paymentAmount = calculatePaymentAmount(purchaseAmountOut);
        require(
            paymentAmount <= maxPaymentAmount || paymentAmount <= msg.value,
            "payment too high"
        );
        _purchase(purchaseAmountOut);

        if (msg.value > paymentAmount) {
            _pay(0, paymentAmount);
            _refundDustETH(msg.value - paymentAmount);
        } else {
            _pay(paymentAmount - msg.value, msg.value);
        }
        emit PurchaseExactPurchased(msg.sender, paymentAmount, purchaseAmountOut);
    }

    /**
     * @dev Transfers the vested tokens for the caller.
     * @notice This function allows the caller to transfer their tokens if they are fully unlocked.
     */
    function exit() external checkSaleIsOver {
        _exit(false);
    }

    /**
     * @dev Transfers the vested tokens for the caller in case of an early exit.
     * @notice This function allows the caller to exit early but he will lose the locked tokens
     * and will receive only those that are currently unlocked.
     */
    function exitEarly() external checkSaleIsOver {
        _exit(true);
    }

    function _exit(bool early) private {
        uint256 userAmount = tokenBalanceOf[msg.sender];
        uint256 unlockedAmount = _calculateUnlockedAmount(userAmount);

        if (unlockedAmount > 0) {
            require(early || unlockedAmount == userAmount, "too early");
            totalLocked -= userAmount;
            tokenBalanceOf[msg.sender] = 0;
            saleToken.safeTransfer(msg.sender, unlockedAmount);
            emit Exit(msg.sender, unlockedAmount);
        }
    }

    function _calculateUnlockedAmount(
        uint256 amount
    ) private view returns (uint256 unlockedAmount) {
        unlockedAmount = (amount * (block.timestamp - endTime)) / vestingPeriod;
        if (unlockedAmount > amount) {
            unlockedAmount = amount;
        }
    }

    function _refundDustETH(uint256 value) private {
        (bool success, ) = payable(msg.sender).call{ value: value }(new bytes(0));
        require(success, "ETH transfer failed");
    }

    function _purchase(uint256 purchaseAmount) private checkSaleIsNotOver {
        require(purchaseAmount > 0, "amount is too small");
        require(purchaseAmount <= availablePurchaseVolume(), "amount is too large");
        tokenBalanceOf[msg.sender] += purchaseAmount;
        totalPurchased += purchaseAmount;
        totalLocked += purchaseAmount;
    }

    function _pay(uint256 wethAmt, uint256 ethAmt) private {
        if (wethAmt > 0) {
            weth9.safeTransferFrom(msg.sender, address(this), wethAmt);
        }
        if (ethAmt > 0) {
            weth9.deposit{ value: ethAmt }();
        }
    }
}

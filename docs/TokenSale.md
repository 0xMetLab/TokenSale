# TokenSale



> TokenSale contract





## Methods

### BP

```solidity
function BP() external view returns (uint256)
```

Base point unit used for growth calculations




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### GROWTH_COEFFICIENT_BP

```solidity
function GROWTH_COEFFICIENT_BP() external view returns (uint256)
```

Growth coefficient in basis points to calculate token price increase




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### SALE_PERIOD

```solidity
function SALE_PERIOD() external view returns (uint256)
```

The period over which the sale will be open




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### TOTAL_SALES_SUPPLY

```solidity
function TOTAL_SALES_SUPPLY() external view returns (uint256)
```

Total number of tokens available for sale




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### availablePurchaseVolume

```solidity
function availablePurchaseVolume() external view returns (uint256)
```

Calculates the available volume for purchase based on the total sales supply.

*Subtracts `totalPurchased` from `TOTAL_SALES_SUPPLY` to determine remaining supply.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | The quantity of tokens that are still available for purchase. |

### availableWithdrawVolume

```solidity
function availableWithdrawVolume() external view returns (uint256 unsold)
```

Determines the volume of tokens that can be withdrawn by owner after the sale is over.

*Subtracts `totalLocked` from the balance of sale tokens held by the contract. Requires `checkSaleIsOver` modifier to enforce execution only after the sale ends.*


#### Returns

| Name | Type | Description |
|---|---|---|
| unsold | uint256 | Amount of unsold tokens that can be withdrawn. |

### calculatePaymentAmount

```solidity
function calculatePaymentAmount(uint256 purchaseAmount) external view returns (uint256 paymentAmount)
```

Calculates the payment amount required for purchasing a specific amount of tokens.

*The payment amount is determined based on the dynamically changing token rate due to the sales growth formula. It ensures that if the result is not an integer, it will be rounded up to the next whole unit of the payment currency.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| purchaseAmount | uint256 | The desired amount of tokens to purchase. |

#### Returns

| Name | Type | Description |
|---|---|---|
| paymentAmount | uint256 | The corresponding amount of payment currency needed to purchase the `purchaseAmount` of tokens. |

### calculatePurchaseAmount

```solidity
function calculatePurchaseAmount(uint256 paymentAmount) external view returns (uint256 purchaseAmount)
```

Calculates the purchase amount a user receives for a given payment.

*The purchase amount is calculated based on an increase in price relative to the total amount already purchased. This uses a growth formula where the price grows as more tokens are sold, based on a fixed growth coefficient.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| paymentAmount | uint256 | Amount of the payment currency (e.g., ETH) used to purchase tokens. |

#### Returns

| Name | Type | Description |
|---|---|---|
| purchaseAmount | uint256 | The resulting amount of tokens that can be purchased with the specified `paymentAmount`. |

### currentPriceInUSD

```solidity
function currentPriceInUSD() external view returns (uint256 price)
```

Retrieves the current saleToken price in USD.

*Requires that the nativeTokenOracle is set before calling (not equal to the zero address).*


#### Returns

| Name | Type | Description |
|---|---|---|
| price | uint256 | The current price of the asset in USD with 18 decimal places. |

### currentSaleTokenRate

```solidity
function currentSaleTokenRate() external view returns (uint256 saleTokenRate)
```

Calculate the current saleToken rate based on the total purchased amount.

*This function computes the rate considering a growth coefficient which adjusts the rate based on the total sales. The rate grows proportionally to the total tokens purchased so far.*


#### Returns

| Name | Type | Description |
|---|---|---|
| saleTokenRate | uint256 | The current rate of saleToken. |

### endTime

```solidity
function endTime() external view returns (uint256)
```

Timestamp when the token sale ends




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### estimateUnlockedAmount

```solidity
function estimateUnlockedAmount(address user) external view returns (uint256 unlockedAmount)
```

Estimates the amount of unlocked tokens available for a user after the vesting started.

*Calculates the unlocked token amount for a given user based on the internal logic of `_calculateUnlockedAmount`. Requires `checkSaleIsOver` modifier to ensure sale has concluded.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| user | address | The address of the user for whom to calculate the unlocked token amount. |

#### Returns

| Name | Type | Description |
|---|---|---|
| unlockedAmount | uint256 | The calculated amount of tokens that the user can potentially unlock. |

### exit

```solidity
function exit() external nonpayable
```

This function allows the caller to transfer their tokens if they are fully unlocked.

*Transfers the vested tokens for the caller.*


### exitEarly

```solidity
function exitEarly() external nonpayable
```

This function allows the caller to exit early but he will lose the locked tokens and will receive only those that are currently unlocked.

*Transfers the vested tokens for the caller in case of an early exit.*


### initialSaleTokenRate

```solidity
function initialSaleTokenRate() external view returns (uint256)
```

Initial rate of tokens per weth9 at the start of the sale




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### nativeTokenOracle

```solidity
function nativeTokenOracle() external view returns (contract IOracle)
```

The oracle contract implementing the `IOracle` interface for weth9 valuation ( optionally )




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IOracle | undefined |

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### purchaseExactPay

```solidity
function purchaseExactPay(uint256 paymentAmount, uint256 minPurchasedOut) external payable
```

Allows users to purchase tokens with an exact payment amount.

*Executes a token purchase by calculating the output amount and performing checks and internal transfers. Emits a PurchaseExactPay event upon completion.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| paymentAmount | uint256 | The amount of payment provided in tokens. |
| minPurchasedOut | uint256 | The minimum amount of tokens to be purchased, required for the transaction to succeed. |

### purchaseExactPurchased

```solidity
function purchaseExactPurchased(uint256 purchaseAmountOut, uint256 maxPaymentAmount) external payable
```

Allows users to purchase a specified amount of tokens, not exceeding a maximum payment.

*Calculates necessary payment for a fixed purchase amount, validates it against maxPaymentAmount, enacts the purchase, and handles refunds if necessary. Emits a PurchaseExactPurchased event when done.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| purchaseAmountOut | uint256 | The exact amount of tokens the user wants to purchase. |
| maxPaymentAmount | uint256 | The maximum amount of payment the user is willing to provide for this purchase. |

### reduceVestingPeriod

```solidity
function reduceVestingPeriod(uint256 _vestingPeriod) external nonpayable
```

Reduces the vesting period for token sale participants.

*Can only be called by the contract owner. Emits an event upon reducing the vesting period.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _vestingPeriod | uint256 | The new, reduced vesting period in seconds. |

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby disabling any functionality that is only available to the owner.*


### saleIsNotOver

```solidity
function saleIsNotOver() external view returns (bool)
```

Checks if the sale period is still active.

*Returns whether the current block timestamp is less than the `endTime` and there is available purchase volume. Reverts if the sales have not started (i.e., `endTime` is not set).*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | The status of the sale; true if the sale is ongoing, false otherwise. |

### saleToken

```solidity
function saleToken() external view returns (contract IERC20)
```

The token being sold in the sale




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined |

### setNativeTokenOracle

```solidity
function setNativeTokenOracle(address oracle) external nonpayable
```

Sets the oracle address for weth9 valuation.

*Can only be called by the contract owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| oracle | address | The address of the new oracle contract implementing the `IOracle` interface. Requirements: - The caller must be the contract&#39;s owner. - The new oracle must return a non-zero value for `peekSpot(&quot;&quot;)`. |

### startSale

```solidity
function startSale(uint256 _initialSaleTokenRate) external nonpayable
```

Initiates the sale process with a given rate for the sale token.

*Sets the initial rate for the token sale and starts the countdown for the sale. Can only be initiated once. This function also ensures that the initial rate set is valid and that the contract holds enough tokens to cover the sale supply. The `onlyOwner` modifier ensures the function can only be called by the contract owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _initialSaleTokenRate | uint256 | The initial rate at which tokens are sold (number of tokens per payment currency unit). |

### tokenBalanceOf

```solidity
function tokenBalanceOf(address) external view returns (uint256)
```

Mapping of user balances representing the amount of tokens owned by each user



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### totalLocked

```solidity
function totalLocked() external view returns (uint256)
```

Total amount of tokens still locked due to vesting




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### totalPurchased

```solidity
function totalPurchased() external view returns (uint256)
```

Total amount of tokens purchased across all buyers




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### vestingPeriod

```solidity
function vestingPeriod() external view returns (uint256)
```

The vesting period for purchased tokens




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### weth9

```solidity
function weth9() external view returns (contract IWETH)
```

Wrapped native token on current network




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IWETH | undefined |

### withdrawUnsold

```solidity
function withdrawUnsold() external nonpayable
```

Withdraws unsold tokens from the contract.

*Uses safeTransfer to send the unsold tokens to the owner&#39;s address. Can only be called by the owner of the contract. The amount of unsold tokens is determined by the availableWithdrawVolume function.*


### withdrawWrappedNativeToken

```solidity
function withdrawWrappedNativeToken(address to) external nonpayable
```

Withdraws weth9 collected during the sale.

*Uses safeTransfer to send the weth9 balance from the contract to the specified address.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| to | address | The recipient address for withdrawing weth9. |



## Events

### Exit

```solidity
event Exit(address user, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user  | address | undefined |
| amount  | uint256 | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### Purchase

```solidity
event Purchase(address purchaser, uint256 paymentAmount, uint256 purchaseAmount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| purchaser  | address | undefined |
| paymentAmount  | uint256 | undefined |
| purchaseAmount  | uint256 | undefined |

### PurchaseExactPay

```solidity
event PurchaseExactPay(address purchaser, uint256 paymentAmount, uint256 purchaseAmount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| purchaser  | address | undefined |
| paymentAmount  | uint256 | undefined |
| purchaseAmount  | uint256 | undefined |

### PurchaseExactPurchased

```solidity
event PurchaseExactPurchased(address purchaser, uint256 paymentAmount, uint256 purchaseAmount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| purchaser  | address | undefined |
| paymentAmount  | uint256 | undefined |
| purchaseAmount  | uint256 | undefined |

### StartSale

```solidity
event StartSale(uint256 saleTokenRate)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| saleTokenRate  | uint256 | undefined |

### UpNativeTokenOracle

```solidity
event UpNativeTokenOracle(address oracle)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| oracle  | address | undefined |

### UpVestingPeriod

```solidity
event UpVestingPeriod(uint256 period)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| period  | uint256 | undefined |

### WithdrawUnsold

```solidity
event WithdrawUnsold(uint256 unsold)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| unsold  | uint256 | undefined |




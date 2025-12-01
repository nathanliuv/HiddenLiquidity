// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {CUSDC} from "./ERC7984USDC.sol";

interface IUniswapV2Router02 {
    function WETH() external pure returns (address);

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
}

/// @title ETH ↔ cUSDC swap with fixed rate and Uniswap v2 liquidity helper
contract EthCUSDSwap is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant EXCHANGE_RATE = 3100;
    uint256 public constant TOKEN_DECIMALS = 1e6;

    CUSDC public immutable cusdc;
    IERC20 private immutable cusdcToken;
    IUniswapV2Router02 public immutable router;
    address public immutable weth;

    event EthSwapped(address indexed buyer, uint256 ethIn, uint256 cusdcOut);
    event LiquidityAdded(address indexed provider, uint256 cusdcUsed, uint256 ethUsed, uint256 liquidityMinted);

    constructor(address cusdcAddress, address routerAddress) {
        cusdc = CUSDC(cusdcAddress);
        cusdcToken = IERC20(cusdcAddress);
        router = IUniswapV2Router02(routerAddress);
        weth = router.WETH();
    }

    receive() external payable {}

    function previewCusdc(uint256 ethAmount) public pure returns (uint256) {
        return Math.mulDiv(ethAmount, EXCHANGE_RATE * TOKEN_DECIMALS, 1 ether);
    }

    function swapEthForCusdc(address recipient) external payable nonReentrant returns (uint256 mintedAmount, euint64 newBalance) {
        require(msg.value > 0, "No ETH sent");

        mintedAmount = previewCusdc(msg.value);
        require(mintedAmount > 0, "Minted amount is zero");
        require(mintedAmount <= type(uint64).max, "Amount exceeds cipher range");

        address target = recipient == address(0) ? msg.sender : recipient;

        cusdc.mint(target, mintedAmount);
        newBalance = cusdc.confidentialBalanceOf(target);

        emit EthSwapped(target, msg.value, mintedAmount);
    }

    function addLiquidity(
        uint256 cusdcAmount,
        uint256 minCusdc,
        uint256 minEth,
        uint256 deadline,
        address recipient
    ) external payable nonReentrant returns (uint256 amountCusdc, uint256 amountEth, uint256 liquidity) {
        require(cusdcAmount > 0, "No cUSDC provided");
        require(msg.value > 0, "No ETH provided");

        address to = recipient == address(0) ? msg.sender : recipient;
        cusdcToken.safeTransferFrom(msg.sender, address(this), cusdcAmount);

        cusdcToken.forceApprove(address(router), 0);
        cusdcToken.forceApprove(address(router), cusdcAmount);

        uint256 sentEth = msg.value;
        (amountCusdc, amountEth, liquidity) = router.addLiquidityETH{value: sentEth}(
            address(cusdc),
            cusdcAmount,
            minCusdc,
            minEth,
            to,
            deadline
        );

        cusdcToken.forceApprove(address(router), 0);

        if (amountCusdc < cusdcAmount) {
            cusdcToken.safeTransfer(msg.sender, cusdcAmount - amountCusdc);
        }

        if (amountEth < sentEth) {
            (bool success, ) = msg.sender.call{value: sentEth - amountEth}("");
            require(success, "Refund failed");
        }

        emit LiquidityAdded(to, amountCusdc, amountEth, liquidity);
    }
}

// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUniswapV2Router {
    address public immutable WETH;

    uint256 public lastTokenAmount;
    uint256 public lastEthAmount;
    address public lastLiquidityRecipient;
    uint256 public tokenShareBps = 10_000;
    uint256 public ethShareBps = 10_000;

    constructor(address wethAddress) {
        WETH = wethAddress;
    }

    function configureShares(uint256 tokenBps, uint256 ethBps) external {
        require(tokenBps <= 10_000 && ethBps <= 10_000, "invalid bps");
        tokenShareBps = tokenBps;
        ethShareBps = ethBps;
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        require(block.timestamp <= deadline, "deadline expired");
        require(amountTokenDesired >= amountTokenMin, "token slippage");
        require(msg.value >= amountETHMin, "eth slippage");

        amountToken = (amountTokenDesired * tokenShareBps) / 10_000;
        if (amountToken < amountTokenMin) {
            amountToken = amountTokenMin;
        }

        amountETH = (msg.value * ethShareBps) / 10_000;
        if (amountETH < amountETHMin) {
            amountETH = amountETHMin;
        }

        IERC20(token).transferFrom(msg.sender, address(this), amountToken);

        if (msg.value > amountETH) {
            (bool success, ) = msg.sender.call{value: msg.value - amountETH}("");
            require(success, "eth refund failed");
        }

        liquidity = amountToken + amountETH;

        lastTokenAmount = amountToken;
        lastEthAmount = amountETH;
        lastLiquidityRecipient = to;
    }
}

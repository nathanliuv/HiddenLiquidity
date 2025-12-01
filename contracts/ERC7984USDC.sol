// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Confidential cUSDC token with mirrored encrypted balances
/// @notice Standard ERC20 compatibility is preserved for integrations (e.g., Uniswap v2)
/// while encrypted balances are maintained for user-side decryption.
contract CUSDC is ERC20, Ownable, ZamaEthereumConfig {
    mapping(address account => euint64) private _encryptedBalances;
    euint64 private _encryptedSupply;
    address public minter;

    event MinterUpdated(address indexed newMinter);

    constructor(address initialMinter) ERC20("Confidential USDC", "cUSDC") Ownable(msg.sender) {
        _encryptedSupply = FHE.asEuint64(0);
        FHE.allowThis(_encryptedSupply);
        _setMinter(initialMinter);
    }

    modifier onlyMinter() {
        require(msg.sender == minter, "CUSDC: only minter");
        _;
    }

    function setMinter(address newMinter) external onlyOwner {
        _setMinter(newMinter);
    }

    function mint(address to, uint256 amount) external onlyMinter {
        _validateAmount(amount);
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyMinter {
        _validateAmount(amount);
        _burn(from, amount);
    }

    function confidentialBalanceOf(address account) external view returns (euint64) {
        return _encryptedBalances[account];
    }

    function confidentialTotalSupply() external view returns (euint64) {
        return _encryptedSupply;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);

        if (value == 0) {
            return;
        }

        euint64 delta = FHE.asEuint64(_toUint64(value));

        if (from == address(0)) {
            euint64 updatedSupply = FHE.add(_encryptedSupply, delta);
            FHE.allowThis(updatedSupply);
            _encryptedSupply = updatedSupply;
        } else {
            euint64 reduced = FHE.sub(_encryptedBalances[from], delta);
            FHE.allowThis(reduced);
            FHE.allow(reduced, from);
            _encryptedBalances[from] = reduced;
        }

        if (to == address(0)) {
            euint64 decreasedSupply = FHE.sub(_encryptedSupply, delta);
            FHE.allowThis(decreasedSupply);
            _encryptedSupply = decreasedSupply;
        } else {
            euint64 increased = FHE.add(_encryptedBalances[to], delta);
            FHE.allowThis(increased);
            FHE.allow(increased, to);
            _encryptedBalances[to] = increased;
        }
    }

    function _setMinter(address newMinter) internal {
        require(newMinter != address(0), "CUSDC: invalid minter");
        minter = newMinter;
        emit MinterUpdated(newMinter);
    }

    function _validateAmount(uint256 amount) internal pure {
        require(amount > 0, "CUSDC: amount is zero");
        require(amount <= type(uint64).max, "CUSDC: amount too large");
    }

    function _toUint64(uint256 value) internal pure returns (uint64) {
        require(value <= type(uint64).max, "CUSDC: amount exceeds limit");
        return uint64(value);
    }
}

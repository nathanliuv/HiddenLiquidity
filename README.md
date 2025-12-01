# Hidden Liquidity

Confidential ETH → cUSDC swapping with Uniswap v2 liquidity support, built on Zama FHEVM. The system mints an encrypted stablecoin (cUSDC), lets users decrypt balances on demand, and routes pooled liquidity through the Uniswap v2 router.

## Overview
- **cUSDC (contracts/ERC7984USDC.sol)**: ERC20-compatible stable asset that mirrors encrypted balances (euint64) so users can privately decrypt their own holdings while preserving standard DeFi integrations.
- **EthCUSDSwap (contracts/EthCUSDSwap.sol)**: Fixed-rate on-ramp (1 ETH = 3100 cUSDC, 6 decimals) plus a helper to add liquidity through Uniswap v2 with proper approvals, slippage bounds, and refunds.
- **Frontend (src/src)**: React + Vite experience that reads with viem, writes with ethers, connects wallets via RainbowKit/wagmi, and decrypts balances through the Zama relayer SDK—no mocks, no local storage, Sepolia by default.

## Problems This Solves
- On-chain privacy for stablecoin balances via FHE-backed ciphertext handles and user-side decryption.
- Deterministic, trust-minimized pricing for the ETH → cUSDC swap (no oracle dependency for minting).
- Seamless bridge to public liquidity: cUSDC remains ERC20-compatible so liquidity can be provided to Uniswap v2 without breaking confidentiality on balances.
- Developer-ready artifacts: verified ABIs in `deployments/sepolia`, scripted deployments, and typed tests that exercise encrypted balance flows.

## Key Advantages
- FHE-protected balances with opt-in decryption; plaintext supply and balances are never exposed by default.
- ERC20 compatibility keeps integrations simple while still emitting encrypted mirrors for privacy-aware clients.
- Safety-first swap and LP helper: nonReentrant guards, deterministic rate preview, explicit slippage parameters, and ETH/token refunds.
- Frontend uses only on-chain data (no mock values), separates reads (viem) from writes (ethers), and avoids environment variables.
- Targeted at Sepolia with the canonical Uniswap v2 router (`0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`).

## Architecture and Components
### Smart Contracts
- `contracts/ERC7984USDC.sol` (CUSDC): 6-decimal ERC20 with encrypted balance mirrors, minter role, and confidential supply tracking. `confidentialBalanceOf` and `confidentialTotalSupply` expose ciphertexts without using `msg.sender` in view logic.
- `contracts/EthCUSDSwap.sol`: Fixed-rate mint, `previewCusdc` for quotes, `swapEthForCusdc` with recipient override, and `addLiquidity` wrapper around the Uniswap v2 router that handles approvals and refunds. Emits `EthSwapped` and `LiquidityAdded`.
- `contracts/mocks/MockUniswapV2Router.sol`: Test-only router that simulates liquidity splits and refunds.
- `deploy/deploy.ts`: Hardhat deploy script that sets EthCUSDSwap as the CUSDC minter. Uses `process.env.INFURA_API_KEY` and `process.env.PRIVATE_KEY` (no mnemonic) and writes ABIs/artifacts to `deployments/`.

### Frontend (`src/src`)
- `SwapCard`: Calculates cUSDC output with `previewCusdc` and executes `swapEthForCusdc`.
- `BalancePanel`: Reads `balanceOf` and `confidentialBalanceOf`, decrypts ciphertexts through the Zama relayer SDK with a wallet signature, and never stores decrypted results persistently.
- `LiquidityCard`: Handles cUSDC approvals, slippage-aware `addLiquidity` calls, and Etherscan links.
- `Header`: Wallet connect via RainbowKit; surfaces fixed rate and router info.
- Contract config lives in `src/src/config/contracts.ts`; set `CUSDC_ADDRESS` and `SWAP_ADDRESS` to deployed values and keep `CUSDC_ABI`/`SWAP_ABI` copied from `deployments/sepolia/*.json`.

### Documentation
- Zama contract guide: `docs/zama_llm.md`
- Zama relayer/front-end guide: `docs/zama_doc_relayer.md`

## Tech Stack
- **Smart contracts**: Solidity 0.8.27, Hardhat, hardhat-deploy, @fhevm/solidity, OpenZeppelin.
- **Testing**: Hardhat network with FHEVM mock support, Mocha/Chai, TypeChain (ethers v6).
- **Frontend**: React + Vite + TypeScript, RainbowKit/wagmi (wallet), viem (reads), ethers v6 (writes), @tanstack/react-query, Zama relayer SDK. No Tailwind, no frontend env vars.

## Getting Started
### Prerequisites
- Node.js 20+
- npm

### Install dependencies
```bash
npm install
cd src && npm install
```

### Environment (contracts)
Create a `.env` in the repository root:
```
INFURA_API_KEY=<your_infura_key>
PRIVATE_KEY=<deployer_private_key>
ETHERSCAN_API_KEY=<optional_for_verify>
```
Deployments use the private key; do not use a mnemonic. Keep INFURA for Sepolia RPC access.

### Build, lint, and test
- `npm run compile`
- `npm run test`
- `npm run lint`
- `npm run coverage`

### Local development
- Start a local Hardhat node (FHEVM mock): `npm run chain`
- Deploy to the local node: `npm run deploy:localhost`
- Inspect addresses: `npx hardhat task:addresses --network localhost`
- Quote output: `npx hardhat task:quote --network localhost --eth 1000000000000000000`

### Sepolia deployment
- Deploy: `npm run deploy:sepolia`
- Verify (optional): `npm run verify:sepolia -- <contract_address>`
- After deployment, copy addresses from `deployments/sepolia/CUSDC.json` and `deployments/sepolia/EthCUSDSwap.json` into `src/src/config/contracts.ts`, and paste the generated ABI arrays there. Always source frontend ABIs from `deployments/sepolia`, not hand-written copies.

### Frontend usage
- Update `CUSDC_ADDRESS` and `SWAP_ADDRESS` in `src/src/config/contracts.ts` with the Sepolia addresses from `deployments/sepolia`.
- Ensure `CUSDC_ABI` and `SWAP_ABI` match the latest deployment artifacts.
- Run the app: `cd src && npm run dev` (connect a wallet on Sepolia). The UI reads on-chain data only and uses ethers for writes, viem for reads, and the Zama relayer for decryption.

## Current Contract Parameters
- Fixed rate: **1 ETH = 3100 cUSDC** (6 decimals).
- Quote helper: `previewCusdc(uint256 ethAmount)`.
- Swap: `swapEthForCusdc(address recipient)`; mints to `recipient` or sender when zero address is provided.
- Liquidity: `addLiquidity(uint256 cusdcAmount, uint256 minCusdc, uint256 minEth, uint256 deadline, address recipient)` routes to Uniswap v2 router `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D` and refunds unused ETH/cUSDC.
- Events: `EthSwapped`, `LiquidityAdded`.

## Testing Notes
- `test/CUSDC.ts` verifies swap minting, encrypted balance decryption, and liquidity refund paths against the mock router.
- Tests skip when FHEVM mock support is unavailable; run against Hardhat’s default mocked environment for fastest feedback.

## Future Roadmap
- Dynamic exchange rates via oracle-backed pricing and rate governance.
- Liquidity management features (remove liquidity, fee tracking, LP analytics) surfaced in the UI.
- Additional encrypted assets and pool routes beyond ETH/cUSDC.
- Gas optimizations and expanded test coverage on mainnet forks.
- Optional audit/verification flow baked into CI once addresses stabilize.

## License
BSD-3-Clause-Clear. See `LICENSE` for details.

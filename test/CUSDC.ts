import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { CUSDC, EthCUSDSwap, MockUniswapV2Router } from "../types";

describe("EthCUSDSwap", function () {
  let deployer: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let cusdc: CUSDC;
  let swap: EthCUSDSwap;
  let router: MockUniswapV2Router;

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    [deployer, user] = await ethers.getSigners();

    const CusdcFactory = await ethers.getContractFactory("CUSDC");
    cusdc = (await CusdcFactory.deploy(deployer.address)) as CUSDC;

    const RouterFactory = await ethers.getContractFactory("MockUniswapV2Router");
    router = (await RouterFactory.deploy("0x0000000000000000000000000000000000000001")) as MockUniswapV2Router;

    const SwapFactory = await ethers.getContractFactory("EthCUSDSwap");
    swap = (await SwapFactory.deploy(await cusdc.getAddress(), await router.getAddress())) as EthCUSDSwap;

    await cusdc.connect(deployer).setMinter(await swap.getAddress());
  });

  it("mints cUSDC for ETH and returns a decryptable balance", async function () {
    const ethIn = ethers.parseEther("1");
    const preview = await swap.previewCusdc(ethIn);

    await expect(swap.connect(user).swapEthForCusdc(user.address, { value: ethIn }))
      .to.emit(swap, "EthSwapped")
      .withArgs(user.address, ethIn, preview);

    const balance = await cusdc.balanceOf(user.address);
    expect(balance).to.equal(preview);

    const encryptedBalance = await cusdc.confidentialBalanceOf(user.address);
    const clear = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      await cusdc.getAddress(),
      user,
    );
    expect(clear).to.equal(preview);
  });

  it("adds liquidity through the router helper and refunds unused assets", async function () {
    const ethIn = ethers.parseEther("2");
    await swap.connect(user).swapEthForCusdc(user.address, { value: ethIn });

    const totalCusdc = await cusdc.balanceOf(user.address);
    const cusdcForLiquidity = totalCusdc / 2n;
    const ethForLiquidity = ethers.parseEther("0.5");
    const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

    await cusdc.connect(user).approve(await swap.getAddress(), cusdcForLiquidity * 2n);
    await router.configureShares(7000, 5000);

    const initialCusdc = await cusdc.balanceOf(user.address);

    const tx = await swap
      .connect(user)
      .addLiquidity(
        cusdcForLiquidity,
        cusdcForLiquidity / 2n,
        ethForLiquidity / 2n,
        deadline,
        user.address,
        { value: ethForLiquidity },
      );
    await tx.wait();

    const expectedTokenUsed = (cusdcForLiquidity * 7000n) / 10_000n;
    const expectedEthUsed = ethForLiquidity / 2n;

    const routerCusdc = await cusdc.balanceOf(await router.getAddress());
    expect(routerCusdc).to.equal(expectedTokenUsed);

    const routerEth = await ethers.provider.getBalance(await router.getAddress());
    expect(routerEth).to.equal(expectedEthUsed);

    const swapTokenBalance = await cusdc.balanceOf(await swap.getAddress());
    const swapEthBalance = await ethers.provider.getBalance(await swap.getAddress());
    expect(swapTokenBalance).to.equal(0);
    expect(swapEthBalance).to.equal(ethIn);

    const finalCusdc = await cusdc.balanceOf(user.address);
    expect(initialCusdc - finalCusdc).to.equal(expectedTokenUsed);
  });
});

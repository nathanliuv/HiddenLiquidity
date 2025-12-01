import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, execute, log } = hre.deployments;

  const cusdc = await deploy("CUSDC", {
    from: deployer,
    args: [deployer],
    log: true,
  });

  log(`cUSDC token deployed to ${cusdc.address}`);

  const swap = await deploy("EthCUSDSwap", {
    from: deployer,
    args: [cusdc.address, UNISWAP_V2_ROUTER],
    log: true,
  });

  log(`Swap contract deployed to ${swap.address}`);

  await execute("CUSDC", { from: deployer, log: true }, "setMinter", swap.address);
  log(`Set EthCUSDSwap as minter for cUSDC`);
};

export default func;
func.id = "deploy_cusdc_swap";
func.tags = ["CUSDC", "EthCUSDSwap"];

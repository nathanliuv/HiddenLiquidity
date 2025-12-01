import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:addresses", "Prints the deployed contract addresses").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const cusdc = await deployments.get("CUSDC");
  const swap = await deployments.get("EthCUSDSwap");

  console.log(`CUSDC:        ${cusdc.address}`);
  console.log(`EthCUSDSwap:  ${swap.address}`);
});

task("task:quote", "Previews cUSDC output for an ETH amount (wei)")
  .addParam("eth", "ETH amount in wei")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const swap = await deployments.get("EthCUSDSwap");
    const contract = await ethers.getContractAt("EthCUSDSwap", swap.address);

    const ethAmount = BigInt(taskArguments.eth);
    const quote = await contract.previewCusdc(ethAmount);

    console.log(`ETH:   ${ethAmount.toString()} wei`);
    console.log(`cUSDC: ${quote.toString()} (6 decimals)`);
  });

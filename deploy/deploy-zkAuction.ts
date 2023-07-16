import { HardhatRuntimeEnvironment } from "hardhat/types";
import deployAuctionPaymaster from "./deploy-paymaster";
import deployAuctionFactory from "./deploy-auctionfactory";
import { addFunds } from "./add-funds-localnet";

export default async function deployskAuctionContracts(hre: HardhatRuntimeEnvironment) {
  const nodeEnv = process.env.NODE_ENV || "NONE"
  logDeploy(`NODE_ENV: ${nodeEnv}`)
  // deploy paymaster
  logDeploy(`deploy paymaster`)
  const {paymaster, usdc, dai }= await deployAuctionPaymaster(hre)

  logDeploy("deploy auction factory")
  await deployAuctionFactory(hre, paymaster, usdc, dai)

  await addFunds(hre, paymaster, usdc, dai);


  logDeploy(`Done!`);
}

// helpers
function logDeploy(log: string) {
  console.log(`[DEPLOY zkAuction contracts] ${log}`)
}
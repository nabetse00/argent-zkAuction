import { Wallet } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

// load env file
import dotenv from "dotenv";
dotenv.config();

// load wallet private key from env file
const RICH_WALLET_PRIVATE_KEY = process.env.RICH_WALLET_PRIVATE_KEY || "";

export default async function deployMocks(hre: HardhatRuntimeEnvironment): Promise<{ usdcAddr: string; daiAddr: string; ethUsdAddr: string; usdcUsdAddr: string; daiUsdAddr: string; }> {
  const nodeEnv = process.env.NODE_ENV || "NONE"
  logDeploy(`NODE_ENV: ${nodeEnv}`)
  let wallet: Wallet;
  if (process.env.NODE_ENV != "test") {
    logDeploy(`On era testnet no mock USDC/DAI should be deployed`);
    throw "zkSunc era tesnet do not need mock USDC/DAI"
  } else {
    wallet = new Wallet(RICH_WALLET_PRIVATE_KEY);
    logDeploy(`On local testnet we use a rich wallet to delpoy: ${wallet.address}`);
  }
  const deployer = new Deployer(hre, wallet);
  logDeploy(`Deployer zkWallet: ${deployer.zkWallet.address}`)
  logDeploy(`Deployer ethWallet: ${deployer.ethWallet.address}`)

  const erc20MockArtifact = await deployer.loadArtifact("MyERC20");
  const usdc = await deployer.deploy(erc20MockArtifact, ["USDC Mock", "USDC", 6]);
  const dai = await deployer.deploy(erc20MockArtifact, ["DAI Mock", "DAI", 18]);
  logDeploy(`Stable coins mocks addresses: \n USDC: ${usdc.address} \n DAI ${dai.address}`)

  // mock proxis
  const proxyArtifact = await deployer.loadArtifact("MyProxy");
  const ethUsd = await deployer.deploy(proxyArtifact, [ethers.utils.parseEther("2000"), ethers.constants.AddressZero]);
  const usdcUsd = await deployer.deploy(proxyArtifact, [ethers.utils.parseEther("1.0001"), ethers.constants.AddressZero]);
  const daiUsd = await deployer.deploy(proxyArtifact, [ethers.utils.parseEther("0.9998"), ethers.constants.AddressZero]);

  logDeploy(`Proxys: [${ethUsd.address}, ${usdcUsd.address}, ${daiUsd.address} ]`)
  logDeploy(`Contract not verified, deployed locally.`);
  logDeploy(`Done!`);
  return { usdcAddr: usdc.address, daiAddr: dai.address, ethUsdAddr: ethUsd.address, usdcUsdAddr: usdcUsd.address, daiUsdAddr: daiUsd.address }
}

// helpers
function logDeploy(log: string) {
  console.log(`[DEPLOY Mock contracts] ${log}`)
}

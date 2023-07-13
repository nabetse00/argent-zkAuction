import { Wallet } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

// load env file
import dotenv from "dotenv";
import deployMocks from "./deploy-mocks";
import { Address } from "zksync-web3/build/src/types";
dotenv.config();

// load wallet private key from env file
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || "";
const RICH_WALLET_PRIVATE_KEY = process.env.RICH_WALLET_PRIVATE_KEY || "";

export default async function deployAuctionPaymaster(hre: HardhatRuntimeEnvironment): Promise<{ paymaster: string; usdc: string; dai: string; }>{
  const nodeEnv = process.env.NODE_ENV || "NONE"
  logDeploy(`NODE_ENV: ${nodeEnv}`)
  let wallet: Wallet;
  let usdcAddr = ""
  let daiAddr = ""
  let ETHUSDdAPI = ""
  let USDCUSDdAPI = ""
  let DAIUSDdAPI = ""
  if (process.env.NODE_ENV != "test") {
    wallet = new Wallet(WALLET_PRIVATE_KEY);
    logDeploy(`On era testnet we a founded wallet to delpoy: ${wallet.address}`);
    usdcAddr = process.env.USDC || ""
    daiAddr = process.env.DAI || ""
    logDeploy(`Stable coins zkSync era Tesnet addresses: \n USDC: ${usdcAddr} \n DAI ${daiAddr}`)
    // Setting the dAPIs in Paymaster. Head over to the API3 Market (https://market.api3.org) to verify dAPI 
    // proxy contract addresses and whether they're funded or not.
    ETHUSDdAPI = process.env.ETHUSDdAPI || "";
    USDCUSDdAPI = process.env.USDCUSDdAPI || "";
    DAIUSDdAPI = process.env.DAIUSDdAPI || "";
    logDeploy(`zkSync era Tesnet poxies: \n [ ${ETHUSDdAPI}, ${USDCUSDdAPI}, ${DAIUSDdAPI} ]`)
  } else {
    wallet = new Wallet(RICH_WALLET_PRIVATE_KEY);
    logDeploy(`On local testnet we use a rich wallet to delpoy: ${wallet.address}`);
    const  mocks = await deployMocks(hre);
    usdcAddr = mocks.usdcAddr;
    daiAddr = mocks.daiAddr;
    ETHUSDdAPI = mocks.ethUsdAddr;
    USDCUSDdAPI = mocks.usdcUsdAddr;
    DAIUSDdAPI = mocks.daiUsdAddr;

  }
  const deployer = new Deployer(hre, wallet);
  logDeploy(`Deployer zkWallet: ${deployer.zkWallet.address}`)
  logDeploy(`Deployer ethWallet: ${deployer.ethWallet.address}`)

  // Deploying the paymaster
  const paymasterArtifact = await deployer.loadArtifact("AuctionPaymaster");
  const paymaster = await deployer.deploy(paymasterArtifact, [wallet.address, usdcAddr, daiAddr, wallet.address]);
  logDeploy(`paymaster contract address: ${paymaster.address}`);
  logDeploy(`owner is: ${wallet.address}`);

  // Supplying paymaster with ETH.
  const fundTx = await deployer.zkWallet.sendTransaction({
    to: paymaster.address,
    value: ethers.utils.parseEther("0.05"),
  })

  await fundTx.wait();


  const setProxytx = await paymaster.setDapiProxy(USDCUSDdAPI, DAIUSDdAPI, ETHUSDdAPI)
  await setProxytx.wait();
  logDeploy("dAPI Proxies set")

  // verify contract for tesnet & mainnet
  if (process.env.NODE_ENV != "test") {
    // Contract MUST be fully qualified name (e.g. path/sourceName:contractName)
    const contractFullyQualifedName =
      "contracts/AuctionPaymaster.sol:AuctionPaymaster";
    const verificationId = await hre.run("verify:verify", {
      address: paymaster.address,
      contract: contractFullyQualifedName,
      constructorArguments: [wallet.address, usdcAddr, daiAddr, wallet.address],
      bytecode: paymasterArtifact.bytecode,
    });
    logDeploy(
      `${contractFullyQualifedName} verified! VerificationId: ${verificationId}`,
    );
  } else {
    logDeploy(`Contract not verified, deployed locally.`);
  }
  logDeploy(`Done!`);
  return { paymaster: paymaster.address, usdc: usdcAddr, dai: daiAddr}
}

// helpers
function logDeploy(log: string) {
  console.log(`[DEPLOY Paymaster] ${log}`)
}

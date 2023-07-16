import { Contract, Provider, Wallet } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

// load env file
import dotenv from "dotenv";
import * as PaymasterArtifact from "../artifacts-zk/contracts/AuctionPaymaster.sol/AuctionPaymaster.json";
import * as AuctionFactoryArtifact from "../artifacts-zk/contracts/AuctionFactory.sol/AuctionFactory.json";
import * as ERC20Artifact from "../artifacts-zk/contracts/mocks/ERC20.sol/MyERC20.json";
import { Address } from "zksync-web3/build/src/types";
dotenv.config();

// load wallet private key from env file
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || "";
const RICH_WALLET_PRIVATE_KEY = process.env.RICH_WALLET_PRIVATE_KEY || "";



export default async function deployPostApproval(hre: HardhatRuntimeEnvironment) {

  const paymaster = "0x176166463bf8def8bb0d2F1311c7EfEDdC823e21"
  const usdc = "0x0faF6df7054946141266420b43783387A78d82A9"
  const dai = "0x3e7676937A7E96CFB7616f255b9AD9FF47363D4b"
  const auctionFactory = "0xC006e415498A3D65Df9BF9a7F5F5d06187DC7F1E"
  // @ts-ignore
  const provider = new Provider(hre.userConfig.networks?.zkSyncTestnet?.url);
  let richWallet: Wallet;
  let userWallet: Wallet;

  richWallet = new Wallet(WALLET_PRIVATE_KEY, provider);
  userWallet = new Wallet(WALLET_PRIVATE_KEY, provider);
  logDeploy(`On era testnet we a founded wallet to delpoy: ${richWallet.address}`);

  const deployer = new Deployer(hre, richWallet);
  logDeploy(`Deployer zkWallet: ${deployer.zkWallet.address}`)
  logDeploy(`Deployer ethWallet: ${deployer.ethWallet.address}`)

  // Deploying the Auction factory


  // add auctionFactory to paymaster allowed contracts
  const usdcCtr = new Contract(usdc, ERC20Artifact.abi, userWallet)
  const daiCtr = new Contract(dai, ERC20Artifact.abi, userWallet)
  const paymasterCtr = new Contract(paymaster, PaymasterArtifact.abi, userWallet)


  const txUsdc = await paymasterCtr.connect(richWallet).addToAllowedContracts(usdc)
  await txUsdc.wait()

  const txDai = await paymasterCtr.connect(richWallet).addToAllowedContracts(dai)
  await txDai.wait()

  const txAuctFacto = await paymasterCtr.connect(richWallet).addToAllowedContracts(auctionFactory)
  await txAuctFacto.wait()

  const txAppUsdc = await usdcCtr.connect(richWallet).approve(auctionFactory, ethers.utils.parseUnits("0.5", 6) )
  await txAppUsdc.wait()

  const txAppDai = await usdcCtr.connect(richWallet).approve(auctionFactory, ethers.utils.parseUnits("0.5", 18) )
  await txAppDai.wait()
 
}

// helpers
function logDeploy(log: string) {
  console.log(`[POST deploy] ${log}`)
}
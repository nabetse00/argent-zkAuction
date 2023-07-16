import { Contract, Provider, Wallet } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

// load env file
import dotenv from "dotenv";
import deployMocks from "./deploy-mocks";
import * as PaymasterArtifact from "../artifacts-zk/contracts/AuctionPaymaster.sol/AuctionPaymaster.json";
import { Address } from "zksync-web3/build/src/types";
dotenv.config();

// load wallet private key from env file
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || "";
const RICH_WALLET_PRIVATE_KEY = process.env.RICH_WALLET_PRIVATE_KEY || "";

export default async function deployAuctionFactory(hre: HardhatRuntimeEnvironment, paymaster: Address, usdc: Address, dai: Address) {
  const nodeEnv = process.env.NODE_ENV || "NONE"
  logDeploy(`NODE_ENV: ${nodeEnv}`)
  let richWallet: Wallet;
  let userWallet: Wallet;
  if (process.env.NODE_ENV != "test") {
    // @ts-ignore
    const provider = new Provider(hre.userConfig.networks?.zkSyncTestnet?.url);
    richWallet = new Wallet(WALLET_PRIVATE_KEY, provider);
    userWallet = new Wallet(WALLET_PRIVATE_KEY, provider);
    logDeploy(`On era testnet we a founded wallet to delpoy: ${richWallet.address}`);
  } else {
    richWallet = new Wallet(RICH_WALLET_PRIVATE_KEY);
    userWallet= new Wallet(WALLET_PRIVATE_KEY);
    logDeploy(`On local testnet we use a rich wallet to delpoy: ${richWallet.address}`);
    logDeploy(`Local testnet we user wallet to delpoy: ${userWallet.address}`);
  }
  const deployer = new Deployer(hre, richWallet);
  logDeploy(`Deployer zkWallet: ${deployer.zkWallet.address}`)
  logDeploy(`Deployer ethWallet: ${deployer.ethWallet.address}`)

  // Deploying the Auction factory
  const auctionFactoryArtifact = await deployer.loadArtifact("AuctionFactory");
  const auctionFactory = await deployer.deploy(auctionFactoryArtifact, [ usdc, dai, paymaster, userWallet.address]);
  logDeploy(`Auction Factory contract address: ${auctionFactory.address}`);

  // add auctionFactory to paymaster allowed contracts
  const paymasterCtr = new Contract(paymaster, PaymasterArtifact.abi, richWallet )
  const txPaymaster = await paymasterCtr.connect(richWallet).addToAllowedContracts(auctionFactory.address)
  await txPaymaster.wait()





  // verify contract for tesnet & mainnet
  if (process.env.NODE_ENV != "test") {
    // Contract MUST be fully qualified name (e.g. path/sourceName:contractName)
    const contractFullyQualifedName =
      "contracts/AuctionFactory.sol:AuctionFactory";
    const verificationId = await hre.run("verify:verify", {
      address: auctionFactory.address,
      contract: contractFullyQualifedName,
      constructorArguments:  [ usdc, dai, paymaster, userWallet.address ],
      bytecode: auctionFactoryArtifact.bytecode,
    });
    logDeploy(
      `${contractFullyQualifedName} verified! VerificationId: ${verificationId}`,
    );
  } else {
    logDeploy(`Contract not verified, deployed locally.`);
  }
  logDeploy(`Done!`);
}

// helpers
function logDeploy(log: string) {
  console.log(`[DEPLOY Auction Factory] ${log}`)
}
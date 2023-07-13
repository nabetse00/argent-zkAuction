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

export default async function deployAuctionFactory(hre: HardhatRuntimeEnvironment, paymaster: Address, usdc: Address, dai: Address) {
  const nodeEnv = process.env.NODE_ENV || "NONE"
  logDeploy(`NODE_ENV: ${nodeEnv}`)
  let wallet: Wallet;
  if (process.env.NODE_ENV != "test") {
    wallet = new Wallet(WALLET_PRIVATE_KEY);
    logDeploy(`On era testnet we a founded wallet to delpoy: ${wallet.address}`);
  } else {
    wallet = new Wallet(RICH_WALLET_PRIVATE_KEY);
    logDeploy(`On local testnet we use a rich wallet to delpoy: ${wallet.address}`);
  }
  const deployer = new Deployer(hre, wallet);
  logDeploy(`Deployer zkWallet: ${deployer.zkWallet.address}`)
  logDeploy(`Deployer ethWallet: ${deployer.ethWallet.address}`)

  // Deploying the paymaster
  const auctionFactoryArtifact = await deployer.loadArtifact("AuctionFactory");
  const auctionFactory = await deployer.deploy(auctionFactoryArtifact, [ usdc, dai, paymaster]);
  logDeploy(`Auction Factory contract address: ${auctionFactory.address}`);


  // verify contract for tesnet & mainnet
  if (process.env.NODE_ENV != "test") {
    // Contract MUST be fully qualified name (e.g. path/sourceName:contractName)
    const contractFullyQualifedName =
      "contracts/AuctionFactory.sol:AuctionFactory";
    const verificationId = await hre.run("verify:verify", {
      address: auctionFactory.address,
      contract: contractFullyQualifedName,
      constructorArguments:  [ usdc, dai, paymaster ],
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
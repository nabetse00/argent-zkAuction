import { Wallet } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

require('dotenv').config();
// load wallet private key from env file
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || "";
const RICH_WALLET_PRIVATE_KEY = process.env.RICH_WALLET_PRIVATE_KEY || "";
const AUCTION_CONTRACT_ADDR = process.env.AUCTION_CONTRACT_ADDR || "";
const COOL_DOWN_DURATION = 100;

export default async function deployAuctionPaymaster(hre: HardhatRuntimeEnvironment) {

  if(AUCTION_CONTRACT_ADDR == "" ){
    throw "AUCTION contract address should be set check .env file before deploying paymaster"
  }
  
  let wallet: Wallet;
  if (process.env.NODE_ENV != "test") {
  wallet = new Wallet(WALLET_PRIVATE_KEY);
  console.log(`On era testnet we a founded wallet to delpoy: ${wallet.address}`);
  }else{
    wallet = new Wallet(RICH_WALLET_PRIVATE_KEY);
    console.log(`On local testnet we use a rich wallet to delpoy: ${wallet.address}`);
  }
  const deployer = new Deployer(hre, wallet);

  const usdcAddr = "0x0faF6df7054946141266420b43783387A78d82A9"
  const daiAddr = "0x3e7676937A7E96CFB7616f255b9AD9FF47363D4b"

  // Deploying the paymaster
  const paymasterArtifact = await deployer.loadArtifact("AuctionPaymaster");
  const paymaster = await deployer.deploy(paymasterArtifact, [wallet.address, usdcAddr, daiAddr, AUCTION_CONTRACT_ADDR, COOL_DOWN_DURATION]);
  console.log(`Paymaster address: ${paymaster.address}`);

  // Supplying paymaster with ETH.
  await (
    await deployer.zkWallet.sendTransaction({
      to: paymaster.address,
      value: ethers.utils.parseEther("0.05"),
    })
  ).wait();

  // Setting the dAPIs in Paymaster. Head over to the API3 Market (https://market.api3.org) to verify dAPI 
  // proxy contract addresses and whether they're funded or not.
  const ETHUSDdAPI = "0x28ce555ee7a3daCdC305951974FcbA59F5BdF09b";
  const USDCUSDdAPI = "0x946E3232Cc18E812895A8e83CaE3d0caA241C2AB";
  const DAIUSDdAPI = "0xd038B4d9325aa2beB4E6f3E82B9165634Dc4C35E"
  const setProxy = paymaster.setDapiProxy(USDCUSDdAPI, DAIUSDdAPI, ETHUSDdAPI)
  await (await setProxy).wait()
  console.log("dAPI Proxies Set!")

  // verify contract for tesnet & mainnet
  if (process.env.NODE_ENV != "test") {
    // Contract MUST be fully qualified name (e.g. path/sourceName:contractName)
    const contractFullyQualifedName =
      "contracts/AuctionPaymaster.sol:AuctionPaymaster";
    const verificationId = await hre.run("verify:verify", {
      address: paymaster.address,
      contract: contractFullyQualifedName,
      constructorArguments: [],
      bytecode: paymasterArtifact.bytecode,
    });
    console.log(
      `${contractFullyQualifedName} verified! VerificationId: ${verificationId}`,
    );
  } else {
    console.log(`Contract not verified, deployed locally.`);
  }

  console.log(`Done!`);
}

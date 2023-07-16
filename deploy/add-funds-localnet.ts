import { Contract, Wallet } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Provider } from "zksync-web3";
import * as Erc20Artifact from "../artifacts-zk/contracts/mocks/ERC20.sol/MyERC20.json";
import * as PaymasterArtifact from "../artifacts-zk/contracts/AuctionPaymaster.sol/AuctionPaymaster.json";

// load env file
import dotenv from "dotenv";
import { Address } from "zksync-web3/build/src/types";
dotenv.config();

// load wallet private key from env file
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || "";
const RICH_WALLET_PRIVATE_KEY = process.env.RICH_WALLET_PRIVATE_KEY || "";


export default async function run(hre: HardhatRuntimeEnvironment) {

    const paymaster = process.env.PAYMASTER_LOCAL || ""
    const usdc = process.env.USDC_LOCAL || ""
    const dai = process.env.DAI_LOCAL || ""
    const auctionFactory = process.env.AUCTION_FACTORY_LOCAL || ""
    await addFunds(hre, paymaster, usdc, dai);
    await approve(hre, usdc, auctionFactory, paymaster)
    await approve(hre, usdc, usdc, paymaster)
    await approve(hre, usdc, dai, paymaster)
}
export async function addFunds(hre: HardhatRuntimeEnvironment, paymaster: Address, usdc: Address, dai: Address) {

    const nodeEnv = process.env.NODE_ENV || "NONE"
    logAddFounds(`NODE_ENV: ${nodeEnv}`)
    if (nodeEnv == "test") {
        // @ts-ignore
        const provider = new Provider(hre.userConfig.networks?.zkSyncTestnet?.url);
        const wallet = new Wallet(RICH_WALLET_PRIVATE_KEY, provider);
        const local_wallet = new Wallet(WALLET_PRIVATE_KEY, provider);

        logAddFounds(`Rich wallet is: ${wallet.address}`);
        logAddFounds(`Local wallet is: ${local_wallet.address}`);
        // transfer
        const oldLocalBal = await provider.getBalance(local_wallet.address)
        const oldPaymasterBal = await provider.getBalance(paymaster)
        const tx1 = await wallet.transfer({ to: local_wallet.address, amount: ethers.utils.parseEther("1") });
        await tx1.wait();
        const tx2 = await wallet.transfer({ to: paymaster, amount: ethers.utils.parseEther("1") });
        await tx2.wait();
        const newLocalBal = await provider.getBalance(local_wallet.address)
        const newPaymasterBal = await provider.getBalance(paymaster)
        const diff1 = ethers.utils.formatEther(newLocalBal.sub(oldLocalBal))
        const diff2 = ethers.utils.formatEther(newPaymasterBal.sub(oldPaymasterBal))
        logAddFounds(`Local wallet diff balance is : ${diff1}`);
        logAddFounds(`Paymaster wallet diff balance is : ${diff2}`);
        logAddFounds(`${usdc} ${local_wallet.address}`)
        await mint(usdc, local_wallet.address, wallet)
        logAddFounds(`${dai} ${local_wallet.address}`)
        await mint(dai, local_wallet.address, wallet)
        await mint(usdc, wallet.address, wallet)
        await mint(dai, wallet.address, wallet)
        logAddFounds("DONE")
    } else {
        logAddFounds("Just approve auctionFactory ")
    }
}

async function mint(token: string, to: Address, rich: Wallet) {
    // Initialise contract instance
    const contract = new Contract(token, Erc20Artifact.abi, rich);
    const decimals = await contract.decimals();
    const symbol = await contract.connect(rich).symbol();
    const amount = "100"
    const tx = await contract.mint(to, ethers.utils.parseUnits(amount, decimals))
    await tx.wait();
}

async function approve(hre, token: string, to: Address, paymaster: Address) {
    const provider = new Provider(hre.userConfig.networks?.zkSyncTestnet?.url);
    const rich = new Wallet(RICH_WALLET_PRIVATE_KEY, provider);
    // Initialise contract instance
    logAddFounds(`Approve ${token} ${to} from ${rich.address}`)
    const contract = new Contract(token, Erc20Artifact.abi, rich);
    const decimals = await contract.decimals();
    const symbol = await contract.connect(rich).symbol();
    const amount = "100"
    const tx = await contract.connect(rich).approve(to, ethers.utils.parseUnits(amount, decimals))
    await tx.wait();
    logAddFounds(`Appove ${to} ${symbol} ${amount} from ${rich.address}`)
          // add auctionFactory to paymaster allowed contracts
    const paymasterCtr = new Contract(paymaster, PaymasterArtifact.abi, rich )
    const txPaymaster = await paymasterCtr.connect(rich).addToAllowedContracts(to)
    await txPaymaster.wait()
}

function logAddFounds(log: string) {
    console.log(`[Add Founds] ${log}`)
}


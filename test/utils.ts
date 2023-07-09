import { Contract, Provider, Wallet, utils } from "zksync-web3";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as ethers from "ethers";
import CoinMarketCap from "coinmarketcap-api";
import { BigNumber } from "ethers";

// load env file
import dotenv from "dotenv";
dotenv.config();

// load wallet private key from env file
export const PRIVATE_KEY = process.env.RICH_WALLET_PRIVATE_KEY || "";
export const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";
const coinMarketCapclient = new CoinMarketCap(COINMARKETCAP_API_KEY)
export const COOL_DOWN_DURATION = 10; // 10 sec

export async function deployContract(
    deployer: Deployer,
    contract: string,
    params: any[],
): Promise<Contract> {
    const artifact = await deployer.loadArtifact(contract);

    const deploymentFee = await deployer.estimateDeployFee(artifact, params);
    const parsedFee = ethers.utils.formatEther(deploymentFee.toString());
    const parsedFeeUSD = await etherToUSD(deploymentFee);
    console.log(`${contract} deployment is estimated to cost ${parsedFee} ETH [ ~ $${parsedFeeUSD} ]`);
    const dep = await deployer.deploy(artifact, params);
    return await dep.deployed();
}

export async function fundAccount(wallet: Wallet, address: string, amount: string) {
    // fund account
    await (
        await wallet.sendTransaction({
            to: address,
            value: ethers.utils.parseEther(amount),
        })
    ).wait();

    console.log(`Account ${address} funded with ${amount}`);
}

export async function estimateGreeterGas(provider: Provider, richWallet: Wallet, my_greeter: Contract,
    paymaster: Contract, token: Contract, ethUsd: Contract, tokenUsd: Contract): Promise<ethers.ethers.BigNumber[]> {
    const gasPrice = await provider.getGasPrice();
    // Estimate gas fee for the transaction
    // console.log("gaslimit")
    const gasLimit = await my_greeter.connect(richWallet).estimateGas.setGreeting(
        "new updated greeting",
        {
            customData: {
                // TODO make an estimation of gasPerPubData
                gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                paymasterParams: utils.getPaymasterParams(paymaster.address, {
                    type: "ApprovalBased",
                    token: token.address,
                    // Set a large allowance just for estimation
                    minimalAllowance: ethers.utils.parseEther("1000"),
                    innerInput: new Uint8Array(),
                }),
            },
        }
    );
    // console.log("gaslimit done")
    // Gas estimation:
    const fee = gasPrice.mul(gasLimit.toString());

    // Calling the dAPI to get the ETH price:
    const ETHUSD = await paymaster.readDapi(
        ethUsd.address
    );
    const TOKENUSD = await paymaster.readDapi(
        tokenUsd.address
    );

    // Calculating the amount of token as fees:
    const tokenFee = fee.mul(ETHUSD).div(TOKENUSD);
    return [tokenFee, gasLimit];
}

export async function waitForCoolDown() {
    console.log(`wait ${COOL_DOWN_DURATION} secs`)
    await sleep(COOL_DOWN_DURATION * 1000);
    console.log("done")
}

export async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

export async function etherToUSD(amount: BigNumber): Promise<string> {
    const getQuote = await coinMarketCapclient.getQuotes({ symbol: 'ETH' });
    const quote = getQuote.data["ETH"].quote['USD'].price;
    return (parseFloat(ethers.utils.formatEther(amount)) * parseFloat(quote)).toFixed(4);
}
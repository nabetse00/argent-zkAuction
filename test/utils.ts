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
export const FLAT_FEE_USDC = ethers.utils.parseUnits("0.5", 6);
export const FLAT_FEE_DAI = ethers.utils.parseUnits("0.5", 18);

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
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const decimalsBN = ethers.utils.parseUnits("1", decimals.toString())
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
    const parsedFeeUSD = await etherToUSD(fee);
    // Calling the dAPI to get the ETH price:
    const ETHUSD = await paymaster.readDapi(
        ethUsd.address
    );
    const TOKENUSD = await paymaster.readDapi(
        tokenUsd.address
    );

    // Calculating the amount of token as fees:
    const tokenFee = fee.mul(ETHUSD).div(TOKENUSD).mul(decimalsBN).div(ethers.utils.parseUnits("1", 18));
    await logEstimation("setGreeter", tokenFee, ETHUSD, decimals, symbol, TOKENUSD, fee);
    return [tokenFee, gasLimit];
}

export async function estimateFeeApprovalGas(provider: Provider, richWallet: Wallet, auctionFactory: Contract,
    paymaster: Contract, token: Contract, ethUsd: Contract, tokenUsd: Contract): Promise<ethers.ethers.BigNumber[]> {
    const gasPrice = await provider.getGasPrice();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const decimalsBN = ethers.utils.parseUnits("1", decimals.toString())
    let auction_fee: BigNumber;
    if (symbol == "USDC") {
        auction_fee = FLAT_FEE_USDC;
    } else {
        auction_fee = FLAT_FEE_DAI;
    }
    // Estimate gas fee for the transaction
    const balance: BigNumber = await provider.getBalance(richWallet.address);
    const gasLimit = await token.connect(richWallet).estimateGas.approve(
        auctionFactory.address,
        auction_fee,
        {
            customData: {
                // TODO make an estimation of gasPerPubData
                gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                paymasterParams: utils.getPaymasterParams(paymaster.address, {
                    type: "ApprovalBased",
                    token: token.address,
                    // Set a large allowance just for estimation
                    minimalAllowance: balance, //ethers.utils.parseEther("1000"),
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
    const tokenFee = fee.mul(ETHUSD).div(TOKENUSD).mul(decimalsBN).div(ethers.utils.parseUnits("1", 18));
    await logEstimation("approval", tokenFee, ETHUSD, decimals, symbol, TOKENUSD, fee);
    return [tokenFee, gasLimit];
}

export async function estimateAuctionApprovalGas(provider: Provider, richWallet: Wallet, auction: Contract, amount: BigNumber,
    paymaster: Contract, token: Contract, ethUsd: Contract, tokenUsd: Contract): Promise<ethers.ethers.BigNumber[]> {

    console.log(`[Estimate gas] Auction Approval function gas estimation`);
    const gasPrice = await provider.getGasPrice();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const decimalsBN = ethers.utils.parseUnits("1", decimals.toString())

    // Estimate gas fee for the transaction
    // console.log("gaslimit")
    const balance: BigNumber = await provider.getBalance(richWallet.address);
    console.log(`wallet balance is ${balance}`);
    const gasLimit = await token.connect(richWallet).estimateGas.approve(
        auction.address,
        amount,
        {
            customData: {
                // TODO make an estimation of gasPerPubData
                gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                paymasterParams: utils.getPaymasterParams(paymaster.address, {
                    type: "ApprovalBased",
                    token: token.address,
                    // Set a large allowance just for estimation
                    minimalAllowance: balance, //ethers.utils.parseUnits("1000", decimals),
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
    const tokenFee = fee.mul(ETHUSD).div(TOKENUSD).mul(decimalsBN).div(ethers.utils.parseUnits("1", 18));
    await logEstimation("user approval", tokenFee, ETHUSD, decimals, symbol, TOKENUSD, fee);
    console.log(`[Estimate gas] Auction Approval function gas estimation DONE`);
    return [tokenFee, gasLimit];
}

export async function estimateCreateAuctionGas(provider: Provider, richWallet: Wallet, auctionFactory: Contract,
    paymaster: Contract, token: Contract, ethUsd: Contract, tokenUsd: Contract): Promise<ethers.ethers.BigNumber[]> {
    console.log(`[Estimate gas] CreateAuction function gas estimation`);
    const gasPrice = await provider.getGasPrice();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const decimalsBN = ethers.utils.parseUnits("1", decimals.toString())
    let auction_fee: BigNumber;
    if (symbol == "USDC") {
        auction_fee = FLAT_FEE_USDC;
    } else {
        auction_fee = FLAT_FEE_DAI;
    }
    console.log(`tx apporve auction fee ${auction_fee}`);
    const txApprove = await token.connect(richWallet).approve(
        auctionFactory.address,
        auction_fee);
    await txApprove.wait();
    console.log("tx approve done auction fee");

    const gasLimit = await auctionFactory.connect(richWallet).estimateGas.createAuction(
        token.address,
        richWallet.address,
        "fake uri",
        ethers.utils.parseUnits("1", decimals),
        ethers.utils.parseUnits("100", decimals),
        ethers.utils.parseUnits("3600", 1), // 1 hour
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
    const tokenFee = fee.mul(ETHUSD).div(TOKENUSD).mul(decimalsBN).div(ethers.utils.parseUnits("1", 18));
    await logEstimation("createAuction", tokenFee, ETHUSD, decimals, symbol, TOKENUSD, fee);
    console.log(`[Estimate gas] CreateAuction function gas estimation DONE`);
    return [tokenFee, gasLimit];
}

export async function estimatePlaceBidGas(provider: Provider, richWallet: Wallet, auction: Contract, amount: BigNumber,
    paymaster: Contract, token: Contract, ethUsd: Contract, tokenUsd: Contract): Promise<ethers.ethers.BigNumber[]> {

    console.log(`[Estimate gas] PlaceBid function gas estimation`);
    const gasPrice = await provider.getGasPrice();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const decimalsBN = ethers.utils.parseUnits("1", decimals.toString())
    const txApprove = await token.connect(richWallet).approve(
        auction.address,
        amount
    );
    await txApprove.wait();
    console.log("tx approve done auction amount");

    const gasLimit = await auction.connect(richWallet).estimateGas.placeBid(
        richWallet.address,
        amount,
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
    const tokenFee = fee.mul(ETHUSD).div(TOKENUSD).mul(decimalsBN).div(ethers.utils.parseUnits("1", 18));
    await logEstimation("placeBid", tokenFee, ETHUSD, decimals, symbol, TOKENUSD, fee);
    console.log(`[Estimate gas] PlaceBid function gas estimation DONE`);
    return [tokenFee, gasLimit];
}

export async function logEstimation(tittle: string, tokenFee: BigNumber,
    ETHUSD: BigNumber, decimals: number, symbol: string, TOKENUSD: BigNumber, fee: BigNumber) {
    const parsedFeeUSD = await etherToUSD(fee);
    console.log(`Done estimation for ${tittle} ${ethers.utils.formatUnits(tokenFee, decimals)} ${symbol}@${ethers.utils.formatUnits(TOKENUSD, 18)} eth fee was ${parsedFeeUSD}`);
}

export async function etherToUSD(amount: BigNumber): Promise<string> {
    if (COINMARKETCAP_API_KEY) {
        let val = ""
        try {
            const getQuote = await coinMarketCapclient.getQuotes({ symbol: 'ETH' });
            const quote = getQuote.data["ETH"].quote['USD'].price;
            val = (parseFloat(ethers.utils.formatEther(amount)) * parseFloat(quote)).toFixed(4);
        } catch (e) {
            console.log("CoinMarcket cap get Quotee failed using 1 eth = 2000 $")
            val = (parseFloat(ethers.utils.formatEther(amount)) * parseFloat("2000")).toFixed(4);
        }
        return val
    }
    else {
        const quote = "2000"
        return (parseFloat(ethers.utils.formatEther(amount)) * parseFloat(quote)).toFixed(4);
    }
}
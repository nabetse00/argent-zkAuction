import { WalletState } from '@web3-onboard/core';
import * as Erc20Artifact from "../abi-artifacts/contracts/mocks/ERC20.sol/MyERC20.json";
import * as paymasterArtifact from "../abi-artifacts/contracts/AuctionPaymaster.sol/AuctionPaymaster.json";
import * as AuctionFactoryArtifact from "../abi-artifacts/contracts/AuctionFactory.sol/AuctionFactory.json";
import * as AuctionItemArtifact from "../abi-artifacts/contracts/AuctionItems.sol/ZkSyncAuctionItems.json";
import * as AuctionArtifact from "../abi-artifacts/contracts/Auction.sol/Auction.json";
import { BigNumber, ethers } from 'ethers';
import { utils, Contract } from 'zksync-web3';
import { Web3Provider } from "zksync-web3";
import { multicall } from "@argent/era-multicall";
import { Address } from 'zksync-web3/build/src/types';

export const FLAT_FEE_USDC = ethers.utils.parseUnits("0.5", 6);
export const FLAT_FEE_DAI = ethers.utils.parseUnits("0.5", 18);

export enum Methods {
    APPROVE_ERC20,
    AUCTION_CREATE,
    PLACE_BID,
    WITHDRAW
}

const mode = import.meta.env.MODE
export let usdcAddr = ""
export let daiAddr = ""
export let auctionFactoryAddr = ""
export let paymasterAddr = ""
export let ethUsd = ""
export let usdcUsd = ""
export let daiUsd = ""
export let rich = ""

if (mode == "development") {
    usdcAddr = import.meta.env.VITE_USDC_LOCAL
    daiAddr = import.meta.env.VITE_DAI_LOCAL
    auctionFactoryAddr = import.meta.env.VITE_AUCTION_FACTORY_LOCAL
    paymasterAddr = import.meta.env.VITE_PAYMASTER_LOCAL
    ethUsd = import.meta.env.VITE_ETHUSDdAPI_LOCAL
    usdcUsd = import.meta.env.VITE_USDCUSDdAPI_LOCAL
    daiUsd = import.meta.env.VITE_DAIUSDdAPI_LOCAL
    rich = import.meta.env.VITE_RICH_WALLET_ADDRESS
} else {
    usdcAddr = import.meta.env.VITE_USDC
    daiAddr = import.meta.env.VITE_DAI_LOCAL
    auctionFactoryAddr = import.meta.env.VITE_AUCTION_FACTORY
    paymasterAddr = import.meta.env.VITE_PAYMASTER
    ethUsd = import.meta.env.VITE_ETHUSDdAPI
    usdcUsd = import.meta.env.VITE_USDCUSDdAPI
    daiUsd = import.meta.env.VITE_DAIUSDdAPI
    rich = import.meta.env.VITE_RICH_WALLET_ADDRESS_TESNET
}

console.log(usdcAddr )
console.log(daiAddr )
console.log(auctionFactoryAddr )
console.log(paymasterAddr )
console.log(ethUsd )
console.log(usdcUsd )
console.log(daiUsd )
console.log(rich )

export interface ItemData {
    tokenUri: string;
    startPrice: string;
    buyItNow: string;
    durationHours: number;
}

export interface AuctionConfig {
    owner: Address;
    startTimestamp: BigNumber;
    endTimestamp: BigNumber;
    startingPrice: BigNumber;
    buyItNowPrice: BigNumber;
    itemTokenId: BigNumber;
}

export interface AuctionJson {
    product_description: string;
    product_pictures: string;
    product_manufacturer: string;
    product_model: string;
    product_name: string;
    product_start_price: string
    product_auction_token: "USDC" | "DAI";
    product_buy_it_price: string;
    product_duration: number;
}

export enum AuctionStatus {
    INIT,
    ON_GOING,
    ENDED,
    CANCELED,
    DELETABLE,
    UNEXPECTED
}

export async function getTokenUri(wallet: WalletState, tokenId: BigNumber, auctionItemsAddr: Address) {
    const provider = new Web3Provider(wallet.provider)
    const signer = provider.getSigner()
    // const signer = (new Web3Provider(window.ethereum)).getSigner();
    // const signerAddr = await signer.getAddress()
    const auctionItems = new Contract(auctionItemsAddr, AuctionItemArtifact.abi, signer);
    const tokenURI: string = await auctionItems.tokenURI(tokenId);
    console.log(tokenURI.replace("ipfs://", ""))
    return tokenURI.replace("ipfs://", "");

}

export async function getAuctionHighestBinding(wallet: WalletState, addr: Address) {
    const provider = new Web3Provider(wallet.provider)
    const signer = provider.getSigner()
    // const signer = (new Web3Provider(window.ethereum)).getSigner();
    // const signerAddr = await signer.getAddress()
    const auction = new Contract(addr, AuctionArtifact.abi, signer);
    const hbb: BigNumber = await auction.highestBindingBid();
    const decimals: BigNumber = await auction.decimals()
    const hbbStr: string = ethers.utils.formatUnits(hbb, decimals)
    return hbbStr;
}

export async function getAuctionHighestBider(wallet: WalletState, addr: Address) {
    const provider = new Web3Provider(wallet.provider)
    const signer = provider.getSigner()
    // const signer = (new Web3Provider(window.ethereum)).getSigner();
    // const signerAddr = await signer.getAddress()
    const auction = new Contract(addr, AuctionArtifact.abi, signer);
    const hb: Address = await auction.highestBidder();
    return hb;
}


export async function getAuctionStatus(wallet: WalletState, addr: Address) {
    const provider = new Web3Provider(wallet.provider)
    const signer = provider.getSigner()
    // const signer = (new Web3Provider(window.ethereum)).getSigner();
    // const signerAddr = await signer.getAddress()
    const auction = new Contract(addr, AuctionArtifact.abi, signer);
    const auctionStatus: AuctionStatus = auction.auctionStatus();

    return auctionStatus;
}

export async function getAuctionConfig(wallet: WalletState, addr: Address) {
    const provider = new Web3Provider(wallet.provider)
    const signer = provider.getSigner()
    // const signer = (new Web3Provider(window.ethereum)).getSigner();
    // const signerAddr = await signer.getAddress()
    const auction = new Contract(addr, AuctionArtifact.abi, signer);
    const config: AuctionConfig = auction.config()
    return config;
}

export async function getAuctionsAddresses(wallet: WalletState) {
    const provider = new Web3Provider(wallet.provider)
    const signer = provider.getSigner()
    // const signer = (new Web3Provider(window.ethereum)).getSigner();
    // const signerAddr = await signer.getAddress()
    const auctionFactory = new Contract(auctionFactoryAddr, AuctionFactoryArtifact.abi, signer);

    const auctions: string[] = await auctionFactory.getAuctions()

    return auctions;

}

export async function getAuctionItems(wallet: WalletState) {
    const provider = new Web3Provider(wallet.provider)
    const signer = provider.getSigner()
    // const signer = (new Web3Provider(window.ethereum)).getSigner();
    // const signerAddr = await signer.getAddress()
    const auctionFactory = new Contract(auctionFactoryAddr, AuctionFactoryArtifact.abi, signer);

    const auctionItemsAddress: string = await auctionFactory.AUCTION_ITEMS_ADDR()

    return auctionItemsAddress;

}

export async function items(wallet: WalletState) {
    const provider = new Web3Provider(wallet.provider)
    const signer = provider.getSigner()
    // const signer = (new Web3Provider(window.ethereum)).getSigner();
    const signerAddr = await signer.getAddress()
    const auctionFactory = new Contract(auctionFactoryAddr, AuctionFactoryArtifact.abi, signer);
    const auctionItemsAddress: string = await auctionFactory.AUCTION_ITEMS_ADDR()
    const auctionItems = new Contract(auctionItemsAddress, AuctionItemArtifact.abi, signer);

    const items = auctionItems.balanceOf(signerAddr)
    return items;
}

export async function withdraw(wallet: WalletState, auctionAddr: Address) {
    const provider = new Web3Provider(wallet.provider)
    const signer = provider.getSigner()
    // const signer = (new Web3Provider(window.ethereum)).getSigner();
    // const signerAddr = await signer.getAddress()
    const auction = new Contract(auctionAddr, AuctionArtifact.abi, signer);
    const tokenAddr = await auction.bidToken()
    const token = new Contract(tokenAddr, Erc20Artifact.abi, signer);

    const tokenSymbol = await token.symbol()
    const decimals = await token.decimals();
    const decimalsBN = ethers.utils.parseUnits("1", decimals.toString())
    const gasLimit = await auction.connect(signer).estimateGas.withdrawAll(
        {
            customData: {
                // TODO make an estimation of gasPerPubData
                gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                paymasterParams: utils.getPaymasterParams(paymasterAddr, {
                    type: "ApprovalBased",
                    token: token.address,
                    // Set a large allowance just for estimation
                    minimalAllowance: ethers.utils.parseUnits("100", decimals),
                    innerInput: new Uint8Array(),
                }),
            },
        }
    );
    const gasPrice = await provider.getGasPrice();
    const fee = gasPrice.mul(gasLimit.toString());
    const paymaster = new Contract(paymasterAddr, paymasterArtifact.abi, signer)

    const ETHUSD = await paymaster.readDapi(
        ethUsd
    );

    const TOKENUSD = await paymaster.readDapi(
        (tokenSymbol == "USDC" ? usdcUsd : daiUsd)
    );
    // Calculating the amount of token as fees:
    const tokenFee = fee.mul(ETHUSD).div(TOKENUSD).mul(decimalsBN).div(ethers.utils.parseUnits("1", 18));

    const paymasterParamsPlaceBid = utils.getPaymasterParams(
        paymasterAddr, {
        type: "ApprovalBased",
        token: tokenAddr,
        minimalAllowance: tokenFee.mul(20),
        innerInput: new Uint8Array(),
    });

    const calls = [
        await auction.connect(signer).populateTransaction.withdrawAll(
            {
                maxPriorityFeePerGas: ethers.BigNumber.from(0),
                maxFeePerGas: gasPrice,
                // from estimation
                gasLimit: gasLimit.mul(2),
                customData: {
                    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                    paymasterParams: paymasterParamsPlaceBid,
                },
            }),
    ]
    const results = await multicall(signer, calls);

    let is_multicall_valid = true;

    for (const r of results) {
        console.log(`multicall result is ${JSON.stringify(r)}`)
        if (r.isError) {
            is_multicall_valid = false
            console.error(r.error)
        }
    }

    return is_multicall_valid

}


export async function buyItNow(wallet: WalletState, auctionAddr: Address, buyItPrice: BigNumber) {
    const provider = new Web3Provider(wallet.provider)
    const signer = provider.getSigner()
    // const signer = (new Web3Provider(window.ethereum)).getSigner();
    const signerAddr = await signer.getAddress()
    const auction = new Contract(auctionAddr, AuctionArtifact.abi, signer);
    const tokenAddr = await auction.bidToken()
    const token = new Contract(tokenAddr, Erc20Artifact.abi, signer);

    const tokenSymbol = await token.symbol()
    // const tokenDecimals = await token.decimals()
    const gasApprove = await estimateGas(wallet, tokenSymbol, Methods.APPROVE_ERC20)
    const bid = await auction.fundsByBidder(signerAddr)
    const increment = buyItPrice.sub(bid)

    console.log(`bid: ${bid}`)
    console.log(`buy: ${buyItPrice}`)
    console.log(`incement: ${increment}`)
    console.log(`symbols: ${tokenSymbol}`)
    console.log(`signer: ${signerAddr}`)
    const paymasterParamsApprove = utils.getPaymasterParams(
        paymasterAddr, {
        type: "ApprovalBased",
        token: tokenAddr,
        minimalAllowance: gasApprove!.tokenFee,
        innerInput: new Uint8Array(),
    });
    const paymasterParamsPlaceBid = utils.getPaymasterParams(
        paymasterAddr, {
        type: "ApprovalBased",
        token: tokenAddr,
        minimalAllowance: gasApprove!.tokenFee.mul(100),
        innerInput: new Uint8Array(),
    });

    const gasPrice = await provider.getGasPrice();
    

    const calls = [
        await token.connect(signer).populateTransaction.approve(
            auctionAddr,
            increment,
            {
                maxPriorityFeePerGas: ethers.BigNumber.from(0),
                maxFeePerGas: gasPrice,
                // from estimation
                gasLimit: gasApprove?.gasLimit,
                customData: {
                    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                    paymasterParams: paymasterParamsApprove,
                },
            }),
        await auction.connect(signer).populateTransaction.placeBid(
            signerAddr,
            increment,
            {
                maxPriorityFeePerGas: ethers.BigNumber.from(0),
                maxFeePerGas: gasPrice,
                // from estimation
                gasLimit: gasApprove?.gasLimit.mul(20),
                customData: {
                    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                    paymasterParams: paymasterParamsPlaceBid,
                },
            }),
    ]
    const results = await multicall(signer, calls);

    let is_multicall_valid = true;

    for (const r of results) {
        console.log(`multicall result is ${JSON.stringify(r)}`)
        if (r.isError) {
            is_multicall_valid = false
            console.error(r.error)
        }
    }

    return is_multicall_valid

}

export async function placeBid(wallet: WalletState, auctionAddr: Address) {
    const provider = new Web3Provider(wallet.provider)
    const signer = provider.getSigner()
    // const signer = (new Web3Provider(window.ethereum)).getSigner();
    const signerAddr = await signer.getAddress()
    const auction = new Contract(auctionAddr, AuctionArtifact.abi, signer);
    const tokenAddr = await auction.bidToken()
    const token = new Contract(tokenAddr, Erc20Artifact.abi, signer);

    const tokenSymbol = await token.symbol()
    const increment = await auction.getMinimalIncrementTokens()
    const gasApprove = await estimateGas(wallet, tokenSymbol, Methods.APPROVE_ERC20, increment)
    console.log(`incement: ${increment}`)
    console.log(`symbols: ${tokenSymbol}`)
    console.log(`signer: ${signerAddr}`)
    const paymasterParamsApprove = utils.getPaymasterParams(
        paymasterAddr, {
        type: "ApprovalBased",
        token: tokenAddr,
        minimalAllowance: gasApprove!.tokenFee,
        innerInput: new Uint8Array(),
    });
    const paymasterParamsPlaceBid = utils.getPaymasterParams(
        paymasterAddr, {
        type: "ApprovalBased",
        token: tokenAddr,
        minimalAllowance: gasApprove!.tokenFee.mul(20),
        innerInput: new Uint8Array(),
    });

    const gasPrice = await provider.getGasPrice();

    const calls = [
        await token.connect(signer).populateTransaction.approve(
            auctionAddr,
            increment,
            {
                maxPriorityFeePerGas: ethers.BigNumber.from(0),
                maxFeePerGas: gasPrice,
                // from estimation
                gasLimit: gasApprove?.gasLimit,
                customData: {
                    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                    paymasterParams: paymasterParamsApprove,
                },
            }),
        await auction.connect(signer).populateTransaction.placeBid(
            signerAddr,
            increment,
            {
                maxPriorityFeePerGas: ethers.BigNumber.from(0),
                maxFeePerGas: gasPrice,
                // from estimation
                gasLimit: gasApprove?.gasLimit.mul(100),
                customData: {
                    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                    paymasterParams: paymasterParamsPlaceBid,
                },
            }),
    ]
    const results = await multicall(signer, calls);

    let is_multicall_valid = true;

    for (const r of results) {
        console.log(`multicall result is ${JSON.stringify(r)}`)
        if (r.isError) {
            is_multicall_valid = false
            console.error(r.error)
        }
    }

    return is_multicall_valid

}

export async function createAuction(values: ItemData, wallet: WalletState, tokenSymbol: "USDC" | "DAI") {

    // estimate gas to approve Auction factory

    const gasApprove = await estimateGas(wallet, tokenSymbol, Methods.APPROVE_ERC20)
    const gasCreate = await estimateGas(wallet, tokenSymbol, Methods.AUCTION_CREATE)
    const tokenAddr = tokenSymbol == "USDC" ? usdcAddr : daiAddr
    let auction_fee: BigNumber = tokenSymbol == "USDC" ? FLAT_FEE_USDC : FLAT_FEE_DAI;
    //const provider_eth = new ethers.providers.Web3Provider(wallet.provider, 'any')
    const provider = new Web3Provider(wallet.provider)
    const net = await provider.ready;
    console.log(`network: ${JSON.stringify(net)}`)
    const signer = provider.getSigner()
    // const signer = (new Web3Provider(window.ethereum)).getSigner();
    const signerAddr = await signer.getAddress()
    const token = new Contract(tokenAddr, Erc20Artifact.abi, signer);
    const decimals = await token.decimals()
    const auctionFactory = new Contract(auctionFactoryAddr, AuctionFactoryArtifact.abi, signer);
    const gasPrice = await provider.getGasPrice();

    console.log(`payamster is ${paymasterAddr}`)
    const paymasterParamsApprove = utils.getPaymasterParams(
        paymasterAddr, {
        type: "ApprovalBased",
        token: tokenAddr,
        minimalAllowance: gasApprove!.tokenFee,
        innerInput: new Uint8Array(),
    });

    const paymasterParamsCreate = utils.getPaymasterParams(paymasterAddr, {
        type: "ApprovalBased",
        token: tokenAddr,
        minimalAllowance: gasCreate!.tokenFee,
        innerInput: new Uint8Array(),
    });


    const calls = [
        await token.connect(signer).populateTransaction.approve(
            auctionFactoryAddr,
            auction_fee,
            {
                maxPriorityFeePerGas: ethers.BigNumber.from(0),
                maxFeePerGas: gasPrice,
                // from estimation
                gasLimit: gasApprove?.gasLimit,
                customData: {
                    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                    paymasterParams: paymasterParamsApprove,
                },
            }),
        await auctionFactory.connect(signer).
            populateTransaction.
            createAuction(
                token.address,
                signerAddr,
                values.tokenUri,
                ethers.utils.parseUnits(values.startPrice, decimals),
                ethers.utils.parseUnits(values.buyItNow, decimals),
                ethers.utils.parseUnits((values.durationHours * 3600).toString(), 0),
                {
                    maxPriorityFeePerGas: ethers.BigNumber.from(0),
                    maxFeePerGas: gasPrice,
                    // from estimation
                    gasLimit: gasCreate?.gasLimit,
                    customData: {
                        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                        paymasterParams: paymasterParamsCreate,
                    },
                })
    ];



    const results = await multicall(signer, calls);

    let is_multicall_valid = true;

    for (const r of results) {
        console.log(`multicall result is ${JSON.stringify(r)}`)
        if (r.isError) {
            is_multicall_valid = false
            console.error(r.error)
        }
    }

    return is_multicall_valid

}

export async function estimateGas(wallet: WalletState, tokenSymbol: "USDC" | "DAI", method: Methods, value?:BigNumber) {
    logGasEstimationService("dev mode", method)
    if (wallet?.provider) {
        const provider = new Web3Provider(wallet.provider, 'any')
        const net = await provider.ready;
        logGasEstimationService(`provider ${JSON.stringify(net)}`, method)

        const signer = provider.getSigner()
        const signerAddr = await signer.getAddress()
        logGasEstimationService(`signer ${signerAddr}}`, method)

        const tokenAddr = tokenSymbol == "USDC" ? usdcAddr : daiAddr
        const token = new Contract(tokenAddr, Erc20Artifact.abi, signer);
        logGasEstimationService(`token ${await token.symbol()} ${await token.decimals()}`, method)

        const auctionFactory = new Contract(auctionFactoryAddr, AuctionFactoryArtifact.abi, signer);


        const gasPrice = await provider.getGasPrice();
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        const decimalsBN = ethers.utils.parseUnits("1", decimals.toString())
        logGasEstimationService(`gas ${gasPrice} `, method)


        let auction_fee: BigNumber;
        if (symbol == "USDC") {
            auction_fee = FLAT_FEE_USDC;
        } else {
            auction_fee = FLAT_FEE_DAI;
        }
        // Estimate gas fee for the transaction
        const balance: BigNumber = await signer.getBalance();
        logGasEstimationService(`bal ${balance} `, method)
        let gasLimit: BigNumber;
        switch (method) {
            case Methods.APPROVE_ERC20:
                gasLimit = await token.connect(signer).estimateGas.approve(
                    auctionFactoryAddr,
                    value? value:auction_fee,
                    {
                        customData: {
                            // TODO make an estimation of gasPerPubData
                            gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                            paymasterParams: utils.getPaymasterParams(paymasterAddr, {
                                type: "ApprovalBased",
                                token: token.address,
                                // Set a large allowance just for estimation
                                minimalAllowance: balance, //ethers.utils.parseEther("1000"),
                                innerInput: new Uint8Array(),
                            }),
                        },
                    }
                );
                break;
            case Methods.AUCTION_CREATE:
                gasLimit = await auctionFactory.connect(rich).estimateGas.createAuction(
                    token.address,
                    rich,
                    //signerAddr,
                    "fake uri",
                    ethers.utils.parseUnits("1", decimals),
                    ethers.utils.parseUnits("100", decimals),
                    ethers.utils.parseUnits("3600", 1), // 1 hour
                    {
                        customData: {
                            // TODO make an estimation of gasPerPubData
                            gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                            paymasterParams: utils.getPaymasterParams(paymasterAddr, {
                                type: "ApprovalBased",
                                token: token.address,
                                // Set a large allowance just for estimation
                                minimalAllowance: ethers.utils.parseEther("1000"),
                                innerInput: new Uint8Array(),
                            }),
                        },
                    }
                );
                break;

            default:
                gasLimit = ethers.utils.parseEther("0")

        }
        logGasEstimationService(`gaslimit done ${gasLimit}`, method)
        // Gas estimation:
        const fee = gasPrice.mul(gasLimit.toString());
        logGasEstimationService(`fee is  ${fee}`, method)

        // Calling the dAPI to get the ETH price:

        const paymaster = new Contract(paymasterAddr, paymasterArtifact.abi, signer)
        logGasEstimationService(`paymaster ${paymaster}`, method)
        const ETHUSD = await paymaster.readDapi(
            ethUsd
        );
        logGasEstimationService(`eth / $  ${ETHUSD}`, method)
        const TOKENUSD = await paymaster.readDapi(
            (tokenSymbol == "USDC" ? usdcUsd : daiUsd)
        );
        logGasEstimationService(`eth / $  ${TOKENUSD}`, method)
        // Calculating the amount of token as fees:
        const tokenFee = fee.mul(ETHUSD).div(TOKENUSD).mul(decimalsBN).div(ethers.utils.parseUnits("1", 18));
        logGasEstimationService(`fees: ${ethers.utils.formatUnits(tokenFee, decimals)} ${tokenSymbol} - ${ethers.utils.formatEther(fee)} ETH`, method)
        return { tokenFee, gasLimit };
    }
    return;
}

function logGasEstimationService(log: string, method: Methods) {
    if (import.meta.env.MODE == "development") {
        switch (method) {
            case Methods.APPROVE_ERC20:
                console.log(`[LOG GAS ESTIMATION ERC20 Approve] ${log}`)
                break;

            case Methods.AUCTION_CREATE:
                console.log(`[LOG GAS ESTIMATION Create Auction] ${log}`)
                break;

            default:
                console.log(`[LOG GAS ESTIMATION] ${log}`)
                break;
        }

    }
}

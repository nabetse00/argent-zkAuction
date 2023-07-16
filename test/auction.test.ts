import { expect } from "chai";
import { Wallet, Provider, Contract, utils } from "zksync-web3";
import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as ethers from "ethers";
import { FLAT_FEE_DAI, FLAT_FEE_USDC, PRIVATE_KEY, deployContract, estimateFeeApprovalGas, estimateCreateAuctionGas, estimatePlaceBidGas, estimateAuctionApprovalGas, fundAccount, } from "./utils";
import { Address } from "zksync-web3/build/src/types";
import { BigNumber } from "ethers";

enum AuctionStatus {
    INIT,
    ON_GOING,
    ENDED,
    CANCELED,
    DELETABLE,
    UNEXPECTED
}

describe("Auction", function () {
    let provider: Provider;
    let ownerWallet: Wallet;
    let deployer: Deployer;
    let userWallet: Wallet;
    let otherUserWallet: Wallet;
    let richTokenWallet: Wallet;
    let paymaster: Contract;
    let auctionFactory: Contract;
    let numberOfAuctions: number = 1;
    let my_auctions: Address[] = [];
    let usdc: Contract;
    let dai: Contract;
    let usdcUsd: Contract;
    let daiUsd: Contract;
    let ethUsd: Contract;

    before(async function () {
        // setup deployer
        provider = Provider.getDefaultProvider();
        ownerWallet = new Wallet(PRIVATE_KEY, provider);
        deployer = new Deployer(hre, ownerWallet);
        // setup new wallet
        let emptyWallet = Wallet.createRandom();
        userWallet = new Wallet(emptyWallet.privateKey, provider);
        emptyWallet = Wallet.createRandom();
        otherUserWallet = new Wallet(emptyWallet.privateKey, provider);
        console.log(`Empty wallet's address: ${userWallet.address}`);
        console.log(`Empty wallet's address: ${otherUserWallet.address}`);

        // deploy contracts

        // mock usdc
        usdc = await deployContract(deployer, "MyERC20", [
            "USDC",
            "USDC",
            6,
        ]);

        // mock dai
        dai = await deployContract(deployer, "MyERC20", [
            "DAI",
            "DAI",
            18,
        ]);

        // make wallet rich (usefull for gas estimations)
        emptyWallet = Wallet.createRandom();
        richTokenWallet = new Wallet(emptyWallet.privateKey, provider);
        await fundAccount(ownerWallet, richTokenWallet.address, "10000");
        await usdc.mint(richTokenWallet.address, ethers.utils.parseEther("100000"));
        await dai.mint(richTokenWallet.address, ethers.utils.parseEther("100000"));



        
        // paymaster contract auction factory in allowed list
        paymaster = await deployContract(deployer, "AuctionPaymaster", [
            ownerWallet.address, usdc.address, dai.address, ownerWallet.address
        ]);

        // Auction factory contract
        auctionFactory = await deployContract(deployer, "AuctionFactory", [usdc.address, dai.address, paymaster.address, userWallet.address]);


        // add tokens and auction Factory to allowed list

        const txUsdc = await paymaster.addToAllowedContracts(usdc.address);
        await txUsdc.wait();
        const txDai = await paymaster.addToAllowedContracts(dai.address);
        await txDai.wait();
        const txAuctionFactory = await paymaster.addToAllowedContracts(auctionFactory.address);
        await txAuctionFactory.wait();


        // mock proxis 
        ethUsd = await deployContract(deployer, "MyProxy", [ethers.utils.parseEther("2000"), ethers.constants.AddressZero]);
        usdcUsd = await deployContract(deployer, "MyProxy", [ethers.utils.parseEther("1.0001"), ethers.constants.AddressZero]);
        daiUsd = await deployContract(deployer, "MyProxy", [ethers.utils.parseEther("0.9998"), ethers.constants.AddressZero]);

        const setProxy = await paymaster.setDapiProxy(usdcUsd.address, daiUsd.address, ethUsd.address)
        await setProxy.wait()
        console.log("dAPI mock Proxies Set!")
        // fund paymaster
        await fundAccount(ownerWallet, paymaster.address, "5");
    });


    async function executeUserApprovalTransaction(auction: Contract, amount: BigNumber, user: Wallet, rich: Wallet, token: Contract, tokenUsd: Contract) {
        const gasPrice = await provider.getGasPrice();
        const token_address = token.address.toString();
        const decimals = await token.decimals();
        const symbol = await token.symbol();
        const [fee, gasLimit] = await estimateAuctionApprovalGas(provider, rich, auction, amount, paymaster, token, ethUsd, tokenUsd);
        console.log(`fee ${ethers.utils.formatUnits(fee, decimals)} gasLimit ${gasLimit}`)
        const paymasterParams = utils.getPaymasterParams(paymaster.address, {
            type: "ApprovalBased",
            token: token_address,
            minimalAllowance: fee,
            innerInput: new Uint8Array(),
        });

        console.log(`execute tx approval init for ${amount} token`);
        const approveTx = await token
            .connect(user)
            .approve(
                auction.address,
                amount,
                {
                    maxPriorityFeePerGas: ethers.BigNumber.from(0),
                    maxFeePerGas: gasPrice,
                    // from estimation
                    gasLimit: gasLimit,
                    customData: {
                        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                        paymasterParams,
                    },
                });

        await approveTx.wait();
        console.log("execute tx approval token done");
        const approval = await token.allowance(user.address, auction.address)
        expect(approval).to.eql(amount);
    }

    async function executeApprovalTransaction(my_auction_factory: Contract, user: Wallet, rich: Wallet, token: Contract, tokenUsd: Contract) {
        const gasPrice = await provider.getGasPrice();
        const token_address = token.address.toString();
        const decimals = await token.decimals();
        const symbol = await token.symbol();
        let auction_fee;
        if (symbol == "USDC") {
            auction_fee = FLAT_FEE_USDC;
        } else {
            auction_fee = FLAT_FEE_DAI;
        }
        const [fee, gasLimit] = await estimateFeeApprovalGas(provider, rich, my_auction_factory, paymaster, token, ethUsd, tokenUsd);
        console.log(`fee ${ethers.utils.formatUnits(fee, decimals)} gasLimit ${gasLimit}`)
        const paymasterParams = utils.getPaymasterParams(paymaster.address, {
            type: "ApprovalBased",
            token: token_address,
            minimalAllowance: fee,
            innerInput: new Uint8Array(),
        });

        console.log("execute tx init approval");
        const approveTx = await token
            .connect(user)
            .approve(
                auctionFactory.address,
                auction_fee,
                {
                    maxPriorityFeePerGas: ethers.BigNumber.from(0),
                    maxFeePerGas: gasPrice,
                    // from estimation
                    gasLimit: gasLimit,
                    customData: {
                        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                        paymasterParams,
                    },
                });

        await approveTx.wait();
        console.log("execute tx done approval");

    }

    async function executeAuctionFactoryTransaction(my_auction_factory: Contract, user: Wallet, rich: Wallet, token: Contract, tokenUsd: Contract) {
        const gasPrice = await provider.getGasPrice();
        const token_address = token.address.toString();
        const decimals = await token.decimals();

        const [fee, gasLimit] = await estimateCreateAuctionGas(provider, rich, my_auction_factory, paymaster, token, ethUsd, tokenUsd);
        console.log(`fee ${ethers.utils.formatUnits(fee, decimals)} gasLimit ${gasLimit}`)
        const paymasterParams = utils.getPaymasterParams(paymaster.address, {
            type: "ApprovalBased",
            token: token_address,
            minimalAllowance: fee,
            innerInput: new Uint8Array(),
        });

        console.log("execute tx create init");
        const createAuctionTx = await my_auction_factory
            .connect(user)
            .createAuction(
                token.address,
                user.address,
                "fake uri",
                ethers.utils.parseUnits("1", decimals),
                ethers.utils.parseUnits("100", decimals),
                ethers.utils.parseUnits("3600", 1), // 1 hour
                {
                    maxPriorityFeePerGas: ethers.BigNumber.from(0),
                    maxFeePerGas: gasPrice,
                    // from estimation
                    gasLimit: gasLimit,
                    customData: {
                        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                        paymasterParams,
                    },
                });

        await createAuctionTx.wait();
        console.log("execute tx create init");

    }

    async function executePlaceBidTransaction(auctionAddr: string, user: Wallet, rich: Wallet, token: Contract, tokenUsd: Contract) {
        const gasPrice = await provider.getGasPrice();
        const token_address = token.address.toString();
        const decimals = await token.decimals();
        const artifact = await deployer.loadArtifact("Auction");
        const auction =  new Contract(auctionAddr, artifact.abi, provider);
        const status:boolean = await paymaster.getAllowedContracts(auction.address);
        console.log(`approval to ${auction.address} status is ${status}`)
        const increment: BigNumber = await auction.getMinimalIncrementTokens();
        // give user tokens
        const mintTx = await token.mint(user.address, increment.mul(10));
        await mintTx.wait()
        console.log(`for ${increment} tokens`)
        await executeUserApprovalTransaction(auction, increment, user, rich, token, tokenUsd);
        console.log("Done Approve")
        const [fee, gasLimit] = await estimatePlaceBidGas(provider, rich, auction, increment, paymaster, token, ethUsd, tokenUsd);
        console.log(`fee ${ethers.utils.formatUnits(fee, decimals)} gasLimit ${gasLimit}`)
        const paymasterParams = utils.getPaymasterParams(paymaster.address, {
            type: "ApprovalBased",
            token: token_address,
            minimalAllowance: fee,
            innerInput: new Uint8Array(),
        });

        const bal = await token.balanceOf(user.address);

        console.log(`execute tx placeBid inituser: ${bal}`);
        const createAuctionTx = await auction
            .connect(user)
            .placeBid(
                user.address,
                increment,
                {
                    maxPriorityFeePerGas: ethers.BigNumber.from(0),
                    maxFeePerGas: gasPrice,
                    // from estimation
                    gasLimit: gasLimit,
                    customData: {
                        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                        paymasterParams,
                    },
                });

        await createAuctionTx.wait();
        console.log("execute tx Placebid done");
        // check bid
        const hb = await auction.getHighestBid();
        expect(hb).to.eql(increment);
        const st = await auction.auctionStatus();
        expect(st).to.eql(AuctionStatus.ON_GOING)

    }

    async function testAuctionCreationWithPaymaster(_token: Contract, tokenUsd: Contract) {
        const decimals = await _token.decimals()
        const symbol = await _token.symbol();
        let auction_fee;
        if (symbol == "USDC") {
            auction_fee = FLAT_FEE_USDC;
        } else {
            auction_fee = FLAT_FEE_DAI;
        }
        const initialMintAmount = ethers.utils.parseUnits("3", decimals);
        const success = await _token.mint(userWallet.address, initialMintAmount);
        await success.wait();


        const userInitialTokenBalance = await _token.balanceOf(userWallet.address);
        const userInitialETHBalance = await userWallet.getBalance();
        expect(userInitialETHBalance).to.eql(ethers.utils.parseEther("0"));
        const initialPaymasterBalance = await provider.getBalance(
            paymaster.address,
        );
        const initialPaymasterTokenBalance = await _token.balanceOf(paymaster.address);

        await executeApprovalTransaction(auctionFactory, userWallet, richTokenWallet, _token, tokenUsd);
        await executeAuctionFactoryTransaction(auctionFactory, userWallet, richTokenWallet, _token, tokenUsd);

        const finalETHBalance = await userWallet.getBalance();
        const finalUserTokenBalance = await _token.balanceOf(userWallet.address);
        const finalPaymasterBalance = await provider.getBalance(paymaster.address);
        const finalPaymasterTokenBalance = await _token.balanceOf(paymaster.address);
        const auctions:string[] = await auctionFactory.getAuctions();
        console.log(auctions)
        expect(auctions.length).to.equal(numberOfAuctions);
        my_auctions.push(auctions[numberOfAuctions-1]);
        expect(initialPaymasterBalance.gt(finalPaymasterBalance)).to.be.true;
        expect(userInitialETHBalance).to.eql(finalETHBalance);
        expect(userInitialTokenBalance.gt(finalUserTokenBalance)).to.be.true;
        const paid = finalPaymasterTokenBalance.sub(initialPaymasterTokenBalance).add(auction_fee);
        expect(paid).to.eql(userInitialTokenBalance.sub(finalUserTokenBalance))

        console.log(`user Paid ${ethers.utils.formatUnits(finalUserTokenBalance.sub(userInitialTokenBalance), decimals)}`)

        // auction checks 
    }

    it("user with USDC token can make create an auction, fee payed in usdc", async function () {
        await testAuctionCreationWithPaymaster(usdc, usdcUsd);
        numberOfAuctions++;
    });

    it("user with Dai token can create auction, fee payed in dai", async function () {
        await testAuctionCreationWithPaymaster(dai, daiUsd);
        numberOfAuctions++;
    });

    it("place a bid for auction in usdc via paymaster", async function () {
        await executePlaceBidTransaction(my_auctions[0], otherUserWallet, richTokenWallet, usdc, usdcUsd);
    });


});
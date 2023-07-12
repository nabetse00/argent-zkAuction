import { expect } from "chai";
import { Wallet, Provider, Contract, utils } from "zksync-web3";
import * as hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as ethers from "ethers";
import { PRIVATE_KEY, deployContract, estimateGreeterGas, fundAccount } from "./utils";



describe("AuctionPaymaster", function () {
    let provider: Provider;
    let ownerWallet: Wallet;
    let deployer: Deployer;
    let userWallet: Wallet;
    let otherUserWallet: Wallet;
    let richTokenWallet: Wallet;
    let paymaster: Contract;
    let greeter: Contract;
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
        await fundAccount(ownerWallet, richTokenWallet.address,"10000");
        await usdc.mint(richTokenWallet.address, ethers.utils.parseEther("100000"));
        await dai.mint(richTokenWallet.address, ethers.utils.parseEther("100000"));


        // greeter contract
        greeter = await deployContract(deployer, "Greeter", ["Hi"]);

        // paymaster contract
        paymaster = await deployContract(deployer, "AuctionPaymaster", [
            ownerWallet.address, usdc.address, dai.address, greeter.address
        ]);

        // mock proxis 
        ethUsd = await deployContract(deployer, "MyProxy", [ethers.utils.parseEther("2000"), ethers.constants.AddressZero]);
        usdcUsd = await deployContract(deployer, "MyProxy", [ethers.utils.parseEther("1.0001"), ethers.constants.AddressZero]);
        daiUsd = await deployContract(deployer, "MyProxy", [ethers.utils.parseEther("0.9998"), ethers.constants.AddressZero]);

        const setProxy = paymaster.setDapiProxy(usdcUsd.address, daiUsd.address, ethUsd.address)
        await (await setProxy).wait()
        console.log("dAPI mock Proxies Set!")
        // fund paymaster
        await fundAccount(ownerWallet, paymaster.address, "5");
    });

    async function executeGreetingTransaction(my_greeter: Contract, user: Wallet, rich: Wallet, token: Contract, tokenUsd: Contract) {
        const gasPrice = await provider.getGasPrice();
        const token_address = token.address.toString();
        const [fee, gasLimit] = await estimateGreeterGas(provider, rich, my_greeter, paymaster, token, ethUsd, tokenUsd);
        //console.log(`fee ${ethers.utils.formatEther(fee)} gasLimit ${gasLimit}`)
        const paymasterParams = utils.getPaymasterParams(paymaster.address, {
            type: "ApprovalBased",
            token: token_address,
            minimalAllowance: fee,
            innerInput: new Uint8Array(),
        });

        const setGreetingTx = await my_greeter
            .connect(user)
            .setGreeting("Hola, mundo!", {
                maxPriorityFeePerGas: ethers.BigNumber.from(0),
                maxFeePerGas: gasPrice,
                // from estimation
                gasLimit: gasLimit,
                customData: {
                    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                    paymasterParams,
                },
            });

        await setGreetingTx.wait();
    }

    it("user with USDC token can NOT update message of not allowed contract", async function () {
        // greeter contract
        const new_greeter = await deployContract(deployer, "Greeter", ["Hi"]);
        const txSetGreeter = await new_greeter.connect(ownerWallet).setGreeting("Contract test!");
        await txSetGreeter.wait();
        const initialMintAmount = ethers.utils.parseEther("3");
        const success = await usdc.mint(userWallet.address, initialMintAmount);
        await success.wait();

        const userInitialTokenBalance = await usdc.balanceOf(userWallet.address);
        expect(userInitialTokenBalance).to.eql(initialMintAmount);
        const userInitialETHBalance = await userWallet.getBalance();
        expect(userInitialETHBalance).to.eql(ethers.utils.parseEther("0"));
        const initialPaymasterBalance = await provider.getBalance(
            paymaster.address,
        );
        
        try {
            await executeGreetingTransaction(new_greeter, userWallet, richTokenWallet, usdc, usdcUsd);
        } catch (e) {
            //console.log(e.message)
            expect(e.message).to.include("Contract Not allowed to use this paymaster");
        }

        let finalETHBalance = await userWallet.getBalance();
        let finalUserTokenBalance = await usdc.balanceOf(userWallet.address);
        let finalPaymasterBalance = await provider.getBalance(paymaster.address);

        expect(await new_greeter.greet()).to.equal("Contract test!");
        expect(initialPaymasterBalance).to.eql(finalPaymasterBalance);
        expect(userInitialETHBalance).to.eql(finalETHBalance);
        expect(userInitialTokenBalance).to.eql(finalUserTokenBalance);

        console.log(`user Paid ${ethers.utils.formatEther(finalUserTokenBalance.sub(userInitialTokenBalance))}`)

        // add contract to allowed list

        try {
            await paymaster.connect(richTokenWallet).addToAllowedContracts(new_greeter.address);
        } catch (e) {
            expect(e.message).to.include("Only owner or allowed contracts can call this method");
        }
        
        // add to allowed now greeter should be set
        const add_tx = await paymaster.connect(ownerWallet).addToAllowedContracts(new_greeter.address);
        await add_tx.wait();
        await executeGreetingTransaction(new_greeter, userWallet, richTokenWallet, usdc, usdcUsd);
 
        finalETHBalance = await userWallet.getBalance();
        finalUserTokenBalance = await usdc.balanceOf(userWallet.address);
        finalPaymasterBalance = await provider.getBalance(paymaster.address);

        expect(await new_greeter.greet()).to.equal("Hola, mundo!");
        expect(initialPaymasterBalance.gt(finalPaymasterBalance)).to.be.true;
        expect(userInitialETHBalance).to.eql(finalETHBalance);
        expect(userInitialTokenBalance.gt(finalUserTokenBalance)).to.be.true;
        console.log(`user Paid ${ethers.utils.formatUnits(finalUserTokenBalance.sub(userInitialTokenBalance), 6)}`)
    });

    it("user with USDC token can update message, fee payed in usdc", async function () {
        const txSetGreeter = await greeter.connect(ownerWallet).setGreeting("USDC test!");
        await txSetGreeter.wait();
        // burn usdc and resupply
        const tx_burn = await usdc.connect(ownerWallet).burn(userWallet.address, usdc.balanceOf(userWallet.address));
        await tx_burn.wait();

        const initialMintAmount = ethers.utils.parseEther("3");
        const success = await usdc.mint(userWallet.address, initialMintAmount);
        await success.wait();

        const userInitialTokenBalance = await usdc.balanceOf(userWallet.address);
        expect(userInitialTokenBalance).to.eql(initialMintAmount);
        const userInitialETHBalance = await userWallet.getBalance();
        expect(userInitialETHBalance).to.eql(ethers.utils.parseEther("0"));
        const initialPaymasterBalance = await provider.getBalance(
            paymaster.address,
        );

        await executeGreetingTransaction(greeter, userWallet, richTokenWallet, usdc, usdcUsd);

        const finalETHBalance = await userWallet.getBalance();
        const finalUserTokenBalance = await usdc.balanceOf(userWallet.address);
        const finalPaymasterBalance = await provider.getBalance(paymaster.address);

        expect(await greeter.greet()).to.equal("Hola, mundo!");
        expect(initialPaymasterBalance.gt(finalPaymasterBalance)).to.be.true;
        expect(userInitialETHBalance).to.eql(finalETHBalance);
        expect(userInitialTokenBalance.gt(finalUserTokenBalance)).to.be.true;
        console.log(`user Paid ${ethers.utils.formatUnits(finalUserTokenBalance.sub(userInitialTokenBalance), 6)}`)
    });

    it("user with Dai token can update message, fee payed in dai", async function () {
        const txSetGreeter = await greeter.connect(ownerWallet).setGreeting("DAI test!");
        await txSetGreeter.wait();
        const initialMintAmount = ethers.utils.parseEther("3");
        const success = await dai.mint(otherUserWallet.address, initialMintAmount);
        await success.wait();

        const userInitialTokenBalance = await dai.balanceOf(otherUserWallet.address);
        const userInitialETHBalance = await otherUserWallet.getBalance();
        const initialPaymasterBalance = await provider.getBalance(
            paymaster.address,
        );

        await executeGreetingTransaction(greeter, otherUserWallet, richTokenWallet, dai, daiUsd);

        const finalETHBalance = await otherUserWallet.getBalance();
        const finalUserTokenBalance = await dai.balanceOf(otherUserWallet.address);
        const finalPaymasterBalance = await provider.getBalance(paymaster.address);

        expect(await greeter.greet()).to.equal("Hola, mundo!");
        expect(initialPaymasterBalance.gt(finalPaymasterBalance)).to.be.true;
        expect(userInitialETHBalance).to.eql(finalETHBalance);
        expect(userInitialTokenBalance.gt(finalUserTokenBalance)).to.be.true;
        console.log(`user Paid ${ethers.utils.formatUnits(finalUserTokenBalance.sub(userInitialTokenBalance), 18)}`)
    });

    it("should allow owner to withdraw all funds", async function () {
        const initialUserBalance = await provider.getBalance(userWallet.address);
        const initialContractBalance = await provider.getBalance(paymaster.address);
        const initialUserBalanceUSDC = await usdc.balanceOf(userWallet.address);
        const initialUserBalanceDAI = await dai.balanceOf(userWallet.address);

        const initialContractBalanceUSDC = await usdc.balanceOf(paymaster.address);
        const initialContractBalanceDAI = await dai.balanceOf(paymaster.address);

        try {
            const tx = await paymaster.connect(ownerWallet).withdraw(userWallet.address);
            await tx.wait();
        } catch (e) {
            console.error("Error executing withdrawal:", e);
        }

        const finalContractBalance = await provider.getBalance(paymaster.address);

        const finalContractBalanceUSDC = await usdc.balanceOf(paymaster.address);
        const finalContractBalanceDAI = await dai.balanceOf(paymaster.address);

        expect(finalContractBalance).to.eql(ethers.BigNumber.from(0));
        expect(finalContractBalanceUSDC).to.eql(ethers.BigNumber.from(0));
        expect(finalContractBalanceDAI).to.eql(ethers.BigNumber.from(0));
        expect((await usdc.balanceOf(userWallet.address)).sub(initialUserBalanceUSDC)).to.eql(initialContractBalanceUSDC.sub(finalContractBalanceUSDC))
        expect((await dai.balanceOf(userWallet.address)).sub(initialUserBalanceDAI)).to.eql(initialContractBalanceDAI.sub(finalContractBalanceDAI))
        expect((await provider.getBalance(userWallet.address)).sub(initialUserBalance)).to.eql(initialContractBalance.sub(finalContractBalance))
    });

    it("should prevent non-owners from withdrawing funds", async function () {
        try {
            await paymaster.connect(userWallet).withdraw(userWallet.address);
        } catch (e) {
            expect(e.message).to.include("Ownable: caller is not the owner");
        }
    });
});
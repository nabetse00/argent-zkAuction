import { Contract, Provider, Wallet, utils } from "zksync-web3";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import * as ethers from "ethers";

export const COOL_DOWN_DURATION = 10; // 10 sec

export async function deployContract(
    deployer: Deployer,
    contract: string,
    params: any[],
): Promise<Contract> {
    const artifact = await deployer.loadArtifact(contract);

    const deploymentFee = await deployer.estimateDeployFee(artifact, params);
    const parsedFee = ethers.utils.formatEther(deploymentFee.toString());
    console.log(`${contract} deployment is estimated to cost ${parsedFee} ETH`);
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
                gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
                paymasterParams: utils.getPaymasterParams(paymaster.address, {
                    type: "ApprovalBased",
                    token: token.address,
                    // Set a large allowance just for estimation
                    minimalAllowance: ethers.utils.parseEther("1000"),
                    // Empty bytes as testnet paymaster does not use innerInput
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

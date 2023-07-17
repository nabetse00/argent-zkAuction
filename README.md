# Argent zkAuction

![Argent zkAuction](./images/logo-color.png)
This project was scaffolded with [zksync-cli](https://github.com/matter-labs/zksync-cli).

## Features

This project showcases features of zkSync and Argent wallet.

- Custom Paymaster: allows to pay fees in DAI and USDC, only for allowed contracts
- Argent wallet multicalls: one clic for approval and execution.

The example app is an item auction with a one clic buy it now button.

Please follow: 
- [Video](http://video.demo) 
- [Demo site](http://web.demo)

For more details.

## Project structure

- `/contracts`: smart contracts.
- `/deploy`: deployment and contract interaction scripts.
- `/test`: test files
- `hardhat.config.ts`: configuration file.
- `/frontend`: demo site source code

### Environment variables

In order to prevent users to leak private keys, this project includes the `dotenv` package which is used to load environment variables. It's used to load the wallet private key, required to run the deploy script.

To use it, rename `.env.example` to `.env` and enter your private key.

```
WALLET_PRIVATE_KEY=123cde574ccff....
```

## Contracts

- [AuctionPaymaster](./contracts/AuctionPaymaster.sol)
A Paymaster contract that allow to pay fees of allowed contracts un DAI or USDC
- [ZkSyncAuctionItems](./contracts/AuctionItems.sol) ERC721 Nft representing an item Auction.
- [Auction](./contracts/Auction.sol) Auction contract with bid increments computed from item actual price and support for  **buy it now** price.
- [AuctionFactory](./contracts/AuctionFactory.sol) Auctions creation contract.
- [mocks](./contracts/mocks/) folder for mock contracts, only used when testing.
- [Greeter](./contracts/Greeter.sol) simple greeter test contract, not used in tesnet.

zkSync ERA tesnet deployed contract:
- PAYMASTER => [0x176166463bf8def8bb0d2F1311c7EfEDdC823e21](https://goerli.explorer.zksync.io/address/0x176166463bf8def8bb0d2F1311c7EfEDdC823e21)
- AUCTION_FACTORY [0xC006e415498A3D65Df9BF9a7F5F5d06187DC7F1E](https://goerli.explorer.zksync.io/address/0xC006e415498A3D65Df9BF9a7F5F5d06187DC7F1E)

Remember AuctionFactory creates its own NFT representing Auctions items:
[0x5A628202dC10A66375871E5e5DB4555129B21b19](https://goerli.explorer.zksync.io/address/0x5A628202dC10A66375871E5e5DB4555129B21b19)

And Auction contracts are added when you create an Auction.

## Deployement

Use deployment command for local testing

```console
yarn deploy-zkauction-local
```

for ZkSyncEra testnet:

```console
yarn deploy-zkauction-testnet
```

Output for localnet:

```console
yarn run v1.22.19
$ NODE_ENV=test hardhat deploy-zksync --script deploy-zkAuction.ts --network zkSyncTestnet
[DEPLOY zkAuction contracts] NODE_ENV: test
[DEPLOY zkAuction contracts] deploy paymaster
[DEPLOY Paymaster] NODE_ENV: test
[DEPLOY Paymaster] On local testnet we use a rich wallet to delpoy: 0x36615Cf349d7F6344891B1e7CA7C72883F5dc049
[DEPLOY Mock contracts] NODE_ENV: test
[DEPLOY Mock contracts] On local testnet we use a rich wallet to delpoy: 0x36615Cf349d7F6344891B1e7CA7C72883F5dc049
[DEPLOY Mock contracts] Deployer zkWallet: 0x36615Cf349d7F6344891B1e7CA7C72883F5dc049
[DEPLOY Mock contracts] Deployer ethWallet: 0x36615Cf349d7F6344891B1e7CA7C72883F5dc049
[DEPLOY Mock contracts] Stable coins mocks addresses: 
 USDC: 0x111C3E89Ce80e62EE88318C2804920D4c96f92bb 
 DAI 0x4B5DF730c2e6b28E17013A1485E5d9BC41Efe021
[DEPLOY Mock contracts] Proxys: [0x26b368C3Ed16313eBd6660b72d8e4439a697Cb0B, 0x094499Df5ee555fFc33aF07862e43c90E6FEe501, 0xb76eD02Dea1ba444609602BE5D587c4bFfd67153 ]
[DEPLOY Mock contracts] Contract not verified, deployed locally.
[DEPLOY Mock contracts] Done!
[DEPLOY Paymaster] Deployer zkWallet: 0x36615Cf349d7F6344891B1e7CA7C72883F5dc049
[DEPLOY Paymaster] Deployer ethWallet: 0x36615Cf349d7F6344891B1e7CA7C72883F5dc049
[DEPLOY Paymaster] paymaster contract address: 0xf2FcC18ED5072b48C0a076693eCa72fE840b3981
[DEPLOY Paymaster] owner is: 0x36615Cf349d7F6344891B1e7CA7C72883F5dc049
[DEPLOY Paymaster] dAPI Proxies set
[DEPLOY Paymaster] Contract not verified, deployed locally.
[DEPLOY Paymaster] Done!
[DEPLOY zkAuction contracts] deploy auction factory
[DEPLOY Auction Factory] NODE_ENV: test
[DEPLOY Auction Factory] On local testnet we use a rich wallet to delpoy: 0x36615Cf349d7F6344891B1e7CA7C72883F5dc049
[DEPLOY Auction Factory] Local testnet we user wallet to delpoy: 0xBbb41D8d9a64558Bdc6C7C9bD92f4ec810C6d0BF
[DEPLOY Auction Factory] Deployer zkWallet: 0x36615Cf349d7F6344891B1e7CA7C72883F5dc049
[DEPLOY Auction Factory] Deployer ethWallet: 0x36615Cf349d7F6344891B1e7CA7C72883F5dc049
[DEPLOY Auction Factory] Auction Factory contract address: 0x5fE58d975604E6aF62328d9E505181B94Fc0718C
[DEPLOY Auction Factory] Contract not verified, deployed locally.
[DEPLOY Auction Factory] Done!
[Add Founds] NODE_ENV: test
[Add Founds] Rich wallet is: 0x36615Cf349d7F6344891B1e7CA7C72883F5dc049
[Add Founds] Local wallet is: 0xBbb41D8d9a64558Bdc6C7C9bD92f4ec810C6d0BF
[Add Founds] Local wallet diff balance is : 1.0
[Add Founds] Paymaster wallet diff balance is : 1.0
[Add Founds] give to 0xBbb41D8d9a64558Bdc6C7C9bD92f4ec810C6d0BF USDC 100 from 0x111C3E89Ce80e62EE88318C2804920D4c96f92bb
[Add Founds] give to 0xBbb41D8d9a64558Bdc6C7C9bD92f4ec810C6d0BF DAI 100 from 0x4B5DF730c2e6b28E17013A1485E5d9BC41Efe021
[Add Founds] DONE
[DEPLOY zkAuction contracts] Done!
Done in 27.63s
```

Fill [.env](./.env) with updated values (use [.env.example](./.env.example) as a template) 
Fill [vite .env](./frontend/.env)  (use [.env.development](./.env.development) as a template)

Add funds if needed (localnet):
```console
yarn add-funds
```

And prepare Approvals for TESTNET with:
```console
yarn deploy-post-testnet
```

## Front end

Install deps and run localy:
```console
  cd frontend/
  yarn
  yarn dev
```
A local server should at [http://localhost:5173/](http://localhost:5173/):
```
  VITE v4.4.3  ready in 652 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h to show help
```

Demo site [here](http://here.com)

## Run foundry tests

Foundry test are quick and include fuzzing.
We use them for validating contract functionality and logic.
Note that foundry test are not suitable for paymaster contracts
since they are specific to zkSync EVM and must be run on a [local testnet](#run-local-testnet-tests).

First install forge (on windows use WSL2):
```console
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
```

Check your instalation:
```
forge --version
```

you should get:
```console
forge 0.X.X (<hash> <timestamp>)
```

```console
yarn add --dev @nomicfoundation/hardhat-foundry
```
and  import it in your Hardhat config:
```ts
import { HardhatUserConfig } from "hardhat/config";

import "@nomicfoundation/hardhat-foundry";

// rest of hardhat.config.ts file
```

To complete the setup, run npx hardhat init-foundry. T
his task will create a foundry.toml file with the right configuration and install 
forge-std.

```console
npx hardhat init-foundry
forge install foundry-rs/forge-std
```

then:
```console
forge test --via-ir
```
you can also use `test_forge.sh` script:
```console
./test_forge.sh
```

See [forge docs](https://book.getfoundry.sh/reference/forge/forge-test)
and [Hardhat Integrating with Foundry](https://hardhat.org/hardhat-runner/docs/advanced/hardhat-and-foundry)
for more details.

## Run zkSync local environment tests

Contracts are tested with a localnet


In order to run test, you need to start the zkSync local environment. Please check [this section of the docs](https://v2-docs.zksync.io/api/hardhat/testing.html#prerequisites) which contains all the details.
(see [zkSync docs local testing](https://era.zksync.io/docs/tools/hardhat/testing.html)
for local network specific details)

If you do not start the zkSync local environment, the tests will fail with error `Error: could not detect network (event="noNetwork", code=NETWORK_ERROR, version=providers/5.7.2)`

Installing the testing environment (On windows os please use a ubuntu WSL2 install) 

```console
cd ~
git clone https://github.com/matter-labs/local-setup.git
```

Start the local nodes:

```console
cd local-setup
./start.sh
```

Then in project root directory:

Copy `env.example` to `.env`
```toml
WALLET_PRIVATE_KEY="your wallet private key here"

# local testnet RICHWALLET
RICH_WALLET_ADDRESS="0x36615Cf349d7F6344891B1e7CA7C72883F5dc049"
RICH_WALLET_PRIVATE_KEY="0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110"

# TESNET USDC AND DAI ADDRESS
USDC="0x0faF6df7054946141266420b43783387A78d82A9"
DAI="0x3e7676937A7E96CFB7616f255b9AD9FF47363D4b"

# Dapi proxies 
ETHUSDdAPI="0x28ce555ee7a3daCdC305951974FcbA59F5BdF09b"
USDCUSDdAPI="0x946E3232Cc18E812895A8e83CaE3d0caA241C2AB"
DAIUSDdAPI="0xd038B4d9325aa2beB4E6f3E82B9165634Dc4C35E"

# [OPTIONAL] COINMARKET
COINMARKETCAP_API_KEY="your coinmarketcap api key here for fiat estimations"
```


and run:

```console
yarn test
```

Gas estimations and test results should appear:
```
... ouput ...
Greeter deployment is estimated to cost 0.00004848225 ETH [ ~ $0.0906 ]
AuctionPaymaster deployment is estimated to cost 0.000057455 ETH [ ~ $0.1073 ]
MyProxy deployment is estimated to cost 0.00005049675 ETH [ ~ $0.0943 ]
... output ...
    ✔ user with Dai token can reupdate message if cooldown time has passed, fee payed in dai (15384ms)
    ✔ should allow owner to withdraw all funds (1037ms)
    ✔ should prevent non-owners from withdrawing funds (259ms)
  7 passing (1m)

Done in 70.78s.
```
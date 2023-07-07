# zkSync Hardhat project

This project was scaffolded with [zksync-cli](https://github.com/matter-labs/zksync-cli).

## Project structure

- `/contracts`: smart contracts.
- `/deploy`: deployment and contract interaction scripts.
- `/test`: test files
- `hardhat.config.ts`: configuration file.

## Commands

- `yarn hardhat compile` will compile the contracts.
- `yarn run deploy` will execute the deployment script `/deploy/deploy-greeter.ts`. Requires [environment variable setup](#environment-variables).
- `yarn run greet` will execute the script `/deploy/use-greeter.ts` which interacts with the Greeter contract deployed.
- `yarn test`: run tests. **Check test requirements below.**

Both `yarn run deploy` and `yarn run greet` are configured in the `package.json` file and run `yarn hardhat deploy-zksync`.

### Environment variables

In order to prevent users to leak private keys, this project includes the `dotenv` package which is used to load environment variables. It's used to load the wallet private key, required to run the deploy script.

To use it, rename `.env.example` to `.env` and enter your private key.

```
WALLET_PRIVATE_KEY=123cde574ccff....
```

### Local testing

In order to run test, you need to start the zkSync local environment. Please check [this section of the docs](https://v2-docs.zksync.io/api/hardhat/testing.html#prerequisites) which contains all the details.

If you do not start the zkSync local environment, the tests will fail with error `Error: could not detect network (event="noNetwork", code=NETWORK_ERROR, version=providers/5.7.2)`

## Official Links

- [Website](https://zksync.io/)
- [Documentation](https://v2-docs.zksync.io/dev/)
- [GitHub](https://github.com/matter-labs)
- [Twitter](https://twitter.com/zksync)
- [Discord](https://discord.gg/nMaPGrDDwk)


## Run test on localtestnet

Contracts are tested with a localnet

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
WALLET_PRIVATE_KEY="your private key here"
# local testnet RICHWALLET
RICH_WALLET_ADDRESS="0x36615Cf349d7F6344891B1e7CA7C72883F5dc049"
RICH_WALLET_PRIVATE_KEY="0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110"
```

and run:

```console
yarn test
```

Gas estimations should appear:
```
... ouput ...
Greeter deployment is estimated to cost 0.00004848225 ETH
AuctionPaymaster deployment is estimated to cost 0.000057455 ETH
... output ...
```
#!/bin/bash
# zkSync local development setup from https://github.com/matter-labs/local-setup
# PATH_TO_LOCAL_SET_UP=~/local-setup
# run ./start.sh
clear
echo "TEST WITH HARDHAT - LOCAL ZK SYNC NET"
echo "remove cache data [to avoid wierd behaviour on gas estimation]"
rm -rf ./artifacts-zk
rm -rf ./cache-zk
yarn test --bail
echo "DONE"

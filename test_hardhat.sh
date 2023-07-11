#!/bin/bash
# zkSync local development setup from https://github.com/matter-labs/local-setup
# PATH_TO_LOCAL_SET_UP=~/local-setup
# run ./start.sh
clear
echo "TEST WITH HARDHAT - LOCAL ZK SYNC NET"
yarn test --grep "Auction" --bail
echo "DONE"

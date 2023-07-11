#!/bin/bash
# zkSync local development setup from https://github.com/matter-labs/local-setup
PATH_TO_LOCAL_SET_UP='~/local-setup'
clear
CWD=$(pwd)
echo "TEST WITH HARDHAT - LOCAL ZK SYNC NET"
( cd $PATH_TO_LOCAL_SET_UP && ./start.sh )
cd $CWD
yarn test
echo "DONE"

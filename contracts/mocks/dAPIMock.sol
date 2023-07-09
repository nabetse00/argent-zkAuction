
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;
import "@api3/contracts/v0.8/interfaces/IProxy.sol";

contract MyProxy is IProxy {

    address immutable ADDRESS;

    int224 public exchangeValue;
    constructor(int224 _value, address _addr){
        exchangeValue = _value;
        ADDRESS = _addr;
    }

    function read() external view returns (int224 value, uint32 timestamp){
        value = exchangeValue;
        timestamp = uint32(block.timestamp);
    }

    function api3ServerV1() external view returns (address){
        return ADDRESS;
    }

}
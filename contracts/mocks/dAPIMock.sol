import "@api3/contracts/v0.8/interfaces/IProxy.sol";

contract MyProxy is IProxy {

    int224 public exchangeValue;
    constructor(int224 _value){
        exchangeValue = _value;
    }

    function read() external view returns (int224 value, uint32 timestamp){
        value = exchangeValue;
        timestamp = uint32(block.timestamp);
    }

    function api3ServerV1() external view returns (address){
        return address(0);
    }

}
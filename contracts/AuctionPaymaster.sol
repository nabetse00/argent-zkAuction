// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPaymaster, ExecutionResult, PAYMASTER_VALIDATION_SUCCESS_MAGIC} 
from  "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import {IPaymasterFlow} from  "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import {TransactionHelper, Transaction} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@api3/contracts/v0.8/interfaces/IProxy.sol";

import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";

/**
 * @title AuctionPaymaster
 * @author Nabetse
 * @notice This contract only allow a list of contracts to call
 * @notice users must wait until COOL_DOWN_TIME has passed to use this paymaster
 * @notice This contract only allow USDC and DAI for fee payments
 * @notice Inspired by https://era.zksync.io/docs/dev/tutorials/api3-usd-paymaster-tutorial.html
 */
contract AuctionPaymaster is IPaymaster, Ownable {

    address[2] public allowedTokens;
    address public USDCdAPIProxy;
    address public DAIdAPIProxy;
    address public ETHdAPIProxy;
    uint256 public requiredETH;

    mapping(address => uint256) private usersCoolDowns;
    mapping(address => bool) private allowedContracts;

    uint256 public immutable  COOL_DOWN_TIME;

    event UpdateAllowedContracts(address _target, bool _allowed);

    modifier onlyBootloader() {
        require(
            msg.sender == BOOTLOADER_FORMAL_ADDRESS,
            "Only bootloader can call this method"
        );
        // Continue execution if called from the bootloader.
        _;
    }

    constructor(address _owner, address _usdc, address _dai, address _contract, uint256 _coolDownDuration) {
        require(_owner != address(0), "Zero address cannot be the owner");
        require(_contract != address(0), "Zero address cannot be an allowed contract");
        require(_coolDownDuration > 0, "Zero cooldown duration not allowed");
        _addToAllowedContracts(_contract);
        _transferOwnership(_owner);
        allowedTokens[0] = _usdc;
        allowedTokens[1] = _dai;
        COOL_DOWN_TIME = _coolDownDuration;
    }

    // Set dapi proxies for the allowed token/s
    function setDapiProxy(address _USDCproxy, address _DAIproxy,address _ETHproxy) 
    public onlyOwner {
        USDCdAPIProxy = _USDCproxy;
        ETHdAPIProxy = _ETHproxy;
        DAIdAPIProxy = _DAIproxy;
    }

    function readDapi(address _dapiProxy) public view returns (uint256) {
        (int224 value, ) = IProxy(_dapiProxy).read();
        uint256 price = uint224(value);
        return price;
    }

    function validateAndPayForPaymasterTransaction (
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) onlyBootloader external payable returns (bytes4 magic, bytes memory context) {
        // By default we consider the transaction as accepted.
        magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;
        // returns a empty context
        context = bytes("");
        require(
            _transaction.paymasterInput.length >= 4,
            "The standard paymaster input must be at least 4 bytes long"
        );

        bytes4 paymasterInputSelector = bytes4(
            _transaction.paymasterInput[0:4]
        );
        if (paymasterInputSelector == IPaymasterFlow.approvalBased.selector) {
            // While the transaction data consists of address, uint256 and bytes data,
            // the data is not needed for this paymaster
            (address token, uint256 amount, 
            //bytes memory data
            ) = abi.decode(
                _transaction.paymasterInput[4:],
                (address, uint256, bytes)
            );

            // Verify if token is the correct one
            require(token == allowedTokens[0] || token == allowedTokens[1], "Invalid token should be DAI or USDC");

            // We verify that the user has provided enough allowance
            // and COOL_DOWN_TIME
            address userAddress = address(uint160(_transaction.from));
            address targetContract = address(uint160(_transaction.to));
            require(allowedContracts[targetContract], "Contract Not allowed to use this paymaster");

            uint256 currentTime = block.timestamp;
            require( currentTime > usersCoolDowns[userAddress], "Transaction cool down not met");
            
            address thisAddress = address(this);

            uint256 providedAllowance = IERC20(token).allowance(
                userAddress,
                thisAddress
            );

            
            // Read values from the dAPIs
            uint256 ETHUSDPrice = readDapi(ETHdAPIProxy);
            uint256 TOKENUSDPrice;
            if( token == allowedTokens[0]){
                TOKENUSDPrice = readDapi(USDCdAPIProxy);
            } 
            if( token == allowedTokens[1]){
                TOKENUSDPrice = readDapi(DAIdAPIProxy);
            }

            requiredETH = _transaction.gasLimit *
                _transaction.maxFeePerGas;

            // Calculate the required ERC20 tokens to be sent to the paymaster
            // (Equal to the value of requiredETH)

            uint256 requiredERC20 = (requiredETH * ETHUSDPrice)/TOKENUSDPrice;
            
            //uint256 requiredERC20 = requiredETH; //* 2000e18)/10001e14;
            require(
                providedAllowance >= requiredERC20,
                "Min paying allowance too low"
            );

            // Note, that while the minimal amount of ETH needed is tx.gasPrice * tx.gasLimit,
            // neither paymaster nor account are allowed to access this context variable.
            try
                IERC20(token).transferFrom(userAddress, thisAddress, requiredERC20)
            {} catch (bytes memory revertReason) {
                // If the revert reason is empty or represented by just a function selector,
                // we replace the error with a more user-friendly message
                if (requiredERC20 > amount) {
                    revert("Not the required amount of tokens sent");
                }
                if (revertReason.length <= 4) {
                    revert("Failed to transferFrom from users' account");
                } else {
                    assembly {
                        revert(add(0x20, revertReason), mload(revertReason))
                    }
                }
            }

            // The bootloader never returns any data, so it can safely be ignored here.
            (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{
                value: requiredETH
            }("");
            require(success, "Failed to transfer funds to the bootloader");
            // update cool down timestamp
            usersCoolDowns[userAddress] = currentTime + COOL_DOWN_TIME;
        } else {
            revert("Unsupported paymaster flow");
        }
    }

    function postTransaction  (
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32,
        bytes32,
        ExecutionResult _txResult,
        uint256 _maxRefundedGas
    ) onlyBootloader external payable override {
    }

    receive() external payable {}

    function withdraw(address _to) external onlyOwner {
        // send paymaster funds to the owner
        (bool success, ) = payable(_to).call{value: address(this).balance}("");
        require(success, "Failed to withdraw funds from paymaster.");
        // send tokens
        uint256 bal0 = IERC20(allowedTokens[0]).balanceOf(address(this));
        success = IERC20(allowedTokens[0]).transfer(_to, bal0);
        require(success, "Failed to withdraw token0 funds from paymaster.");
        uint256 bal1 = IERC20(allowedTokens[1]).balanceOf(address(this));
        success = IERC20(allowedTokens[1]).transfer(_to, bal1);
        require(success, "Failed to withdraw token1 funds from paymaster.");
    }

    function removeFromAllowedContracts(address _contract) public onlyOwner {
        delete allowedContracts[_contract];
    }

    function addToAllowedContracts(address _contract) public onlyOwner() {
        _addToAllowedContracts(_contract);
    }

    function _addToAllowedContracts(address _contract) private onlyOwner() {
        allowedContracts[_contract] = true;
        emit UpdateAllowedContracts(_contract, true);
    }

    function getAllowedContracts(address _contract) public view returns(bool){
        return allowedContracts[_contract];
    }
}

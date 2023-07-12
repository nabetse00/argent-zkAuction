// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {IPaymaster, ExecutionResult, PAYMASTER_VALIDATION_SUCCESS_MAGIC} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import {IPaymasterFlow} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import {TransactionHelper, Transaction} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@api3/contracts/v0.8/interfaces/IProxy.sol";

import "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";

/**
 * @title AuctionPaymaster
 * @author Nabetse
 * @notice This contract only allow a list of contracts to call
 * @notice This contract only allow USDC and DAI for fee payments
 * @notice Inspired by https://era.zksync.io/docs/dev/tutorials/api3-usd-paymaster-tutorial.html
 */
contract AuctionPaymaster is IPaymaster, Ownable {
    address[2] public allowedTokens;
    address public USDCdAPIProxy;
    address public DAIdAPIProxy;
    address public ETHdAPIProxy;
    uint256 public requiredETH;

    mapping(address => bool) private allowedContracts;

    event UpdateAllowedContracts(address _target, bool _allowed);

    modifier onlyBootloader() {
        require(
            msg.sender == BOOTLOADER_FORMAL_ADDRESS,
            "Only bootloader can call this method"
        );
        // Continue execution if called from the bootloader.
        _;
    }

    modifier onlyOwnerOrAllowedContracts() {
        require(
            (msg.sender == owner()) || (allowedContracts[msg.sender]),
            "Only owner or allowed contracts can call this method"
        );
        // Continue execution if called from the bootloader.
        _;
    }

    /**
     * AuctionPaymaster 
     * @param _owner Owner address
     * @param _usdc USDC Token address
     * @param _dai DAI Token address
     * @param _contract Initial allowed contract 
     */
    constructor(
        address _owner,
        address _usdc,
        address _dai,
        address _contract
    ) {
        require(_owner != address(0), "Zero address cannot be the owner");
        require(
            _contract != address(0),
            "Zero address cannot be an allowed contract"
        );
        if (_contract != _owner) {
            _addToAllowedContracts(_contract);
        }
        _transferOwnership(_owner);
        allowedTokens[0] = _usdc;
        allowedTokens[1] = _dai;
    }

    /**
     * Sets Dapi proxys for USDC and DAI tokens.
     * @param _USDCproxy dapi USDC/USD proxi feed
     * @param _DAIproxy dapi DAI/USD proxi feed
     * @param _ETHproxy dapi ETH/USD proxi feed
     */
    function setDapiProxy(
        address _USDCproxy,
        address _DAIproxy,
        address _ETHproxy
    ) public onlyOwner {
        USDCdAPIProxy = _USDCproxy;
        ETHdAPIProxy = _ETHproxy;
        DAIdAPIProxy = _DAIproxy;
    }

    /**
     * Read Dapi proxy
     * @param _dapiProxy dApi proxi addresss
     */
    function readDapi(address _dapiProxy) public view returns (uint256) {
        (int224 value, ) = IProxy(_dapiProxy).read();
        uint256 price = uint224(value);
        return price;
    }

    function validateAndPayForPaymasterTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    )
        external
        payable
        onlyBootloader
        returns (bytes4 magic, bytes memory context)
    {
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
            (address token, uint256 amount, ) = //bytes memory data
            abi.decode(
                _transaction.paymasterInput[4:],
                (address, uint256, bytes)
            );

            // Verify if token is the correct one
            require(
                token == allowedTokens[0] || token == allowedTokens[1],
                "Invalid token should be DAI or USDC"
            );

            // We verify that the user has provided enough allowance
            address userAddress = address(uint160(_transaction.from));
            address targetContract = address(uint160(_transaction.to));
            require(
                allowedContracts[targetContract],
                "Contract Not allowed to use this paymaster"
            );

            address thisAddress = address(this);

            uint256 providedAllowance = IERC20(token).allowance(
                userAddress,
                thisAddress
            );

            // Read values from the dAPIs
            uint256 ETHUSDPrice = readDapi(ETHdAPIProxy);
            uint256 TOKENUSDPrice;
            if (token == allowedTokens[0]) {
                TOKENUSDPrice = readDapi(USDCdAPIProxy);
            }
            if (token == allowedTokens[1]) {
                TOKENUSDPrice = readDapi(DAIdAPIProxy);
            }

            requiredETH = _transaction.gasLimit * _transaction.maxFeePerGas;

            // Calculate the required ERC20 tokens to be sent to the paymaster
            // (Equal to the value of requiredETH) in TOKEN DECIMAL

            uint256 decimals = IERC20Metadata(token).decimals();

            uint256 requiredERC20 = ((requiredETH * ETHUSDPrice) *
                (10 ** decimals)) /
                (1 ether) /
                TOKENUSDPrice;

            //uint256 requiredERC20 = requiredETH; //* 2000e18)/10001e14;
            require(
                providedAllowance >= requiredERC20,
                "Min paying allowance too low"
            );

            // Note, that while the minimal amount of ETH needed is tx.gasPrice * tx.gasLimit,
            // neither paymaster nor account are allowed to access this context variable.
            try
                IERC20(token).transferFrom(
                    userAddress,
                    thisAddress,
                    requiredERC20
                )
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
        } else {
            revert("Unsupported paymaster flow");
        }
    }

    function postTransaction(
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32,
        bytes32,
        ExecutionResult _txResult,
        uint256 _maxRefundedGas
    ) external payable override onlyBootloader {}

    receive() external payable {}

    /**
     * Withdraw Dai and eth to given address
     * @param _to address to send founds to
     */
    function withdraw(address _to) external onlyOwner {
        require(
            _to != address(0),
            "[AuctionPaymaster] cannot withdraw to zero address"
        );
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

    /**
     * Removes a contract to allowed contract mappings
     * Only Owner or Other allowed contracts can call this method.
     * @param _contract contract to remove
     */
    function removeFromAllowedContracts(
        address _contract
    ) public onlyOwnerOrAllowedContracts {
        delete allowedContracts[_contract];
    }
    /**
     * Adds a contract to allowed contract mappings
     * Only Owner or Other allowed contracts can call this method.
     * @param _contract contract to add
     */
    function addToAllowedContracts(
        address _contract
    ) public onlyOwnerOrAllowedContracts {
        _addToAllowedContracts(_contract);
    }

    function _addToAllowedContracts(address _contract) private {
        allowedContracts[_contract] = true;
        emit UpdateAllowedContracts(_contract, true);
    }
    /**
     * Get contract status
     * @param _contract address for contract to look up
     */
    function getAllowedContracts(address _contract) public view returns (bool) {
        return allowedContracts[_contract];
    }
}

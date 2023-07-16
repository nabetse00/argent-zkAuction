// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Auction, IAuction} from "./Auction.sol";
import {ZkSyncAuctionItems} from "./AuctionItems.sol";
import {AuctionPaymaster} from "./AuctionPaymaster.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Auction Factory
 * @author Nabetse
 * @notice This is contract must be in paymaster allowed list.
 * @notice On createAuction Adds new Auctions to paymaster allowed list.
 * @notice A flat fee is applied when creating an Auction.
 * @notice transfers items as ERC721 tokens to auction
 */
contract AuctionFactory is IAuction, ERC721Holder, Ownable {
    address public immutable USDC_ADDR;
    address public immutable DAI_ADDR;
    address public immutable AUCTION_ITEMS_ADDR;
    address payable public immutable PAYMASTER;
    uint256 public constant FLAT_FEE = 0.5 ether;

    Auction[] public auctions;

    event AuctionCreated(
        Auction auctionContract,
        address owner,
        uint numAuctions
    );

    /**
     * Create Auction Factory
     * @param _usdToken USD token address
     * @param _daiToken DAI token adress
     * @param paymaster paymaster address
     * @param factoryOwner factory owner
     */
    constructor(
        address _usdToken,
        address _daiToken,
        address payable paymaster,
        address factoryOwner
    ) {
        USDC_ADDR = _usdToken;
        DAI_ADDR = _daiToken;
        AUCTION_ITEMS_ADDR = address(new ZkSyncAuctionItems());
        PAYMASTER = paymaster;
        _transferOwnership(factoryOwner);
    }

    function createAuction(
        address _bidToken,
        address _itemOwner,
        string memory itemUri,
        uint256 _startingPrice,
        uint256 _buyItNowPrice,
        uint256 _duration
    ) public {
        require(
            _bidToken == USDC_ADDR || _bidToken == DAI_ADDR,
            "[Auction Factory] Token for auction must be USDC or DAI"
        );

        // tranfer flat fee
        IERC20(_bidToken).transferFrom(
            msg.sender,
            address(this),
            _valueToTokens(_bidToken, FLAT_FEE)
        );

        // mint a token
        uint256 _itemTokenId = ZkSyncAuctionItems(AUCTION_ITEMS_ADDR).safeMint(
            address(this),
            itemUri
        );

        AuctionConfig memory _config = AuctionConfig(
            _itemOwner,
            0,
            0,
            _startingPrice,
            _buyItNowPrice,
            _itemTokenId
        );

        Auction newAuction = new Auction(
            _bidToken,
            AUCTION_ITEMS_ADDR,
            _duration,
            _config
        );

        // transfer item
        ZkSyncAuctionItems(AUCTION_ITEMS_ADDR).safeTransferFrom(
            address(this),
            address(newAuction),
            _config.itemTokenId
        );

        // adds auction to paymaster
        AuctionPaymaster(PAYMASTER).addToAllowedContracts(address(newAuction));

        auctions.push(newAuction);

        emit AuctionCreated(newAuction, msg.sender, auctions.length);
    }

    function getAuctions() public view returns (Auction[] memory) {
        return auctions;
    }

    function withdrawFees(
        address payable receiver
    ) public onlyOwner {
        require(receiver != address(0));
        uint256 bal = IERC20Metadata(USDC_ADDR).balanceOf(address(this));
        if (bal > 0) {
            bool success = IERC20Metadata(USDC_ADDR).transfer(receiver, bal);
            require(success, "[Auction Factory] Withdraw Fees Failed to send DAI");
        }
        bal = IERC20Metadata(DAI_ADDR).balanceOf(address(this));
        if (bal > 0) {
            bool success = IERC20Metadata(DAI_ADDR).transfer( receiver, bal);
            require(success, "[Auction Factory] Withdraw Fees Failed to send DAI");
        }
        bal = address(this).balance;
        if (bal > 0) {
            (bool sent, ) = receiver.call{value: bal}("");
            require(sent, "[Auction] Rescue Failed to send Ether");
        }
    }

    function _valueToTokens(
        address bidToken,
        uint256 valueInEth
    ) internal view returns (uint256) {
        return
            (valueInEth * 10 ** (IERC20Metadata(bidToken).decimals())) /
            1 ether;
    }
}

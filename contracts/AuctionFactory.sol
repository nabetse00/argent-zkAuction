// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import {Auction, IAuction} from "./Auction.sol";
import {ZkSyncAuctionItems} from "./AuctionItems.sol";

contract AuctionFactory is IAuction {
    address public immutable USDC_ADDR;
    address public immutable DAI_ADDR;
    address public immutable AUCTION_ITEMS_ADDR;

    Auction[] public auctions;

    event AuctionCreated(
        Auction auctionContract,
        address owner,
        uint numAuctions
    );

    constructor(address _usdToken, address _daiToken) {
        USDC_ADDR = _usdToken;
        DAI_ADDR = _daiToken;
        AUCTION_ITEMS_ADDR = address(new ZkSyncAuctionItems());
    }

    function createAuction(
        address _bidToken,
        uint256 _startingPrice,
        uint256 _buyItNowPrice,
        uint256 _duration,
        uint256 _itemTokenId
    ) public {
        require(_bidToken == USDC_ADDR || _bidToken == DAI_ADDR, "Token for auction must be USDC or DAI");
        AuctionConfig memory _config = AuctionConfig(
            msg.sender,
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

        auctions.push(newAuction);

        emit AuctionCreated(newAuction, msg.sender, auctions.length);
    }

    function removeAuction(Auction _auction) public returns (bool) {
        require(address(_auction) != address(0), "Zero address cannot be removed");
        require(_auction.auctionStatus() == AuctionStatus.DELETABLE, "Can NOT delete Auction with NOT DELETABLE status");
        (bool isFound, uint256 index) = _findAuctionIndex(address(_auction));
        if (!isFound) {
            return false;
        }

        auctions[index] = auctions[auctions.length - 1];
        auctions.pop();
        return true;
    }

    function getAuctions() public view returns (Auction[] memory) {
        return auctions;
    }

    function _findAuctionIndex(
        address _auction
    ) internal view returns (bool, uint256) {
        // find auction index
        for (uint256 i = 0; i < auctions.length; i++) {
            if (_auction == address(auctions[i])) {
                return (true, i);
            }
        }
        return (false, 0);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Auction, IAuction} from "./Auction.sol";
import {ZkSyncAuctionItems} from "./AuctionItems.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

contract AuctionFactory is IAuction, ERC721Holder {
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

        auctions.push(newAuction);

        emit AuctionCreated(newAuction, msg.sender, auctions.length);
    }

    function getAuctions() public view returns (Auction[] memory) {
        return auctions;
    }
}

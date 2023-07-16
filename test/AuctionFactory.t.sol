// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/AuctionFactory.sol";
import "../contracts/Auction.sol";
import "../contracts/AuctionItems.sol";
import "../contracts/AuctionPaymaster.sol";
import "../contracts/mocks/ERC20.sol";
import "forge-std/console2.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

contract AuctionFactoryTest is Test, ERC721Holder {
    uint256 constant MIN_AUCTION_DURATION = 1 hours;
    uint256 constant MAX_AUCTION_DURATION = 7 days;
    uint256 constant MIN_STARTING_PRICE = 0.01 ether;
    uint256 public constant FLAT_FEE_USDC = 0.5 ether * 10 ** (6 - 18);
    uint256 public constant FLAT_FEE_DAI = 0.5 ether;

    MyERC20 usdc;
    MyERC20 dai;
    ZkSyncAuctionItems auctionItems;
    AuctionPaymaster paymaster;
    address owner = address(98);

    uint256[] itemsIds;

    AuctionFactory auctionFactory;
    address itemOwner = address(99);

    event AuctionCreated(
        Auction auctionContract,
        address owner,
        uint numAuctions
    );

    function setUp() public {
        // set up a USDC mock token to bid on
        usdc = new MyERC20("USDC Mock", "USDC", 6);
        dai = new MyERC20("DAI Mock", "DAI", 18);
        auctionItems = new ZkSyncAuctionItems();
        // console2.log("Auction NFT address [", address(auctionItems), "]");
        // console2.log("Mock USDC address [", address(bidToken), "]");
        uint256 itemId = auctionItems.safeMint(address(this), "item1.json");
        // console2.log("Item created [", itemId, "]");
        // console2.log("Item URI is [", auctionItems.tokenURI(itemId), "]");
        itemsIds.push(itemId);
        itemId = auctionItems.safeMint(msg.sender, "item2.json");
        itemsIds.push(itemId);

        paymaster = new AuctionPaymaster(address(this), address(usdc), address(dai), address(this));

        auctionFactory = new AuctionFactory(address(usdc), address(dai), payable(address(paymaster)), address(this));
        paymaster.addToAllowedContracts(address(auctionFactory));
        assertEq(auctionFactory.USDC_ADDR(), address(usdc));
        assertEq(auctionFactory.DAI_ADDR(), address(dai));
        assertNotEq(auctionFactory.AUCTION_ITEMS_ADDR(), address(0));
    }

    function test_createAuction(
        uint _bidTokenSel,
        uint256 _duration,
        uint256 _startingPrice,
        uint256 _buyItNowPrice
    ) public {
        address bidToken;
        uint256 fee;
        if (_bidTokenSel % 2 == 0) {
            bidToken = address(usdc);
            fee = FLAT_FEE_USDC;
        } else {
            bidToken = address(dai);
            fee = FLAT_FEE_DAI;
        }

        uint256 tenPowDecimals = 10 ** (MyERC20(bidToken).decimals());
        address _itemOwner = itemOwner;
        string memory itemUri = "item.json";
        _duration = bound(
            _duration,
            MIN_AUCTION_DURATION,
            MAX_AUCTION_DURATION
        );
        _startingPrice = bound(
            _startingPrice,
            (MIN_STARTING_PRICE * tenPowDecimals) / 1 ether,
            (1 ether * tenPowDecimals) / 1 ether
        );
        _buyItNowPrice = bound(
            _buyItNowPrice,
            _startingPrice * 100,
            _startingPrice * 200
        );

        // approve auction Factory for fees
        MyERC20(bidToken).mint(address(this), fee);
        MyERC20(bidToken).approve(address(auctionFactory), fee);
        auctionFactory.createAuction(
            bidToken,
            _itemOwner,
            itemUri,
            _startingPrice,
            _buyItNowPrice,
            _duration
        );
        Auction[] memory auctions = auctionFactory.getAuctions();
        assertEq(auctions.length, 1);
        // check item is correct
        Auction auction = auctions[0];
        assertNotEq(address(auction), address(0));
        assertEq(address(auction.bidToken()), bidToken);
        (
            address cfg_owner,
            uint256 cfg_startTimestamp,
            uint256 cfg_endTimestamp,
            uint256 cfg_startingPrice,
            uint256 cfg_buyItNowPrice,
            uint256 cfg_itemTokenId
        ) = auction.config();

        assertEq(cfg_startTimestamp, block.timestamp);
        assertEq(cfg_endTimestamp, block.timestamp + _duration);
        assertEq(cfg_owner, _itemOwner);
        assertEq(cfg_startingPrice, _startingPrice);
        assertEq(cfg_buyItNowPrice, _buyItNowPrice);
        address owener_of_item = ZkSyncAuctionItems(
            auctionFactory.AUCTION_ITEMS_ADDR()
        ).ownerOf(cfg_itemTokenId);
        assertEq(owener_of_item, address(auction));

        uint256 oldBal = MyERC20(bidToken).balanceOf(address(this));
        auctionFactory.withdrawFees(payable(address(this)));
        uint256 newBal = MyERC20(bidToken).balanceOf(address(this));

        assertEq(newBal - oldBal, fee);
    }

    function test_invalid_createAuction(
        uint8 decimals,
        uint256 _duration,
        uint256 _startingPrice,
        uint256 _buyItNowPrice
    ) public {
        decimals = uint8(bound(decimals, 6, 18));
        address bidToken = address(new MyERC20("OTHER Mock", "DAI", decimals));
        vm.assume(bidToken != address(usdc));
        vm.assume(bidToken != address(dai));
        uint256 tenPowDecimals = 10 ** (MyERC20(bidToken).decimals());
        address _itemOwner = itemOwner;
        string memory itemUri = "item.json";
        _duration = bound(
            _duration,
            MIN_AUCTION_DURATION,
            MAX_AUCTION_DURATION
        );
        _startingPrice = bound(
            _startingPrice,
            (MIN_STARTING_PRICE * tenPowDecimals) / 1 ether,
            (1 ether * tenPowDecimals) / 1 ether
        );
        _buyItNowPrice = bound(
            _buyItNowPrice,
            _startingPrice * 100,
            _startingPrice * 200
        );
        vm.expectRevert(
            "[Auction Factory] Token for auction must be USDC or DAI"
        );
        auctionFactory.createAuction(
            bidToken,
            _itemOwner,
            itemUri,
            _startingPrice,
            _buyItNowPrice,
            _duration
        );
        vm.expectRevert("ERC20: insufficient allowance");
        auctionFactory.createAuction(
            address(usdc),
            _itemOwner,
            itemUri,
            _startingPrice,
            _buyItNowPrice,
            _duration
        );
        usdc.mint(address(this), FLAT_FEE_USDC);
        usdc.approve(address(auctionFactory), FLAT_FEE_USDC);
        auctionFactory.createAuction(
            address(usdc),
            _itemOwner,
            itemUri,
            _startingPrice,
            _buyItNowPrice,
            _duration
        );
        assertNotEq(address(auctionFactory.getAuctions()[0]), address(0));

        // withdraw founds



    }
}

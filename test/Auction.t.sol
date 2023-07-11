// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/Auction.sol";
import "../contracts/AuctionItems.sol";
import "../contracts/mocks/ERC20.sol";
import "forge-std/console2.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

contract AuctionTest is Test, IAuction, ERC721Holder {
    // constants
    uint256 constant MIN_AUCTION_DURATION = 1 hours;
    uint256 constant MAX_AUCTION_DURATION = 7 days;
    uint256 constant MIN_STARTING_PRICE = 0.01 ether;
    uint256 constant DECIMALS = 6;
    uint256 constant DECICMALS_POW10 = 1e6;

    uint256 testNumber;
    MyERC20 bidToken;
    ZkSyncAuctionItems auctionItems;

    uint256[] itemsIds;

    event BidEvent(
        address bidder,
        uint256 bid,
        address highestBidder,
        uint256 highestBid,
        uint highestBindingBid
    );

    event BuytItNowEvent(address bider);

    function setUp() public {
        // set up a USDC mock token to bid on
        bidToken = new MyERC20("USDC Mock", "USDC", 6);
        auctionItems = new ZkSyncAuctionItems();
        // console2.log("Auction NFT address [", address(auctionItems), "]");
        // console2.log("Mock USDC address [", address(bidToken), "]");
        uint256 itemId = auctionItems.safeMint(address(this), "item1.json");
        // console2.log("Item created [", itemId, "]");
        // console2.log("Item URI is [", auctionItems.tokenURI(itemId), "]");
        itemsIds.push(itemId);
        itemId = auctionItems.safeMint(msg.sender, "item2.json");
        itemsIds.push(itemId);
    }

    function makeAuction(
        address owner,
        uint256 _startingPrice,
        uint256 _buyItNowPrice,
        uint256 _duration
    ) public returns (Auction) {
        AuctionConfig memory _config = AuctionConfig(
            owner,
            0,
            0,
            _startingPrice,
            _buyItNowPrice,
            itemsIds[0]
        );

        Auction auction = new Auction(
            address(bidToken),
            address(auctionItems),
            _duration,
            _config
        );

        auctionItems.safeTransferFrom(
            address(this),
            address(auction),
            itemsIds[0]
        );

        return auction;
    }

    function test_constructor(
        uint256 _startingPrice,
        uint256 _buyItNowPrice,
        uint256 _duration
    ) public {
        //invalid duration use bound to avoid fuzz.max_test_rejects
        if (_duration % 2 == 0) {
            _duration = bound(_duration, 0, MIN_AUCTION_DURATION - 1);
        } else {
            _duration = bound(
                _duration,
                MAX_AUCTION_DURATION + 1,
                MAX_AUCTION_DURATION + 1 ** 10
            );
        }
        // valid rest
        _startingPrice = bound(
            _startingPrice,
            (MIN_STARTING_PRICE * DECICMALS_POW10) / 1 ether,
            (1 ether * DECICMALS_POW10) / 1 ether
        );
        _buyItNowPrice = bound(
            _buyItNowPrice,
            _startingPrice + 1,
            _startingPrice * 2
        );
        AuctionConfig memory _config = AuctionConfig(
            msg.sender,
            0,
            0,
            _startingPrice,
            _buyItNowPrice,
            itemsIds[0]
        );

        // make a new Auction
        vm.expectRevert("[Auction] Auction duration outside allowed values");
        Auction auction = new Auction(
            address(bidToken),
            address(auctionItems),
            _duration,
            _config
        );

        _duration = bound(
            _duration,
            MIN_AUCTION_DURATION,
            MAX_AUCTION_DURATION
        );
        vm.expectRevert("[Auction] Token for bids cannot be zero address");
        auction = new Auction(
            address(0),
            address(auctionItems),
            _duration,
            _config
        );

        vm.expectRevert(
            "[Auction] Auction items for bids cannot be zero address"
        );
        auction = new Auction(
            address(bidToken),
            address(0),
            _duration,
            _config
        );

        vm.expectRevert(
            "[Auction] Auction items for bids cannot be zero address"
        );
        auction = new Auction(
            address(bidToken),
            address(0),
            _duration,
            _config
        );

        _config.startingPrice = 0;
        vm.expectRevert(
            "[Auction] Bid starting price cannot be bellow MIN_STARTING_PRICE"
        );
        auction = new Auction(
            address(bidToken),
            address(auctionItems),
            _duration,
            _config
        );

        _config.startingPrice = _startingPrice;
        _config.buyItNowPrice = _startingPrice;
        vm.expectRevert(
            "[Auction] Buy it now price must be greater than starting price"
        );
        auction = new Auction(
            address(bidToken),
            address(auctionItems),
            _duration,
            _config
        );

        _config.startingPrice = _startingPrice;
        _config.buyItNowPrice = _buyItNowPrice;
        _config.itemTokenId = itemsIds[1];
        vm.expectRevert("[Auction] sender must be the owner of the token");
        auction = new Auction(
            address(bidToken),
            address(auctionItems),
            _duration,
            _config
        );

        _config.itemTokenId = itemsIds[0];
        auction = new Auction(
            address(bidToken),
            address(auctionItems),
            _duration,
            _config
        );
        assertNotEq(address(auction), address(0));
        (
            address owner,
            uint256 startTimestamp,
            uint256 endTimestamp,
            uint256 startingPrice,
            uint256 buyItNowPrice,
            uint256 itemTokenId
        ) = auction.config();
        assertEq(startTimestamp, block.timestamp);
        assertEq(endTimestamp, block.timestamp + _duration);
        assertEq(itemTokenId, itemsIds[0]);
        assertEq(owner, msg.sender);
        assertEq(startingPrice, _startingPrice);
        assertEq(buyItNowPrice, _buyItNowPrice);
    }

    function test_PlaceBid_Initial_Values(
        uint256 _startingPrice,
        uint256 _buyItNowPrice,
        uint256 _duration,
        address _owner,
        address _bidder
    ) public {
        vm.assume(_bidder != address(0));
        vm.assume(_bidder != address(this));
        vm.assume(_bidder != _owner);
        vm.assume(_owner != address(0));
        vm.assume(_owner != address(this));
        _duration = bound(
            _duration,
            MIN_AUCTION_DURATION,
            MAX_AUCTION_DURATION
        );
        _startingPrice = bound(
            _startingPrice,
            (MIN_STARTING_PRICE * DECICMALS_POW10) / 1 ether,
            (1 ether * DECICMALS_POW10) / 1 ether
        );
        _buyItNowPrice = bound(
            _buyItNowPrice,
            _startingPrice * 100,
            _startingPrice * 200
        );

        Auction auction = makeAuction(
            _owner,
            _startingPrice,
            _buyItNowPrice,
            _duration
        );
        assertNotEq(address(auction), address(0));

        uint256 _tokenAmount = 0;

        vm.expectRevert("[Auction] bidder cannot be zero address");
        auction.placeBid(address(0), _tokenAmount);

        vm.expectRevert("[Auction] Cannot bid for 0 tokens");
        auction.placeBid(_bidder, _tokenAmount);

        uint256 increment = auction.getMinimalIncrementTokens();
        _tokenAmount = increment;
        vm.expectRevert("ERC20: insufficient allowance");
        auction.placeBid(_bidder, _tokenAmount);

        setUpToken(address(auction), _bidder, _tokenAmount);

        vm.expectRevert("[Auction] owner cannot bid");
        auction.placeBid(_owner, _tokenAmount);

        _tokenAmount = _startingPrice - 1;

        vm.expectRevert();
        auction.placeBid(_bidder, _tokenAmount);

        _tokenAmount = increment - 1;
        vm.expectRevert();
        auction.placeBid(_bidder, _tokenAmount);

        _tokenAmount = increment;
        vm.expectEmit(address(auction));
        emit BidEvent(
            _bidder,
            _tokenAmount,
            _bidder,
            _tokenAmount,
            _tokenAmount
        );
        auction.placeBid(_bidder, _tokenAmount);

        increment = auction.getMinimalIncrementTokens();
        uint256 _tokenAmount2 = increment;
        setUpToken(address(auction), _bidder, _tokenAmount2);
        console2.log("=====> initila values 2");
        vm.expectEmit(address(auction));
        emit BidEvent(
            _bidder,
            _tokenAmount + _tokenAmount2,
            _bidder,
            _tokenAmount + _tokenAmount2,
            _tokenAmount
        );
        auction.placeBid(_bidder, _tokenAmount2);
    }

    function test_PlaceBid_BuyitNow_Flow(uint256 _duration) public {
        uint256 _startingPrice = 10 * DECICMALS_POW10;
        uint256 _buyItNowPrice = 3 * _startingPrice;
        address _owner = address(3);
        address _bider1 = address(4);
        address _bider2 = address(5);
        vm.assume(_bider1 != address(0));
        vm.assume(_bider1 != _owner);
        vm.assume(_owner != address(0));
        _duration = bound(
            _duration,
            MIN_AUCTION_DURATION,
            MAX_AUCTION_DURATION
        );

        Auction auction = makeAuction(
            _owner,
            _startingPrice,
            _buyItNowPrice,
            _duration
        );
        assertNotEq(address(auction), address(0));

        // bidder 1: place a bid for starting price
        uint256 b1_amount = _startingPrice;
        setUpToken(address(auction), _bider1, b1_amount);
        checkTokenBal(_bider1, b1_amount);
        vm.expectEmit(address(auction));
        emit BidEvent(
            _bider1,
            _startingPrice,
            _bider1,
            _startingPrice,
            _startingPrice
        );
        auction.placeBid(_bider1, b1_amount);
        // check state
        checkTokenBal(_bider1, 0);
        checkTokenBal(address(auction), b1_amount);
        checkHigeshtBid(auction, _startingPrice);
        checkHigeshtBidder(auction, _bider1);
        checkHigeshtBindingBid(auction, _startingPrice);
        checkBidderBid(auction, _bider1, _startingPrice);
        checkBidderBid(auction, _bider2, 0);
        uint256 highestBid = _startingPrice;
        uint256 b1_highestBid = _startingPrice;
        uint256 b1_highestBindingBid = _startingPrice;

        // bidder 1: raise bid for starting price + 10%
        b1_amount = (_startingPrice * 10) / 100;
        setUpToken(address(auction), _bider1, b1_amount);
        checkTokenBal(_bider1, b1_amount);
        highestBid += b1_amount;
        b1_highestBid += b1_amount;
        console2.log("T1");
        vm.expectEmit(address(auction));
        emit BidEvent(
            _bider1,
            highestBid,
            _bider1,
            b1_highestBid,
            b1_highestBindingBid // doesn t change same bider
        );
        auction.placeBid(_bider1, b1_amount);
        // check state
        checkTokenBal(_bider1, 0);
        checkTokenBal(address(auction), b1_highestBid);
        checkHigeshtBid(auction, highestBid);
        checkHigeshtBidder(auction, _bider1);
        checkHigeshtBindingBid(auction, b1_highestBindingBid);
        checkBidderBid(auction, _bider1, b1_highestBid);
        checkBidderBid(auction, _bider2, 0);

        // bidder 2: raise to 2x stating price
        uint256 b2_amount = _startingPrice * 2;
        setUpToken(address(auction), _bider2, b2_amount);
        checkTokenBal(_bider2, b2_amount);
        highestBid = b2_amount;
        uint256 increment = auction.getMinimalIncrementTokens();
        uint256 b2_highestBid = b2_amount;
        uint256 b2_highestBindingBid = b1_highestBid + increment;
        console2.log("T2");
        vm.expectEmit(address(auction));
        emit BidEvent(
            _bider2,
            highestBid,
            _bider2,
            b2_highestBid,
            b2_highestBindingBid
        );
        auction.placeBid(_bider2, b2_amount);
        checkTokenBal(_bider1, 0);
        checkTokenBal(_bider2, 0);
        checkTokenBal(address(auction), b1_highestBid + b2_highestBid);
        checkHigeshtBid(auction, highestBid);
        checkHigeshtBidder(auction, _bider2);
        checkHigeshtBindingBid(auction, b2_highestBindingBid);
        checkBidderBid(auction, _bider1, b1_highestBid);
        checkBidderBid(auction, _bider2, b2_highestBid);

        // bidder 1: raise up to (2x starting price) * 80%
        increment = auction.getMinimalIncrementTokens();
        b1_amount = ((b2_highestBid * 8) / 10 - b1_highestBid);
        setUpToken(address(auction), _bider1, b1_amount);
        checkTokenBal(_bider1, b1_amount);
        b1_highestBid += b1_amount;
        console2.log("T2");
        vm.expectEmit(address(auction));
        emit BidEvent(
            _bider1,
            b1_highestBid,
            _bider2,
            b2_highestBid,
            b1_highestBid + increment // increased binding bid
        );
        b2_highestBindingBid = b1_highestBid + increment;
        auction.placeBid(_bider1, b1_amount);
        checkTokenBal(_bider1, 0);
        checkTokenBal(_bider2, 0);
        checkTokenBal(address(auction), b1_highestBid + b2_highestBid);
        checkHigeshtBid(auction, highestBid);
        checkHigeshtBidder(auction, _bider2);
        checkHigeshtBindingBid(auction, b2_highestBindingBid);
        checkBidderBid(auction, _bider1, b1_highestBid);
        checkBidderBid(auction, _bider2, b2_highestBid);

        // bidder 1: raise up to (2x starting price) * 99%
        // setting bidder2 binding bid to is highest bid
        increment = auction.getMinimalIncrementTokens();
        b1_amount = (b2_highestBid * 99) / 100 - b1_highestBid;
        setUpToken(address(auction), _bider1, b1_amount);
        checkTokenBal(_bider1, b1_amount);
        b1_highestBid += b1_amount;
        console2.log("T3");
        vm.expectEmit(address(auction));
        emit BidEvent(
            _bider1,
            b1_highestBid,
            _bider2,
            b2_highestBid,
            b2_highestBid
        );
        b2_highestBindingBid = b2_highestBid;
        auction.placeBid(_bider1, b1_amount);
        checkTokenBal(_bider1, 0);
        checkTokenBal(_bider2, 0);
        checkTokenBal(address(auction), b1_highestBid + b2_highestBid);
        checkHigeshtBid(auction, highestBid);
        checkHigeshtBidder(auction, _bider2);
        checkHigeshtBindingBid(auction, b2_highestBindingBid);
        checkBidderBid(auction, _bider1, b1_highestBid);
        checkBidderBid(auction, _bider2, b2_highestBid);

        // bidder 1: raise up to buyItNow price
        // canceling the Auction

        b1_amount = _buyItNowPrice - b1_highestBid;
        setUpToken(address(auction), _bider1, b1_amount);
        checkTokenBal(_bider1, b1_amount);
        b1_highestBid += b1_amount;
        highestBid = b1_highestBid;
        vm.expectEmit(address(auction));
        emit BuytItNowEvent(_bider1);
        auction.placeBid(_bider1, b1_amount);
        checkTokenBal(_bider1, 0);
        checkTokenBal(_bider2, 0);
        checkTokenBal(address(auction), b1_highestBid + b2_highestBid);
        checkHigeshtBid(auction, highestBid);
        checkHigeshtBidder(auction, _bider1);
        checkHigeshtBindingBid(auction, b1_highestBid);
        checkBidderBid(auction, _bider1, b1_highestBid);
        checkBidderBid(auction, _bider2, b2_highestBid);
        checkAuctionStatus(auction, AuctionStatus.ENDED);

        // test can t place a new bid
        address other = address(6);
        uint256 other_amount = _buyItNowPrice * 10;
        setUpToken(address(auction), other, other_amount);
        checkTokenBal(other, other_amount);
        vm.expectRevert("[Auction] Only not ended");
        auction.placeBid(other, other_amount);
        checkTokenBal(other, other_amount);

        // test withdraw

        vm.startPrank(other);
        bool result = auction.withdrawAll();
        assertEq(result, true);
        vm.stopPrank();

        checkTokenBal(address(auction), 0);
        checkTokenBal(_bider1, 0);
        checkTokenBal(_bider2, b2_highestBid);
        checkTokenBal(_owner, b1_highestBid);
        checkAuctionItemOwner(auction, _bider1);

        // re withdraw should not revert
        result = auction.withdrawAll();
        assertEq(result, true);
    }

    function test_No_bider_End_Withdraw(
        uint256 _value,
        uint256 _duration
    ) public {
        // make auction
        _value = bound(_value, 1, 10000);
        uint256 startingPrice = _value * DECICMALS_POW10;
        uint256 buyItNowPrice = 3 * startingPrice;
        address owner = address(11);
        _duration = bound(
            _duration,
            MIN_AUCTION_DURATION,
            MAX_AUCTION_DURATION
        );

        Auction auction = makeAuction(
            owner,
            startingPrice,
            buyItNowPrice,
            _duration
        );
        assertNotEq(address(auction), address(0));
        checkAuctionStatus(auction, AuctionStatus.ON_GOING);

        // can't whitdraw
        vm.prank(owner);
        vm.expectRevert("[Auction] Only Ended or Canceled");
        auction.withdraw();

        vm.expectRevert("[Auction] Only Ended or Canceled");
        auction.withdrawAll();

        skip(_duration); // block.timestamp =  end
        // still can t withdraw
        vm.expectRevert("[Auction] Only Ended or Canceled");
        auction.withdraw();

        vm.expectRevert("[Auction] Only Ended or Canceled");
        auction.withdrawAll();

        skip(1); // block.timestamp =  end + duration + 1

        // can t place a bid
        address bider = address(12);
        uint256 amount = buyItNowPrice;
        setUpToken(address(auction), bider, amount);
        checkTokenBal(bider, amount);
        vm.expectRevert("[Auction] Only before end");
        auction.placeBid(bider, amount);

        // can t cancel
        vm.expectRevert("[Auction] Only owner");
        auction.cancelAuction();
        vm.startPrank(owner);
        vm.expectRevert("[Auction] Only before end");
        auction.cancelAuction();
        vm.stopPrank();

        // withdraw should work
        checkTokenBal(address(auction), 0);
        checkTokenBal(bider, amount);
        checkTokenBal(owner, 0);
        checkAuctionItemOwner(auction, address(auction));
        auction.withdrawAll();
        checkAuctionItemOwner(auction, owner);
    }

    function test_Cancelled_Auction(uint256 _value, uint256 _duration) public {
        // make auction
        _value = bound(_value, 1, 10000);
        uint256 startingPrice = _value * DECICMALS_POW10;
        uint256 buyItNowPrice = 3 * startingPrice;
        address owner = address(21);
        _duration = bound(
            _duration,
            MIN_AUCTION_DURATION,
            MAX_AUCTION_DURATION
        );

        Auction auction = makeAuction(
            owner,
            startingPrice,
            buyItNowPrice,
            _duration
        );
        assertNotEq(address(auction), address(0));
        checkAuctionStatus(auction, AuctionStatus.ON_GOING);

        // place a bid
        // can t place a bid
        address bider = address(22);
        uint256 amount = buyItNowPrice - 1;
        setUpToken(address(auction), bider, amount);
        checkTokenBal(bider, amount);
        auction.placeBid(bider, amount);
        checkTokenBal(bider, 0);
        checkTokenBal(address(auction), amount);
        checkTokenBal(owner, 0);
        checkAuctionItemOwner(auction, address(auction));

        // can't whitdraw
        vm.prank(owner);
        vm.expectRevert("[Auction] Only Ended or Canceled");
        auction.withdraw();

        vm.expectRevert("[Auction] Only Ended or Canceled");
        auction.withdrawAll();

        skip(_duration); // block.timestamp =  end
        // still can t withdraw
        vm.expectRevert("[Auction] Only Ended or Canceled");
        auction.withdraw();

        vm.expectRevert("[Auction] Only Ended or Canceled");
        auction.withdrawAll();

        vm.prank(owner);
        auction.cancelAuction();

        // can t bid
        address new_bider = address(23);
        uint256 new_amount = buyItNowPrice*2;
        setUpToken(address(auction), new_bider, new_amount);
        checkTokenBal(new_bider, new_amount);
        vm.expectRevert("[Auction] Only not canceled");
        auction.placeBid(new_bider, new_amount);
        checkTokenBal(new_bider, new_amount);
        checkTokenBal(address(auction), amount);
        checkTokenBal(owner, 0);
        checkAuctionItemOwner(auction, address(auction));

        auction.withdrawAll();
        checkTokenBal(bider, amount);
        checkTokenBal(address(auction), 0);
        checkTokenBal(owner, 0);
        checkAuctionItemOwner(auction, owner);
    }

    /// helpers
    function setUpToken(
        address auction,
        address _bidder,
        uint256 _tokenAmount
    ) public {
        bidToken.mint(_bidder, _tokenAmount);
        vm.startPrank(_bidder);
        bidToken.approve(address(auction), _tokenAmount);
        vm.stopPrank();
    }

    function checkTokenBal(address addr, uint256 value) internal {
        uint256 bal = bidToken.balanceOf(addr);
        assertEq(bal, value);
    }

    function checkHigeshtBidder(Auction auction, address expected) internal {
        address bider = auction.highestBidder();
        assertEq(bider, expected);
    }

    function checkHigeshtBid(Auction auction, uint256 expected) internal {
        uint256 bid = auction.fundsByBidder(auction.highestBidder());
        assertEq(bid, expected);
    }

    function checkHigeshtBindingBid(
        Auction auction,
        uint256 expected
    ) internal {
        uint256 bid = auction.highestBindingBid();
        assertEq(bid, expected);
    }

    function checkBidderBid(
        Auction auction,
        address bider,
        uint256 expected
    ) internal {
        uint256 bid = auction.fundsByBidder(bider);
        assertEq(bid, expected);
    }

    function checkAuctionItemOwner(
        Auction auction,
        address expected_owner
    ) internal {
        address items = address(auction.auctionItems());
        (, , , , , uint256 itemTokenId) = auction.config();
        address current_owner = ZkSyncAuctionItems(items).ownerOf(itemTokenId);
        assertEq(current_owner, expected_owner);
    }

    function checkAuctionStatus(
        Auction auction,
        AuctionStatus expected
    ) public {
        uint256 status = uint256(auction.auctionStatus());
        assertEq(status, uint256(expected));
    }
}

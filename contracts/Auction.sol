// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Auction interface
 * @author Nabetse
 * @notice Config struct to avoid stack too deep errors
 */
interface IAuction {
    struct AuctionConfig {
        address owner;
        uint256 startTimestamp;
        uint256 endTimestamp;
        uint256 startingPrice;
        uint256 buyItNowPrice;
        uint256 itemTokenId;
    }

    enum AuctionStatus {
        INIT,
        ON_GOING,
        ENDED,
        CANCELED,
        DELETABLE,
        UNEXPECTED
    }
}

/**
 * @title Auction contract
 * @author Nabetse
 * @notice Auction contract suport a starting price, buy it now price.
 * @notice Auction items represented has ERC721  NFTS.
 * @notice Bid increments from ebay (see https://www.ebay.com/help/buying/bidding/automatic-bidding?id=4014)
 * @notice step function in ether units.
 * @notice Internal function changes bid increments to acomodate bidToken decimals (minimal 2 decimals)
 * @notice Included rescue function allows tokens and eth retreival 120 day after bid end
 */
contract Auction is IAuction, ERC721Holder, ReentrancyGuard {
    using Math for uint256;
    // constants
    uint256 constant MIN_AUCTION_DURATION = 1 hours;
    uint256 constant MAX_AUCTION_DURATION = 7 days;
    uint256 constant MIN_STARTING_PRICE = 0.01 ether;
    // bid tiers and bid increments in 18 decimals format (ethers)
    uint256[] public bidTiers = [
        0 ether,
        1 ether,
        5 ether,
        25 ether,
        100 ether,
        250 ether,
        500 ether,
        1000 ether,
        2500 ether,
        5000 ether
    ];
    uint256[] public bidIncrements = [
        0.05 ether,
        0.25 ether,
        0.5 ether,
        1 ether,
        2.5 ether,
        5 ether,
        10 ether,
        25 ether,
        50 ether,
        100 ether
    ];

    // state
    AuctionConfig public config;
    address public immutable auctionFactory;
    bool public canceled;
    bool public ended;
    bool public rescued;

    uint public highestBindingBid;
    address public highestBidder;
    mapping(address => uint256) public fundsByBidder;
    address[] public biders;
    bool ownerHasWithdrawn;
    AuctionStatus public auctionStatus;

    IERC20Metadata public immutable bidToken;
    uint256 public immutable decimals;
    // token for bidding should be a stable coin

    IERC721 public immutable auctionItems;
    // auction items are ERC721 NFT

    // events
    event BidEvent(
        address bidder,
        uint256 bid,
        address highestBidder,
        uint256 highestBid,
        uint256 highestBindingBid
    );
    event WithdrawalEvent(
        address withdrawer,
        address withdrawalAccount,
        uint amount
    );
    event CanceledEvent();
    event BuytItNowEvent(address bider);

    event StatusChanged(AuctionStatus from, AuctionStatus to);
    event NewBidder(address bider);

    // modifiers
    modifier onlyAuctionFactory() {
        require(msg.sender == auctionFactory, "[Auction] Only AuctionFactory");
        _;
    }
    modifier onlyNotRescued() {
        require(!rescued, "[Auction] Only not rescued Auction");
        _;
    }
    modifier onlyOwner() {
        require(msg.sender == config.owner, "[Auction] Only owner");
        _;
    }

    modifier onlyNotOwner() {
        require(msg.sender != config.owner, "[Auction] only NOT owner");
        _;
    }

    modifier onlyValidBidder(address bidder) {
        require(bidder != config.owner, "[Auction] owner cannot bid");
        require(bidder != address(this), "[Auction] contract cannot bid");
        _;
    }

    modifier onlyAfterStart() {
        require(
            block.timestamp >= config.startTimestamp,
            "[Auction] Only after start"
        );
        _;
    }

    modifier onlyBeforeEnd() {
        require(
            block.timestamp <= config.endTimestamp,
            "[Auction] Only before end"
        );
        _;
    }

    modifier onlyNotCanceled() {
        require(!canceled, "[Auction] Only not canceled");
        _;
    }

    modifier onlyNotEnded() {
        require(!ended, "[Auction] Only not ended");
        _;
    }

    modifier onlyEndedOrCanceled() {
        require(
            canceled || ended || (block.timestamp > config.endTimestamp),
            "[Auction] Only Ended or Canceled"
        );
        _;
    }

    constructor(
        address _bidToken,
        address _auctionItems,
        uint256 _duration,
        AuctionConfig memory _config
    ) {
        require(
            (_duration >= MIN_AUCTION_DURATION) &&
                (_duration <= MAX_AUCTION_DURATION),
            "[Auction] Auction duration outside allowed values"
        );
        require(
            _config.owner != address(0),
            "[Auction] Owner cannot be zero address"
        );
        require(
            _bidToken != address(0),
            "[Auction] Token for bids cannot be zero address"
        );
        require(
            _auctionItems != address(0),
            "[Auction] Auction items for bids cannot be zero address"
        );

        if (_config.buyItNowPrice != 0) {
            require(
                _config.buyItNowPrice > _config.startingPrice,
                "[Auction] Buy it now price must be greater than starting price"
            );
        }
        auctionStatus = AuctionStatus.INIT;
        config.owner = _config.owner;
        bidToken = IERC20Metadata(_bidToken);
        decimals = IERC20Metadata(_bidToken).decimals();

        require(
            _config.startingPrice >= _valueToTokens(MIN_STARTING_PRICE),
            "[Auction] Bid starting price cannot be bellow MIN_STARTING_PRICE"
        );

        auctionItems = IERC721(_auctionItems);
        // 'block.timestamp' actually refers to the timestamp of the whole batch that will be sent to L1.
        // zkSync team is planning to change this in the near future so that it returns the timestamp of the L2
        // in this case it should not be a problem since checks are done with time diferences
        config.startTimestamp = block.timestamp;
        config.endTimestamp = block.timestamp + _duration;
        config.startingPrice = _config.startingPrice;
        config.buyItNowPrice = _config.buyItNowPrice;
        // it may be better to hardcode auctionFactory address
        auctionFactory = msg.sender;
        require(
            auctionItems.ownerOf(_config.itemTokenId) == auctionFactory,
            "[Auction] sender must be the owner of the token"
        );
        config.itemTokenId = _config.itemTokenId;
        _statusUpdate();
    }

    function getHighestBid() public view returns (uint256) {
        return fundsByBidder[highestBidder];
    }

    function placeBid(
        address _bidder,
        uint256 _tokenAmount
    )
        public
        payable
        onlyAfterStart
        onlyBeforeEnd
        onlyNotCanceled
        onlyNotEnded
        onlyNotOwner
        onlyValidBidder(_bidder)
        onlyNotRescued
        nonReentrant
        returns (bool success)
    {
        // sanity checks
        require(
            _bidder != address(0),
            "[Auction] bidder cannot be zero address"
        );
        require(_tokenAmount > 0, "[Auction] Cannot bid for 0 tokens");
        require(
            auctionItems.ownerOf(config.itemTokenId) == address(this),
            "[Auction] Auction contract is not the owner of item cannot bid"
        );

        _transferToContract(_bidder, _tokenAmount);

        uint256 bidIncrement = _computeBidIcrement(highestBindingBid);
        require(_tokenAmount >= bidIncrement, "[Auction] Bid increment to low");
        uint256 newBid = fundsByBidder[_bidder] + _tokenAmount;
        require(
            newBid >= config.startingPrice,
            "[Auction] Cannot bid for less than starting price"
        );
        require(
            newBid > highestBindingBid,
            "[Auction] bid doesn't overbid the highest binding bid"
        );

        // get highest bid
        uint256 highestBid = fundsByBidder[highestBidder];
        if (highestBid == 0) {
            highestBid = config.startingPrice - 1;
        }
        // update user bid
        fundsByBidder[_bidder] = newBid;
        // add to array
        _addToBidersArray(_bidder);

        if (newBid >= config.buyItNowPrice) {
            // cancel Auction on buyit now
            ended = true;
            highestBidder = _bidder;
            highestBindingBid = newBid;
            _statusUpdate();
            emit BuytItNowEvent(_bidder);
            return true;
        }

        if (newBid <= highestBid) {
            // new bid overbid the highest binding bid but not highestBid
            // update highestBindingBid
            highestBindingBid = highestBid.min(newBid + bidIncrement);
        } else {
            // if the user is NOT highestBidder:
            // - set highestBidder
            // - compute highestBindingBid.
            if (_bidder != highestBidder) {
                highestBidder = _bidder;
                highestBindingBid = newBid.min(highestBid + bidIncrement);
            }

            // if bidder is already the highest bidder:
            // - raise highestBid, highestBindingBid remains unchanged .
            highestBid = newBid;
        }

        // event
        emit BidEvent(
            _bidder,
            newBid,
            highestBidder,
            highestBid,
            highestBindingBid
        );
        return true;
    }

    function cancelAuction()
        public
        onlyOwner
        onlyBeforeEnd
        onlyNotCanceled
        onlyNotRescued
        returns (bool success)
    {
        canceled = true;
        _statusUpdate();
        emit CanceledEvent();
        return true;
    }

    function rescue(
        address payable receiver
    ) public onlyEndedOrCanceled onlyAuctionFactory onlyNotRescued nonReentrant {
        require(receiver != address(0));
        require(
            block.timestamp > (config.endTimestamp + 120 days),
            "[Auction] Auction rescue can only be done  120 day after bid end"
        );
        // transfer tokens to address
        uint256 bal = IERC20Metadata(bidToken).balanceOf(address(this));
        if (bal > 0) {
            bool success = IERC20Metadata(bidToken).transfer(receiver, bal);
            require(success, "[Auction] Rescue failed to withdraw Auction tokens.");
        }
        if (auctionItems.ownerOf(config.itemTokenId) == address(this)) {
            _transferItemTo(receiver);
        }
        bal = address(this).balance;
        if (bal > 0) {
            (bool sent, ) = receiver.call{value: bal}("");
            require(sent, "[Auction] Rescue failed to send Ether");
        }
    }

    function withdrawAll() public onlyEndedOrCanceled nonReentrant returns (bool success) {
        // withdraw all biders
        for (uint i = 0; i < biders.length; i++) {
            _withdraw(biders[i]);
        }
        // withdraw for owner
        _withdraw(config.owner);
        return true;
    }

    function withdraw() public onlyEndedOrCanceled nonReentrant returns (bool success) {
        return _withdraw(msg.sender);
    }

    function getMinimalIncrementTokens() public view returns (uint256) {
        uint256 increment = _computeBidIcrement(highestBindingBid);

        if (highestBindingBid < config.startingPrice) {
            return config.startingPrice.max(increment);
        }
        return increment;
    }

    function _withdraw(
        address to
    ) private onlyEndedOrCanceled returns (bool success) {
        address withdrawalAccount;
        uint256 withdrawalAmount;

        if (canceled) {
            // if the auction was canceled, everyone should simply be allowed to withdraw their funds
            withdrawalAccount = to;
            withdrawalAmount = fundsByBidder[withdrawalAccount];
            if (!ownerHasWithdrawn) {
                _transferItemTo(config.owner);
            }
            ownerHasWithdrawn = true;
        } else {
            // the auction finished without being canceled
            if (to == config.owner) {
                // the auction's owner should be allowed to withdraw the highestBindingBid
                withdrawalAccount = highestBidder;
                withdrawalAmount = highestBindingBid;
                if (!ownerHasWithdrawn) {
                    _transferItemTo(highestBidder);
                }
                ownerHasWithdrawn = true;
            } else if (to == highestBidder) {
                // the highest bidder should only be allowed to withdraw the difference between their
                // highest bid and the highestBindingBid
                withdrawalAccount = highestBidder;
                if (ownerHasWithdrawn) {
                    withdrawalAmount = fundsByBidder[highestBidder];
                } else {
                    withdrawalAmount =
                        fundsByBidder[highestBidder] -
                        highestBindingBid;
                }
            } else {
                // anyone who participated but did not win the auction should be allowed to withdraw
                // the full amount of their funds
                withdrawalAccount = to;
                withdrawalAmount = fundsByBidder[withdrawalAccount];
            }
        }

        _withdrawTokensToBider(withdrawalAccount, withdrawalAmount, to);
        return true;
    }

    function _statusUpdate() internal {
        AuctionStatus current = auctionStatus;

        if (canceled && (current != AuctionStatus.CANCELED)) {
            auctionStatus = AuctionStatus.CANCELED;
            emit StatusChanged(current, AuctionStatus.CANCELED);
            return;
        }

        if (
            (block.timestamp > config.endTimestamp) &&
            (current != AuctionStatus.ENDED)
        ) {
            auctionStatus = AuctionStatus.ENDED;
            emit StatusChanged(current, AuctionStatus.ENDED);
            return;
        }

        if (ended && (current != AuctionStatus.ENDED)) {
            auctionStatus = AuctionStatus.ENDED;
            emit StatusChanged(current, AuctionStatus.ENDED);
            return;
        }

        if (
            (current != AuctionStatus.ON_GOING) &&
            !ended &&
            !canceled &&
            (block.timestamp <= config.endTimestamp)
        ) {
            auctionStatus = AuctionStatus.ON_GOING;
            emit StatusChanged(current, AuctionStatus.ON_GOING);
            return;
        }
    }

    function _computeBidIcrement(
        uint256 value
    ) internal view returns (uint256) {
        require(
            value >= _valueToTokens(bidTiers[0]),
            "Auction item value is invalid"
        );
        for (uint i = 1; i < bidTiers.length; i++) {
            if (value < _valueToTokens(bidTiers[i])) {
                return _valueToTokens(bidIncrements[i - 1]);
            }
        }
        return _valueToTokens(bidIncrements[bidIncrements.length - 1]);
    }

    function _valueToTokens(uint256 value) internal view returns (uint256) {
        return (value * 10 ** (decimals)) / 1 ether;
    }

    function _transferToContract(address from, uint256 tokenAmount) private {
        // transfer tokens to contract
        bool success = IERC20Metadata(bidToken).transferFrom(
            from,
            address(this),
            tokenAmount
        );
        require(success, "[Auction] Transfer of Tokens from bidder failed.");
    }

    function _transferItemTo(address to) private {
        // transfer item to bidder or owner if address is 0
        if (address(to) == address(0)) {
            to = config.owner;
        }
        IERC721(auctionItems).safeTransferFrom(
            address(this),
            to,
            config.itemTokenId
        );
    }

    function _withdrawTokensToBider(
        address _withdrawalAccount,
        uint256 _withdrawalAmount,
        address _to
    ) private {
        fundsByBidder[_withdrawalAccount] -= _withdrawalAmount;
        if (_to == config.owner) {
            require(
                _withdrawalAmount <= highestBindingBid,
                "[AUction] owner cannot withdraw more than binding bid"
            );
            highestBindingBid = 0;
        }
        if (_withdrawalAmount != 0) {
            bool _success = IERC20Metadata(bidToken).transfer(
                _to,
                _withdrawalAmount
            );
            require(_success, "[Auction] Failed to withdraw Auction funds.");
        }
        emit WithdrawalEvent(_to, _withdrawalAccount, _withdrawalAmount);
    }

    function _addToBidersArray(address addr) internal {
        // checks if addr in array

        for (uint i = 0; i < biders.length; i++) {
            if (biders[i] == addr) {
                return;
            }
        }
        biders.push(addr);
        emit NewBidder(addr);
    }

    function _IsDeletable() internal view returns (bool) {
        if (auctionItems.ownerOf(config.itemTokenId) == address(this)) {
            return false;
        }

        if (IERC20(bidToken).balanceOf(address(this)) > 0) {
            return false;
        }

        for (uint i = 0; i < biders.length; i++) {
            if (fundsByBidder[biders[i]] > 0) {
                return false;
            }
        }

        return true;
    }
}

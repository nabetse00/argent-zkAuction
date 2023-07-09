// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

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

contract Auction is IAuction, ERC721Holder {
    using Math for uint256;
    // constants
    uint256 constant MIN_AUCTION_DURATION = 1 hours;
    uint256 constant MAX_AUCTION_DURATION = 7 days;
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
    bool public canceled;
    uint public highestBindingBid;
    address public highestBidder;
    mapping(address => uint256) public fundsByBidder;
    bool ownerHasWithdrawn;
    AuctionStatus public auctionStatus;

    IERC20Metadata public immutable bidToken;
    uint256 public immutable decimals;
    // token for bidding should be a stable coin

    IERC721 public immutable auctionItems;
    // auction items are nft

    // events
    event BidEvent(
        address bidder,
        uint bid256,
        address highestBidder,
        uint256 highestBid,
        uint highestBindingBid
    );
    event WithdrawalEvent(
        address withdrawer,
        address withdrawalAccount,
        uint amount
    );
    event CanceledEvent();

    event StatusChanged(AuctionStatus from, AuctionStatus to);

    // modifiers
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

    modifier onlyEndedOrCanceled() {
        require(
            canceled || (block.timestamp > config.endTimestamp),
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
        require(
            _config.startingPrice > bidTiers[0],
            "[Auction] Bid starting price cannot be 0"
        );
        require(
            _config.buyItNowPrice >= _config.startingPrice,
            "[Auction] Buy it now price must be greater than starting price"
        );
        auctionStatus = AuctionStatus.INIT;
        config.owner = _config.owner;
        bidToken = IERC20Metadata(_bidToken);
        decimals = IERC20Metadata(_bidToken).decimals();
        auctionItems = IERC721(_auctionItems);
        // 'block.timestamp' actually refers to the timestamp of the whole batch that will be sent to L1.
        // zkSync team is planning to change this in the near future so that it returns the timestamp of the L2
        // in this case it should not be a problem since checks are done with time diferences
        config.startTimestamp = block.timestamp;
        config.endTimestamp = block.timestamp + _duration;
        config.startingPrice = _config.startingPrice;
        config.buyItNowPrice = _config.buyItNowPrice;
        require(
            auctionItems.ownerOf(_config.itemTokenId) == config.owner,
            "[Auction] Only owner of an item can auction it"
        );
        // transfer item
        auctionItems.safeTransferFrom(
            config.owner,
            address(this),
            _config.itemTokenId
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
        onlyNotOwner
        onlyValidBidder(_bidder)
        returns (bool success)
    {
        // sanity checks
        require(
            _bidder != address(0),
            "[Auction] bidder cannot be zero address"
        );
        require(_tokenAmount > 0, "[Auction] Cannot raise for 0 tokens");

        // transfer first
        _transfer(_bidder, _tokenAmount);
        // operation in 18 decimals so adapt to token decimals
        uint256 amount = _amount18Decimals(_tokenAmount);

        uint256 bidIncrement = _computeBidIcrement(highestBindingBid);
        require(amount >= bidIncrement, "[Auction] Bid increment to low");
        uint256 newBid = fundsByBidder[_bidder] + amount;
        require(
            newBid >= config.startingPrice,
            "[Auction] Cannot bid for less than strating price"
        );
        require(
            newBid > highestBindingBid,
            "[Auction] bid doesn't overbid the highest binding bid"
        );

        // get highest bid
        uint256 highestBid = fundsByBidder[highestBidder];

        if (newBid <= highestBid) {
            // new bid overbid the highest binding bid but not highestBid
            // update highestBindingBid
            highestBindingBid = highestBid.min(newBid + bidIncrement);
        } else {
            // if bidder is already the highest bidder:
            // - raise highestBid, highestBindingBid remains unchanged .
            highestBid = newBid;

            // if the user is NOT highestBidder:
            // - set highestBidder
            // - compute highestBindingBid.
            if (_bidder != highestBidder) {
                highestBidder = _bidder;
                highestBindingBid = newBid.min(highestBid + bidIncrement);
            }
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
        returns (bool success)
    {
        canceled = true;
        _statusUpdate();
        emit CanceledEvent();
        return true;
    }

    function withdraw() public onlyEndedOrCanceled returns (bool success) {
        address withdrawalAccount;
        uint withdrawalAmount;

        if (canceled) {
            // if the auction was canceled, everyone should simply be allowed to withdraw their funds
            withdrawalAccount = msg.sender;
            withdrawalAmount = fundsByBidder[withdrawalAccount];
        } else {
            // the auction finished without being canceled

            if (msg.sender == config.owner) {
                // the auction's owner should be allowed to withdraw the highestBindingBid
                withdrawalAccount = highestBidder;
                withdrawalAmount = highestBindingBid;
                ownerHasWithdrawn = true;
            } else if (msg.sender == highestBidder) {
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
                withdrawalAccount = msg.sender;
                withdrawalAmount = fundsByBidder[withdrawalAccount];
            }
        }

        require(withdrawalAmount > 0, "[Auction] withdraw amount is 0");

        fundsByBidder[withdrawalAccount] -= withdrawalAmount;

        // send the funds
        (bool _success, ) = payable(msg.sender).call{value: withdrawalAmount}(
            ""
        );
        require(_success, "[Auction] Failed to withdraw Auction funds.");
        emit WithdrawalEvent(msg.sender, withdrawalAccount, withdrawalAmount);

        return true;
    }

    function _statusUpdate() internal {
        AuctionStatus current = auctionStatus;

        if (canceled && (current != AuctionStatus.CANCELED)) {
            auctionStatus = AuctionStatus.CANCELED;
            emit StatusChanged(current, AuctionStatus.CANCELED);
            return;
        }

        if (ownerHasWithdrawn && (current != AuctionStatus.DELETABLE)) {
            auctionStatus = AuctionStatus.DELETABLE;
            emit StatusChanged(current, AuctionStatus.DELETABLE);
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

        if (current != AuctionStatus.ON_GOING) {
            auctionStatus = AuctionStatus.ON_GOING;
            emit StatusChanged(current, AuctionStatus.ON_GOING);
            return;
        }

        if (
            (block.timestamp < config.startTimestamp) &&
            (current != AuctionStatus.UNEXPECTED)
        ) {
            auctionStatus = AuctionStatus.UNEXPECTED;
            emit StatusChanged(current, AuctionStatus.UNEXPECTED);
            return;
        }
    }

    function _computeBidIcrement(
        uint256 tokenAmount
    ) internal view returns (uint256) {
        uint256 amount = _amount18Decimals(tokenAmount);
        require(amount >= bidTiers[0], "Auction item value is invalid");
        for (uint i = 1; i < bidTiers.length; i++) {
            if (amount < bidTiers[i]) {
                return bidIncrements[i - 1];
            }
        }
        return bidIncrements[bidIncrements.length - 1];
    }

    function _amount18Decimals(
        uint256 valueToken
    ) internal view returns (uint256) {
        return valueToken * 10 ** (18 - decimals);
    }

    function _amountTokenDecimals(
        uint256 value
    ) internal view returns (uint256) {
        return value / 10 ** (18 - decimals);
    }

    function _transfer(address from, uint256 tokenAmount) internal {
        // transfer tokens to contract
        bool success = IERC20Metadata(bidToken).transferFrom(
            from,
            address(this),
            tokenAmount
        );
        require(success, "[Auction] Transfer of Tokens from bidder failed.");
    }
}

pragma solidity >=0.5.1 <0.6.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract LotteryPot is Ownable {
  using SafeMath for uint;

  // --- State Variables Declaration ---

  // constant
  uint constant MIN_DURATION = 300;

  // Basic info
  string public potName;
  uint public closedDateTime;
  uint public minStake;

  enum PotType { fairShare, weightedShare }
  PotType public potType;

  enum PotState { open, closed, stakeWithdrawn }
  PotState public potState;

  address public winner;

  // Pot stakes - using mapping iterator pattern
  mapping(address => uint) participantsStakes;
  address[] public participants;

  // --- Events Declaration ---

  event NewParticipantJoin(
    address indexed participant,
    uint indexed value,
    uint indexed timestamp
  );

  event WinnerDetermined(
    address indexed winner,
    uint indexed totalStakes
  );

  event StakesWithdrawn(
    address indexed winner,
    uint indexed totalStakes
  );

  // --- Functions Modifier ---
  modifier aboveMinStake {
    require(minStake <= msg.value);
    _;
  }

  modifier timedTransition {
    if (now > closedDateTime && potState == PotState.open) {
      potState = PotState.closed;
    }
    _;
  }

  modifier atState(PotState state) {
    require(potState == state);
    _;
  }

  modifier onlyByValidWinner {
    require(winner != address(0) && winner == msg.sender);
    _;
  }

  // ----------------
  // _minStake: in the unit of wei
  constructor (
    string memory _potName,
    uint _duration,
    uint _minStake,
    PotType _potType
  )
    public payable
  {
    require(_minStake > 0, "The minimum stake has to be greater than 0.");
    require(msg.value >= _minStake);
    require (_duration >= MIN_DURATION);

    potName = _potName;
    closedDateTime = now + _duration;
    minStake = _minStake;
    potType = _potType;
    potState = PotState.open;

    // The creator itself who set the minStake also need to participate in the game.
    participate();
  }

  // To participate in the pot, but also defined this as the fallback function
  function participate() public payable
    timedTransition
    aboveMinStake
    atState(PotState.open)
  {
    if (participantsStakes[msg.sender] == 0) {
      participants.push(msg.sender);
    }
    participantsStakes[msg.sender] += msg.value;
    emit NewParticipantJoin(msg.sender, msg.value, now);
  }

  // Fallback function default to `participate`
  function () external payable {
    participate();
  }

  function totalParticipants() external view returns(uint) {
    return participants.length;
  }

  function totalStakes() public view returns(uint) {
    // TO_ENHANCE: can be optimized, remember with a cache var, or using a more
    //   elegant map reduce style.
    uint stakes = 0;
    for (uint i = 0; i < participants.length; i++) {
      stakes += participantsStakes[participants[i]];
    }
    return stakes;
  }

  function determineWinnerInternal() internal view returns(address) {
    // Dealing with fairShare
    if (potType == PotType.fairShare) {
      uint index = uint(keccak256(abi.encodePacked(block.timestamp, block.difficulty))) %
        participants.length;
      return participants[index];
    }

    // Dealing with weightedShare
    uint remaining = uint(keccak256(abi.encodePacked(block.timestamp, block.difficulty))) %
      totalStakes();
    uint index = 0;
    while (remaining > participantsStakes[participants[index]]) {
      remaining -= participantsStakes[participants[index]];
      index += 1;
    }
    return participants[index];
  }

  // Purposefully make this function allow to be run by anybody, not just the
  //   contract owner.
  function determineWinner() public
    timedTransition
    atState(PotState.closed)
  {
    if (winner != address(0)) return;

    winner = determineWinnerInternal();
    emit WinnerDetermined(winner, totalStakes());
  }

  function winnerWithdraw() public
    timedTransition
    atState(PotState.closed)
    onlyByValidWinner
  {
    // 1. Check - done
    // 2. Effect
    potState = PotState.stakeWithdrawn;

    // 3. Interaction
    uint stakes = totalStakes();
    msg.sender.transfer(stakes);
    emit StakesWithdrawn(msg.sender, stakes);
  }

  // Public could only see his own stake in the game
  function myStake() public view returns(uint) {
    return participantsStakes[msg.sender];
  }

  /// Allow contract self-destruction if there is only owner involved, or
  ///   the lottery stakes has been withdrawn
  function destroy() public
    onlyOwner
  {
    // Only the owner himself is involved, or money has been withdrawn
    require(participants.length == 1 || potState == PotState.stakeWithdrawn);
    selfdestruct(msg.sender);
  }
}

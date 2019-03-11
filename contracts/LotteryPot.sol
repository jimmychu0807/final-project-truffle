pragma solidity >=0.5.1 <0.6.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract LotteryPot is Ownable {
  using SafeMath for uint;

  // Basic info
  string public potName;        // Lottery Pot name
  uint public closedDateTime;
  uint public minStake;

  enum PotType { fairShare, weightedShare }
  PotType public potType;

  enum PotState { open, winnerDecided, stakeWithdrawn }
  PotState public potState;

  address payable public winner;

  // Pot stakes
  mapping(address => uint) public participantsMapping;
  uint public totalParticipants;

  // Events declaration
  event NewParticipantJoin(address indexed participant, uint indexed value, uint indexed timestamp);

  // Functions modifier
  modifier aboveMinStake {
    require(minStake <= msg.value);
    _;
  }

  modifier haveNotParticipated {
    require(participantsMapping[msg.sender] == 0);
    _;
  }

  modifier beforeClosed {
    require(potState == PotState.open && now < closedDateTime, "Lottery Pot is closed.");
    _;
  }

  // ----------------
  // _minStake: in the unit of wei
  constructor(string memory _potName, uint _closedDateTime, uint _minStake,
    PotType _potType) public {
    potName = _potName;
    closedDateTime = _closedDateTime;
    minStake = _minStake;
    potType = _potType;

    potState = PotState.open;
  }

  // To participate in the pot, but also defined this as the fallback function
  function participate() public payable aboveMinStake haveNotParticipated beforeClosed {
    participantsMapping[msg.sender] = msg.value;
    totalParticipants = totalParticipants.add(1);
    emit NewParticipantJoin(msg.sender, msg.value, now);
  }

  // TODO:
  //   - can you force the creator (constructor) also pay at least minStake to the game?
  //   - implement function to determine the winner
  //   - implement withdraw pattern for winner to retrieve the stake
}

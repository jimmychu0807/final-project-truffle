pragma solidity >=0.5.1 <0.6.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract LotteryPot is Ownable {
  using SafeMath for uint256;

  // Basic info
  string public potName;        // Lottery Pot name
  uint public closedDateTime;
  uint public minStake;

  enum PotType { fairShare, weightedShare }
  PotType potType;

  enum PotState { open, winnerDecided, stakeWithdrawn }
  PotState potState;

  address payable winner;

  // Pot stakes
  mapping(address => uint) stakesMapping;
  uint public totalPotValue;
  uint public tatalPotParticipants;

  // Events declaration
  event NewParticipantJoin(address indexed participant, uint indexed value, uint indexed timestamp);

  // Functions modifier
  modifier aboveMinStake {
    require(msg.value >= minStake);
    _;
  }

  modifier haveNotParticipated {
    require(stakesMapping[msg.sender] == 0);
    _;
  }

  modifier beforeClosed {
    require(potState == PotState.open && now < closedDateTime, "Lottery Pot is closed.");
    _;
  }

  // ----------------

  constructor(string _potName, uint _closedDateTime, uint _minStake,
    string _type, ) public aboveMinStake {
    owner = msg.sender;
    potName = _potName;
    closedDateTime = _closedDateTime;
    minStake = _minStake;

    require( _type == "fair_share" || _type == "weighted_share");
    if (_type == "fair_share") {
      potType = PotType.fairShare;
    } else {
      potType = PotType.weightedShare;
    }

    potState = PotState.open;
  }

  // To participate in the pot, but also defined this as the fallback function
  function participate() public payable aboveMinStake haveNotParticipated beforeClosed {
    string participant = msg.sender
    uint value = msg.value

    stakesMapping[participant] = value;
    totalPotValue.add(value);
    totalPotParticipants.add(1);

    emit NewParticipantJoin(participant, value, now);
  }
}

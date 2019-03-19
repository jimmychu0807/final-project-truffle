pragma solidity >=0.5.1 <0.6.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./LotteryPot.sol";

contract LotteryPotFactory is Ownable {
  using SafeMath for uint;

  // 1. allow creation of a new contract
  //    - remember the contract addr, when, owner
  // 2. allow listing all contracts
  mapping(address => bool) lotteryPotsMapping;
  address[] public lotteryPots;

  constructor() public {}

  function createLotteryPot(
    string memory potName, uint duration, uint minStake,
    LotteryPot.PotType potType
  ) public payable returns(LotteryPot) {
    LotteryPot newContract = (new LotteryPot).value(msg.value)({ _potName: potName,
      _duration: duration, _minStake: minStake, _potType: potType });

    address newAddr = address(newContract);

    // Update with new contract info
    lotteryPots.push(newAddr);
    lotteryPotsMapping[newAddr] = true;
    return newContract;
  }

  function getLotteryPots() public view returns(address[] memory) {
    return lotteryPots;
  }

  function destroy() public onlyOwner {
    selfdestruct(msg.sender);
  }
}

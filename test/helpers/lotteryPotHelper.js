function lotteryPotIntialSetup(accts, minStake) {
  this.owner = accts[0];
  this.secondParticipant = {
    from: accts[1],
    value: minStake.addn(500),
  };
  this.thirdParticipant = {
    from: accts[2],
    value: minStake.addn(1000),
  };
}

module.exports = { lotteryPotIntialSetup }

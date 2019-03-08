const LotteryPot = artifacts.require("LotteryPot");

module.exports = function(deployer) {
  deployer.deploy(LotteryPot);
};

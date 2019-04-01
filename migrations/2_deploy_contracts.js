"use strict"

const w3utils = web3.utils;

const fixtures = require('../test/assets/fixtures.json');
const LotteryPot = artifacts.require("LotteryPot");
const LotteryPotFactory = artifacts.require("LotteryPotFactory");

module.exports = function(deployer, network, accounts) {

  // --- LotteryPot ---
  // Only deployed in development for testing
  if (network == "development") {
    const lotteryPotData = fixtures.lotteryPots.fixtures[0];
    const minStakeInWei = web3.utils.toWei(lotteryPotData.minStake.toString(), "ether");

    deployer.deploy(LotteryPot, lotteryPotData.potName,
      w3utils.toBN(lotteryPotData.duration), minStakeInWei,
      lotteryPotData.potType, accounts[0], { value: minStakeInWei });
  }

  // --- LotteryPotFactory ---
  deployer.deploy(LotteryPotFactory);
};

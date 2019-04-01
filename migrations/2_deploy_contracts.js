"use strict"

const w3utils = web3.utils;

const fixtures = require('../test/assets/fixtures.json');
const LotteryPot = artifacts.require("LotteryPot");
const LotteryPotFactory = artifacts.require("LotteryPotFactory");

module.exports = function(deployer, network, accounts) {

  // --- LotteryPot ---
  // We also want to deploy one copy of this contract in rinkeby network.
  //   So it is recorded in contract artifact and can be read in drizzle.
  const lotteryPotData = fixtures.lotteryPots.fixtures[0];
  const minStakeInWei = web3.utils.toWei(lotteryPotData.minStake.toString(), "ether");

  deployer.deploy(LotteryPot, lotteryPotData.potName,
    w3utils.toBN(lotteryPotData.duration), minStakeInWei,
    lotteryPotData.potType, accounts[0], { value: minStakeInWei });

  // --- LotteryPotFactory ---
  deployer.deploy(LotteryPotFactory);
};

"use strict"

const moment = require('moment');
const fixtures = require('../test/assets/fixtures.json');
const LotteryPot = artifacts.require("LotteryPot");

module.exports = function(deployer) {

  const lotteryPotData = fixtures.lotteryPots.fixtures[0];
  let closeDateTime = moment().add(lotteryPotData.closeDatedTime, 's');
  const minStakeInWei = web3.utils.toWei(lotteryPotData.minStake.toString(), "ether");

  deployer.deploy(LotteryPot, lotteryPotData.potName,
    closeDateTime.valueOf(), minStakeInWei, lotteryPotData.potType,
    { value: minStakeInWei });
};

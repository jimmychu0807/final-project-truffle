"use strict"

const moment = require('moment');
const fixtures = require('../test/assets/fixtures.json');
const LotteryPot = artifacts.require("LotteryPot");

module.exports = function(deployer) {

  const lotteryPotData = fixtures.lotteryPots[0];
  let closeDateTime = moment().add(lotteryPotData.closeDatedTime, 's');

  deployer.deploy(LotteryPot, lotteryPotData.potName, closeDateTime.valueOf(),
    lotteryPotData.minStake, lotteryPotData.potType);
};

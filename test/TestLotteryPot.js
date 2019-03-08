"use strict"

const moment = require('moment');
const fixtures = require('./assets/fixtures.json');
const LotteryPot = artifacts.require("./LotteryPot.sol");

contract("TestLotteryPot", accts => {

  it("should construct a new contract with proper data", async() => {
    const lotteryPotData = fixtures.lotteryPots[0];

    const instance = await LotteryPot.deployed();
    assert.equal(await instance.potName.call(), lotteryPotData.potName);
    assert.equal((await instance.minStake.call()).toNumber(),
      lotteryPotData.minStake);
  });
});

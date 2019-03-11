"use strict"

const moment = require('moment');
const fixtures = require('./assets/fixtures.json');
const LotteryPot = artifacts.require("./LotteryPot.sol");

contract("TestLotteryPot", accts => {

  it("should construct a new contract with proper data", async() => {
    const lotteryPotData = fixtures.lotteryPots.fixtures[0];
    const lotteryPotEnum = fixtures.lotteryPots.enum;
    const owner = accts[0];
    const minStakeInWei = web3.utils.toWei(lotteryPotData.minStake.toString(), "ether");


    const instance = await LotteryPot.deployed();
    assert(await instance.isOwner({from: owner}));
    assert.equal(await instance.potName(), lotteryPotData.potName);
    assert.equal(await instance.minStake(), minStakeInWei);
    assert.equal(await instance.potType(), lotteryPotEnum.potType.fairShare);
    assert.equal(await instance.potState(), lotteryPotEnum.potState.open);
    assert.equal(await instance.totalPotValue(), 0);
    assert.equal(await instance.totalPotParticipants(), 0);
  });

  it("should allow a new participant to join", async() => {
    const lotteryPotData = fixtures.lotteryPots.fixtures[0];
    const participant = accts[1];
    const rejectedMinStake = web3.utils.toWei((lotteryPotData.minStake - 0.01).toString(), "ether");
    const acceptedMinStake = web3.utils.toWei(lotteryPotData.minStake.toString(), "ether");

    const instance = await LotteryPot.deployed();

    // Why this works?
    const error = await instance.participate({ from: participant, value: rejectedMinStake })
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");
  });

});

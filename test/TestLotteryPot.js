"use strict"

const moment = require('moment');
const fixtures = require('./assets/fixtures.json');
const LotteryPot = artifacts.require("./LotteryPot.sol");
const w3utils = web3.utils;

// Some constant variables decl
const lotteryPotData = fixtures.lotteryPots.fixtures[0];
const lotteryPotEnum = fixtures.lotteryPots.enum;
const acceptedMinStake = w3utils.toWei(w3utils.toBN(lotteryPotData.minStake), "ether");
const rejectedMinStake = acceptedMinStake.subn(1000);

contract("TestLotteryPot", accts => {

  before(() => {
    this.owner = accts[0];
    this.secondParticipant = {
      from: accts[1],
      value: acceptedMinStake.addn(500),
    };
    this.thirdParticipant = {
      from: accts[2],
      value: acceptedMinStake.addn(1000),
    };
  })

  it("should construct a new contract with proper data", async() => {
    const instance = await LotteryPot.deployed();

    assert(await instance.isOwner({ from: this.owner }));
    assert.equal(await instance.potName(), lotteryPotData.potName);

    assert((await instance.minStake()).eq(acceptedMinStake));
    assert.equal(await instance.potType(), lotteryPotEnum.potType.fairShare);
    assert.equal(await instance.potState(), lotteryPotEnum.potState.open);
    assert.equal(await instance.totalParticipants(), 1);
    assert((await instance.totalStakes()).eq(acceptedMinStake));
  });

  it("should failed to participate as less than minStake", async() => {
    const instance = await LotteryPot.deployed();

    // This should failed
    const error = await instance.participate({ ...this.secondParticipant, value: rejectedMinStake })
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");
  });

  it.only("should allow a new participant to join", async() => {
    const instance = await LotteryPot.deployed();

    // 2nd participant
    let totalStakes = await instance.totalStakes();
    let totalParticipants = await instance.totalParticipants();

    const tx = await instance.participate(this.secondParticipant);

    totalStakes.iadd(this.secondParticipant.value);
    totalParticipants.iaddn(1);

    // Test event
    assert.equal(tx.logs.length, 1);
    const ev = tx.logs[0];
    assert.equal(ev.args["participant"], this.secondParticipant.from);
    assert(ev.args["value"].eq(this.secondParticipant.value));

    // Test contract state
    assert((await instance.totalStakes()).eq(totalStakes));
    assert((await instance.totalParticipants()).eq(totalParticipants));

    // Test my stake is recorded properly
    assert((await instance.myStake({ from: this.secondParticipant.from }))
      .eq(this.secondParticipant.value));
  });
});

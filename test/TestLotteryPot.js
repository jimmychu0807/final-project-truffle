"use strict"

const moment = require('moment');
const w3utils = web3.utils;

// Helpers
const helpers = require('./helpers/truffleTestHelper');
const LPhelpers = require('./helpers/lotteryPotHelper');
// Test contract and data
const fixtures = require('./assets/fixtures.json');
const LotteryPot = artifacts.require("./LotteryPot.sol");

// Some constant variables decl
const lotteryPotData = fixtures.lotteryPots.fixtures[0];
const lotteryPotEnum = fixtures.lotteryPots.enum;
const acceptedMinStake = w3utils.toWei(w3utils.toBN(lotteryPotData.minStake), "ether");
const rejectedMinStake = acceptedMinStake.subn(1000);

contract("TestLotteryPot - general", accts => {

  before(() => {
    LPhelpers.lotteryPotIntialSetup.bind(this)(accts, acceptedMinStake);
  })

  it("should construct a new contract with proper data", async() => {
    const instance = await LotteryPot.deployed();

    assert.isOk(await instance.isOwner({ from: this.owner }));
    assert.equal(await instance.potName(), lotteryPotData.potName);

    assert.isOk((await instance.minStake()).eq(acceptedMinStake));
    assert.equal(await instance.potType(), lotteryPotEnum.potType.fairShare);
    assert.equal(await instance.potState(), lotteryPotEnum.potState.open);
    assert.equal(await instance.totalParticipants(), 1);
    assert.isOk((await instance.totalStakes()).eq(acceptedMinStake));
  });

  it("should failed to participate as less than minStake", async() => {
    const instance = await LotteryPot.deployed();

    // This should failed
    const error = await instance.participate({ ...this.secondParticipant, value: rejectedMinStake })
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");
  });

  it("should allow a new participant to join", async() => {
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
    assert.isOk(ev.args["value"].eq(this.secondParticipant.value));

    // Test contract state
    assert.isOk((await instance.totalStakes()).eq(totalStakes));
    assert.isOk((await instance.totalParticipants()).eq(totalParticipants));

    // Test my stake is recorded properly
    assert.isOk((await instance.myStake({ from: this.secondParticipant.from }))
      .eq(this.secondParticipant.value));
  });
});

contract("TestLotteryPot - lifecycle", accts => {

  before(() => {
    LPhelpers.lotteryPotIntialSetup.bind(this)(accts, acceptedMinStake);
  })

  it("a contract ends, determines winner, and allow winner(and only winner) to withdraw fund",
    async() => {

    const instance = await LotteryPot.deployed();
    await instance.participate(this.secondParticipant);

    // Test: Should fail if we close now
    const error = await instance.determineWinner()
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");

    // Fast forward time
    await helpers.advanceTimeAndBlock(lotteryPotData.duration + 1);

    const tx = await instance.determineWinner();

    // Verify event
    const ev = tx.logs[0];
    assert.isOk(ev);
    assert.equal(ev.event, "WinnerDetermined");

    // Verify a winner is determined.
    const winner = await instance.winner();
    assert.isOk(winner.toString().startsWith("0x"));
  });
});

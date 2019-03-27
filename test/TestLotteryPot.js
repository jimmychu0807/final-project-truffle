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
const acceptedMinStake = w3utils.toBN(w3utils.toWei(lotteryPotData.minStake.toString(), "ether"));
const rejectedMinStake = acceptedMinStake.subn(1000);
const MAX_DISCREPANCY = w3utils.toBN('1000000000000000');

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
    const w3instance = new web3.eth.Contract(LotteryPot.abi, LotteryPot.address);

    // This should failed
    const acctFrom = this.secondParticipant.from;

    // Note: we use the web3 contract instance instead of TruffleContract because
    //   truffle does not handle overloaded functions well
    const error = await w3instance.methods.participate()
      .send({ from: acctFrom, value: rejectedMinStake })
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");
  });

  it("should allow a new participant to join", async() => {
    const instance = await LotteryPot.deployed();
    const w3instance = new web3.eth.Contract(LotteryPot.abi, LotteryPot.address);

    // 2nd participant
    let totalStakes = await instance.totalStakes();
    let totalParticipants = await instance.totalParticipants();

    // We use spread at the end, because `send()` modify the option object - WTF!
    const tx = await w3instance.methods.participate().send({...this.secondParticipant});

    totalStakes.iadd(this.secondParticipant.value);
    totalParticipants.iaddn(1);

    // Test event
    Object.keys(tx.events);
    assert.equal(Object.keys(tx.events).length, 1);
    const ev = Object.entries(tx.events)[0][1];
    assert.equal(ev.returnValues["participant"], this.secondParticipant.from);
    assert.isOk(this.secondParticipant.value.eq( w3utils.toBN(ev.returnValues["value"]) ));

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
    await instance.participate(this.secondParticipant.from, {...this.secondParticipant});

    let error, tx, ev;

    // Test: Should fail if we close now
    error = await instance.determineWinner()
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");

    // Fast forward time
    await helpers.advanceTimeAndBlock(lotteryPotData.duration + 1);

    tx = await instance.determineWinner();

    // Verify event
    ev = tx.logs[0];
    assert.isOk(ev);
    assert.equal(ev.event, "WinnerDetermined");

    // Verify a winner is determined.
    const winner = await instance.winner();
    assert.isOk(winner.toString().startsWith("0x"));

    // Withdraw money from an outsider
    error = await instance.winnerWithdraw({ from: this.thirdParticipant.from })
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");

    // Withdraw money by winner
    const beforeBal = w3utils.toBN(await web3.eth.getBalance(winner));
    tx = await instance.winnerWithdraw({ from: winner });
    const afterBal = w3utils.toBN(await web3.eth.getBalance(winner));
    const totalStakes = await instance.totalStakes();

    // after - before ~ totalStakes
    assert.isOk( afterBal.sub(beforeBal).sub(totalStakes).abs().lte(MAX_DISCREPANCY) );
  });
});

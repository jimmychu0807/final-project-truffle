"use strict"

const moment = require('moment');

// Helpers
const helpers = require('./helpers/truffleTestHelper');
const LPhelpers = require('./helpers/lotteryPotHelper');
// Test contract and data
const fixtures = require('./assets/fixtures.json');
const LotteryPot = artifacts.require("./LotteryPot.sol");

// Some constant variables decl
const lotteryPotData = fixtures.lotteryPots.fixtures[0];
const lotteryPotEnum = fixtures.lotteryPots.enum;

const w3utils = web3.utils;
const VALID_POT_MIN_STAKE = w3utils.toBN(w3utils.toWei(lotteryPotData.minStake.toString(), "ether"));
const INVALID_POT_MIN_STAKE = VALID_POT_MIN_STAKE.subn(1000);
const MAX_DISCREPANCY = w3utils.toBN('1000000000000000');
const NULL_ADDRESS_PREFIX = "0x0000000000";

contract("TestLotteryPot - general", accts => {

  before(() => {
    LPhelpers.lotteryPotIntialSetup.bind(this)(accts, VALID_POT_MIN_STAKE);
  })

  it("should construct a new contract with proper data", async() => {
    const instance = await LotteryPot.deployed();

    assert.isOk(await instance.isOwner({ from: this.owner }));
    assert.equal(await instance.potName(), lotteryPotData.potName);

    assert.isOk((await instance.minStake()).eq(VALID_POT_MIN_STAKE));
    assert.equal(await instance.potType(), lotteryPotEnum.potType.equalShare);
    assert.equal(await instance.potState(), lotteryPotEnum.potState.open);
    assert.equal(await instance.totalParticipants(), 1);
    assert.isOk((await instance.totalStake()).eq(VALID_POT_MIN_STAKE));
  });

  it("should failed to participate if participant specified less than minStake", async() => {
    const instance = await LotteryPot.deployed();
    const w3instance = new web3.eth.Contract(LotteryPot.abi, LotteryPot.address);

    // This should failed
    const acctFrom = this.secondParticipant.from;

    // Note: we use the web3 contract instance instead of TruffleContract because
    //   truffle does not handle overloaded functions well
    const error = await w3instance.methods.participate()
      .send({ from: acctFrom, value: INVALID_POT_MIN_STAKE })
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");
  });

  it("should allow a new participant to join, and the participant can add stake to the same pot", async() => {

    const instance = await LotteryPot.deployed();
    const w3instance = new web3.eth.Contract(LotteryPot.abi, LotteryPot.address);

    // 2nd participant
    let totalStake = await instance.totalStake();
    let totalParticipants = await instance.totalParticipants();

    // We spread the params out at the end, because `send()` modify the option
    //   object - WTF!
    const tx = await w3instance.methods.participate().send({...this.secondParticipant});

    totalParticipants.iaddn(1);
    totalStake.iadd(this.secondParticipant.value);

    // Test event is emitted
    Object.keys(tx.events);
    assert.equal(Object.keys(tx.events).length, 1);
    const ev = Object.entries(tx.events)[0][1];
    assert.equal(ev.returnValues["participant"], this.secondParticipant.from);

    // Test contract state
    assert.isOk((await instance.totalStake()).eq(totalStake));
    assert.isOk((await instance.totalParticipants()).eq(totalParticipants));

    // Test my stake is recorded properly
    assert.isOk((await instance.myStake({ from: this.secondParticipant.from }))
      .eq(this.secondParticipant.value));

    // 2. Test second participant can add stake to it.
    const addStakeTx = await w3instance.methods.participate().send({...this.secondParticipant});

    // Total stake should have incremented, but total participant # remains the same.
    totalStake.iadd(this.secondParticipant.value);

    assert.isOk((await instance.totalStake()).eq(totalStake));
    assert.isOk((await instance.totalParticipants()).eq(totalParticipants));
    assert.isOk((await instance.myStake({ from: this.secondParticipant.from }))
      .eq(this.secondParticipant.value.muln(2)));
  });
});

contract("TestLotteryPot - lifecycle", accts => {

  before(() => {
    LPhelpers.lotteryPotIntialSetup.bind(this)(accts, VALID_POT_MIN_STAKE);
  })

  it("a contract ends, determines winner, and allow winner(and only winner) to withdraw fund, also test winner cannot double withdraw", async() => {

    const instance = await LotteryPot.deployed();
    await instance.participate(this.secondParticipant.from, {...this.secondParticipant});

    let error = null, tx = null, ev = null;

    // Test: Should fail if we close now
    error = await instance.determineWinner()
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");

    // Fast forward time
    await helpers.advanceTimeAndBlock(lotteryPotData.duration + 1);

    tx = await instance.determineWinner();

    // Test: Verify event is emitted.
    ev = tx.logs[0];
    assert.isOk(ev);
    assert.equal(ev.event, "WinnerDetermined");

    // Test: Verify a winner is determined, so winner address not start with "0x00000..."
    const winner = await instance.winner();
    assert.isFalse(winner.toString().startsWith(NULL_ADDRESS_PREFIX));

    // Test: Withdraw money from a non-winner. This should fail
    error = await instance.winnerWithdraw({ from: this.thirdParticipant.from })
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");

    // Withdraw money by winner
    const beforeBal = w3utils.toBN(await web3.eth.getBalance(winner));
    tx = await instance.winnerWithdraw({ from: winner });
    const afterBal = w3utils.toBN(await web3.eth.getBalance(winner));
    const totalStake = await instance.totalStake();

    // note: we accept to have tiny discrepancy due to gas cost:
    //   afterBal - beforeBal - totalStake = 0 (if no gas cost. With gas cost,
    //   it is expected to be a tiny negative number).
    assert.isOk( afterBal.sub(beforeBal).sub(totalStake).abs().lte(MAX_DISCREPANCY) );

    // Test: winner withdraw again, this should fail
    error = await instance.winnerWithdraw({ from: winner })
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");
  });
});

contract("TestLotteryPot - fallback function", accts => {

  before(() => {
    LPhelpers.lotteryPotIntialSetup.bind(this)(accts, VALID_POT_MIN_STAKE);
  })

  it("should allows user to partcipate with the fallback function", async() => {

    const instance = await LotteryPot.deployed();
    let totalStake = w3utils.toBN(await instance.totalStake());
    let totalParticipants = w3utils.toBN(await instance.totalParticipants());

    // Calling the contract fallback method with sendTransaction
    let tx = await web3.eth.sendTransaction({ to: instance.address,
      ...this.secondParticipant });

    // update our internal state to keep track of the change
    totalParticipants.iaddn(1);
    totalStake.iadd(this.secondParticipant.value);

    assert.equal(totalParticipants.toString(), await instance.totalParticipants());
    assert.equal(totalStake.toString(), await instance.totalStake());
  });
});

contract("TestLotteryPot - circuit breaker 01", accts => {

  before(() => {
    LPhelpers.lotteryPotIntialSetup.bind(this)(accts, VALID_POT_MIN_STAKE);
  })

  it("should allows only contract creator to toggle `enabled` status", async() => {
    const instance = await LotteryPot.deployed();
    const secondAcct = this.secondParticipant.from;
    let enabledState = await instance.enabled();

    // Test: By default a contract is in `enabled` state
    assert.equal(enabledState, true);

    // Test: Verify contract `enabled` state cannot be toggled by random account
    let error = await instance.toggleEnabled({ from: secondAcct })
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");

    let tx = await instance.toggleEnabled({ from: this.owner });
    enabledState = !enabledState;

    // Test: the `enabled` state should have toggled
    assert.equal(enabledState, await instance.enabled());
  });
});

contract("TestLotteryPot - circuit breaker 02", accts => {

  it("when LotteryPot is disabled, new participant cannot join, existing participants can withdraw money, but cannot over-withdraw", async() => {

    // Disable the LotteryPot
    const instance = await LotteryPot.deployed();
    let tx = await instance.toggleEnabled({ from: this.owner });

    // Test: 2nd participant try to join, should fail
    let error = await instance.participate(this.secondParticipant.from, {...this.secondParticipant})
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");

    // Test: allow the owner (existing participant) to withdraw money
    let beforeBal = w3utils.toBN(await web3.eth.getBalance(this.owner));
    let participantStake = w3utils.toBN(await instance.myStake({ from: this.owner }));
    tx = await instance.participantWithdraw({ from: this.owner });

    let afterBal = beforeBal.add(participantStake);
    let ownerCurrentBal = w3utils.toBN(await web3.eth.getBalance(this.owner));

    // Test: beforeBal + participantStake - current user balance = minor gas cost
    //        (stored in var `afterBal`)
    //
    assert.isOk( afterBal.sub(ownerCurrentBal).lte(MAX_DISCREPANCY) );

    // Test: participant cannot over-withdraw. The following should fail
    error = await instance.participantWithdraw({ from: this.owner })
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");
  });

});

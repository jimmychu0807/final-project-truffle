"use strict"

// Helpers
const helpers = require('./helpers/truffleTestHelper');
const LPhelpers = require('./helpers/lotteryPotHelper');
// Test contract and data
const fixtures = require('./assets/fixtures.json');
const LotteryPotFactory = artifacts.require("./LotteryPotFactory.sol");
const LotteryPot = artifacts.require("./LotteryPot.sol");

// Some constant variables decl
const lotteryPotData = fixtures.lotteryPots.fixtures[0];
const lotteryPotEnum = fixtures.lotteryPots.enum;

const w3utils = web3.utils;
const VALID_POT_MIN_STAKE = w3utils.toBN(w3utils.toWei(lotteryPotData.minStake.toString(), "ether"));
const MAX_DISCREPANCY = w3utils.toBN('1000000000000000');
const NULL_ADDRESS_PREFIX = "0x0000000000";

contract("TestLotteryPotFactory - createLotteryPot", accts => {

  before(() => {
    LPhelpers.lotteryPotIntialSetup.bind(this)(accts, VALID_POT_MIN_STAKE);
  })

  it ("should able to create multiple lottery pots, stored internally, retrieve pots given addresses, and disable these pots", async() => {

    const factory = await LotteryPotFactory.deployed();

    const pd = lotteryPotData;
    let tx1 = await factory.createLotteryPot(pd.potName, pd.duration,
      VALID_POT_MIN_STAKE, pd.potType, { from: this.owner,
      value: VALID_POT_MIN_STAKE });

    const secondPotName = "test2";
    let tx2 = await factory.createLotteryPot(secondPotName, pd.duration,
      VALID_POT_MIN_STAKE, pd.potType, { from: this.owner,
      value: VALID_POT_MIN_STAKE });

    // Test 1: There should be two addresses stored in the array
    const lotteryPots = await factory.getLotteryPots();
    assert.equal(lotteryPots.length, 2);

    // Test 2: using the first array entries should be able to retrieve the first
    //   LotteryPot contract, same for the 2nd contract.
    //
    const firstPot = await LotteryPot.at(lotteryPots[0]);
    const secondPot = await LotteryPot.at(lotteryPots[1]);
    assert.equal(pd.potName, await firstPot.potName());
    assert.equal(secondPotName, await secondPot.potName());

    // Test 3: owner of the pot cannot disable the lottery pot
    let error = await firstPot.toggleEnabled({ from: this.owner })
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");

    // Test 4: non-owner of the factory cannot disable the lottery pot
    error = await factory.toggleLotteryPotEnabled(firstPot.address, {
      from: this.secondParticipant.from })
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");

    // Test 5: owner of the factory can disable the lottery pot
    let toggleTx = await factory.toggleLotteryPotEnabled(firstPot.address, {
      from: this.owner });
    assert.equal(false, await firstPot.enabled());
  });
});

contract("TestLotteryPotFactory - circuit breaker 01", accts => {

  before(() => {
    LPhelpers.lotteryPotIntialSetup.bind(this)(accts, VALID_POT_MIN_STAKE);
  })

  it("should allows only factory owner to toggle `enabled` status", async() => {
    const factory = await LotteryPotFactory.deployed();
    const secondAcct = this.secondParticipant.from;
    let enabledState = await factory.enabled();

    // Test: By default a contract is in `enabled` state
    assert.equal(enabledState, true);

    // Test: Verify contract `enabled` state cannot be toggled by random account
    let error = await factory.toggleEnabled({ from: secondAcct })
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");

    let tx = await factory.toggleEnabled({ from: this.owner });
    enabledState = !enabledState;

    // Test: the `enabled` state should have toggled
    assert.equal(enabledState, await factory.enabled());
  });

});

contract("TestLotteryPotFactory - circuit breaker 02", accts => {

  before(() => {
    LPhelpers.lotteryPotIntialSetup.bind(this)(accts, VALID_POT_MIN_STAKE);
  })

  it("when disabled, should not allow contract creation", async() => {

    // disable the factory
    const factory = await LotteryPotFactory.deployed();
    let tx = await factory.toggleEnabled({ from: this.owner });

    // Test: try to create contract, should fail
    const pd = lotteryPotData;
    let error = await factory.createLotteryPot(pd.potName, pd.duration,
      VALID_POT_MIN_STAKE, pd.potType, { from: this.owner,
      value: VALID_POT_MIN_STAKE })
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");
  });
});

"use strict"

const moment = require('moment');
const fixtures = require('./assets/fixtures.json');
const LotteryPot = artifacts.require("./LotteryPot.sol");

// Some constant variables decl
const lotteryPotData = fixtures.lotteryPots.fixtures[0];
const lotteryPotEnum = fixtures.lotteryPots.enum;
const rejectedMinStake = web3.utils.toWei(
  (lotteryPotData.minStake - 0.01).toString(), "ether");
const acceptedMinStake = web3.utils.toWei(
  lotteryPotData.minStake.toString(), "ether");

contract("TestLotteryPot", accts => {

  before(() => {
    this.owner = accts[0];
    this.first_participant = accts[1];
  })

  it("should construct a new contract with proper data", async() => {
    const instance = await LotteryPot.deployed();

    assert(await instance.isOwner({ from: this.owner }));
    assert.equal(await instance.potName(), lotteryPotData.potName);
    assert.equal(await instance.minStake(), acceptedMinStake);
    assert.equal(await instance.potType(), lotteryPotEnum.potType.fairShare);
    assert.equal(await instance.potState(), lotteryPotEnum.potState.open);
    assert.equal(await instance.totalParticipants(), 0);
  });

  it("should failed to participate as less than minStake", async() => {
    const instance = await LotteryPot.deployed();

    // This should failed
    const error = await instance.participate({ from: this.first_participant, value: rejectedMinStake })
      .then(assert.fail, err => err);
    assert.include(error.message, "VM Exception while processing transaction: revert");
  });

  it("should allow a new participant to join", async() => {
    const instance = await LotteryPot.deployed();

    // 1st participant
    const tx = await instance.participate({ from: this.first_participant, value: acceptedMinStake });

    assert.equal(tx.logs.length, 1);

    const ev = tx.logs[0];
    assert.equal(ev.args["participant"], this.first_participant);
    assert.equal(ev.args["value"], acceptedMinStake);

    assert.equal(await web3.eth.getBalance(instance.address), acceptedMinStake);
    assert.equal(await instance.participantsMapping(this.first_participant),
      acceptedMinStake);
    assert.equal(await instance.totalParticipants(), 1);

    // 2nd participant
    const secondParticipant = accts[2];
    const secondStake = web3.utils.toWei((lotteryPotData.minStake + 0.5).toString(), "ether");

    assert(await instance.participate({ from: secondParticipant,
      value: secondStake }));

    let totalStake = web3.utils.toBN(acceptedMinStake).add( web3.utils.toBN(secondStake) );
    assert.equal(await web3.eth.getBalance(instance.address), totalStake);
    assert.equal(await instance.totalParticipants(), 2);
  });
});

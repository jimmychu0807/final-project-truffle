// For simulating time advancement in truffle test suite.
//   Ref: https://medium.com/edgefund/time-travelling-truffle-tests-f581c1964687

const advanceTime = (time) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [time],
      id: new Date().getTime(),
    }, (err, res) => {
      if (err) return reject(err);
      return resolve(res);
    });
  });
}

const advanceBlock = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: "2.0",
      method: "evm_mine",
      id: new Date().getTime(),
    }, (err, res) => {
      if (err) return reject(err);
      const newBlockHash = web3.eth.getBlock('latest').hash;

      return resolve(newBlockHash);
    });
  })
}

const advanceTimeAndBlock = async (time) => {
  await advanceTime(time);
  await advanceBlock();

  return Promise.resolve(web3.eth.getBlock('latest'));
}

module.exports = { advanceTime, advanceBlock, advanceTimeAndBlock }

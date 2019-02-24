require('console-stamp')(console, '[HH:MM:ss.l]');
const asyncChunks = require('async-chunks');
const ethereumjs = require('merkle-patricia-tree');
const ethUtil = require('ethereumjs-util');
const rainblock = require('@rainblock/merkle-patricia-tree');
const utils = require('./utils');
const wait = require('wait-for-stuff');

const main = async (state, blockNum) => {
  const pipeline = utils.readStateDump(blockNum)
  for await (const data of asyncChunks(pipeline)) {
    const key = ethUtil.keccak256(Buffer.from(data.key, 'hex'));
    const val = utils.ethAccountToRlp(data.value);
    if (state instanceof rainblock.MerklePatriciaTree) {
      state.get(key);
    } else if (state) {
      let flag = false;
      state.get(key, () => {flag = true});
      wait.for.predicate(() => flag);
    }
  }
};

const setup = async (state, blockNum) => {
  const pipeline = utils.readStateDump(blockNum)
  for await (const data of asyncChunks(pipeline)) {
    const key = ethUtil.keccak256(Buffer.from(data.key, 'hex'));
    const val = utils.ethAccountToRlp(data.value);
    if (state instanceof rainblock.MerklePatriciaTree) {
      state.put(key, val);
    } else if (state) {
      let flag = false;
      state.put(key, val, () => {flag = true});
      wait.for.predicate(() => flag);
    }
  }
}

const suite = utils.newBenchmark();

for (let blockNum = utils.startBlock; blockNum < utils.endBlock; blockNum += utils.interval) {
  if (blockNum in utils.skipBlocks) {
    continue;
  }

  const block = blockNum.toString();
  const rstate = new rainblock.MerklePatriciaTree();
  const estate = new ethereumjs();

  utils.addAsyncTest(suite, '--- ' + block, main, setup, null, blockNum);
  utils.addAsyncTest(suite, 'RBC ' + block, main, setup, rstate, blockNum);
  utils.addAsyncTest(suite, 'ETH ' + block, main, setup, estate, blockNum);
}
console.log("Get Block,", "ops/sec,", "ms/op,", "runs, errors");
suite.run({async: true});

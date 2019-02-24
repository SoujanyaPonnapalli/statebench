require('console-stamp')(console, '[HH:MM:ss.l]');
const asyncChunks = require('async-chunks');
const ethereumjs = require('merkle-patricia-tree');
const ethUtil = require('ethereumjs-util');
const rainblock = require('@rainblock/merkle-patricia-tree');
const utils = require('./utils');
const wait = require('wait-for-stuff');

const startBlock = 1000000;
const endBlock = 4000000;
const interval = 1000000;
const skipBlocks = [2500000, 2600000, 2700000];
const batchSize = [100, 500, 1000]

const main = async (state, blockNum, batch) => {
  const pipeline = utils.readStateDump(blockNum)
  let numKeys = 0;
  batchOps = [];
  for await (const data of asyncChunks(pipeline)) {
    const key = ethUtil.keccak256(Buffer.from(data.key, 'hex'));
    const val = utils.ethAccountToRlp(data.value);
    numKeys += 1;
    if (numKeys % batch !== 0) {
      batchOps.push({'key': key, 'val': val});
      continue;
    }
    if (state instanceof rainblock.MerklePatriciaTree) {
      state.batch(batchOps, []);
    } else if (state) {
      let flag = false;
      state.batch(batchOps, () => {flag = true});
      wait.for.predicate(() => flag);
    }
    batchOps = [];
  }
};

const setup = async (state, blockNum, batch) => {
}

const suite = utils.newBenchmark();

for (let blockNum = startBlock; blockNum <= endBlock; blockNum += interval) {
  if (blockNum in skipBlocks) {
    continue;
  }

  for (let batch of batchSize) {
    const block = blockNum.toString();
    const rstate = new rainblock.MerklePatriciaTree();
    const estate = new ethereumjs();
  
    utils.addAsyncTest(suite, '--- ' + block, main, setup, null, blockNum, batch);
    utils.addAsyncTest(suite, 'RBC ' + block, main, setup, rstate, blockNum, batch);
    utils.addAsyncTest(suite, 'ETH ' + block, main, setup, estate, blockNum, batch);  
  }
}
console.log("Put Block,", "ops/sec,", "ms/op,", "runs, errors");
suite.run({async: true});

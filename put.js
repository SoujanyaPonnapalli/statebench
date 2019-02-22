const ethereumjs = require('merkle-patricia-tree');
const rainblock = require('@rainblock/merkle-patricia-tree');
const ethUtil = require('ethereumjs-util');
const utils = require('./utils');
const asyncChunks = require('async-chunks');

const startBlock = 100000;
const endBlock = 4000000;
const interval = 100000;
const skipBlocks = [2500000, 2600000, 2700000];

const main = async (state, blockNum) => {
  const pipeline = utils.readStateDump(blockNum)
  for await (const data of asyncChunks(pipeline)) {
    const key = ethUtil.keccak256(Buffer.from(data.key, 'hex'));
    const val = util.ethereumAccountToRlp(data.value);
    state.put(key, val);
    numKeys += 1;
  }
};

const setup = async () => {
}

const suite = utils.newBenchmark();

for (let blockNum = startBlock; blockNum <= endBlock; blockNum += interval) {
  if (blockNum in skipBlocks) {
    continue;
  }
  const block = blockNum.toString();
  utils.addAsyncTest(suite, 'Put RBC:' + block, main, setup, new rainblock.MerklePatriciaTree(), blockNum);
  utils.addAsyncTest(suite, 'Put ETH:' + block, main, setup, new ethereumjs(), blockNum);  
}
suite.run({async: true});
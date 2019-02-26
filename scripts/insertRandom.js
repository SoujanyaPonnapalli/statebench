require('console-stamp')(console, '[HH:MM:ss.l]');
const asyncChunks = require('async-chunks');
const ethereumjs = require('merkle-patricia-tree');
const ethUtil = require('ethereumjs-util');
const rainblock = require('@rainblock/merkle-patricia-tree');
const utils = require('./utils');
const wait = require('wait-for-stuff');

const main = async (state, rounds, batchSize, insertTimes, heapUsed) => {
  let numKeys = rounds * batchSize;
  if (!insertTimes[numKeys]) {
    insertTimes[numKeys] = [0, 0];
    heapUsed[numKeys] = 0;
  }
  global.gc();
  let startHeap = process.memoryUsage().heapUsed/(1024*1024);
  let startTime = process.hrtime();
  utils.generateStandardTree(state, rounds, batchSize);
  let endTime = process.hrtime(startTime);
  let endHeap = process.memoryUsage().heapUsed/(1024*1024);
  insertTimes[numKeys][0] += endTime[0];
  insertTimes[numKeys][1] += endTime[1];
  heapUsed[numKeys] += (endHeap - startHeap);
};

const printStats = async (state, rounds, batchSize, insertTimes, heapUsed) => {
  let numKeys = rounds * batchSize;
  const endTime = insertTimes[numKeys];
  console.log((rounds*batchSize).toString()+ ", "+ batchSize.toString()+ ", "+
    (heapUsed[numKeys]).toFixed(2) + ", ",
    (endTime[0]*1000 + (endTime[1]/1000000)).toFixed(2));
}

function getStats () {
  const stateOpts = [null, 'rainblock', 'ethereumjs'];

  for (let newState of stateOpts) {
    console.log("NumKeys, BatchSize, heapUsed(MB), totalTime(ms)");
    for (let rounds = 1000; rounds < 100000; rounds += 10000) {
      const runTimes = {};
      const heapUsed = {};
      const runs = 3;
      const batchSize = 100;

      let state;
      for (let i = 0; i < runs; i++) {
        if (newState === null) {
          state = null;
        } else if (newState === 'rainblock') {
          state = new rainblock.MerklePatriciaTree();
        } else if (newState === 'ethereumjs') {
          state = new ethereumjs();
        }
        let flag = false;
        main(state, rounds, batchSize, runTimes, heapUsed).then(() => {flag = true});
        wait.for.predicate(() => flag);
      }
      let numKeys = rounds * batchSize;
      runTimes[numKeys] = [runTimes[numKeys][0]/runs, runTimes[numKeys][1]/runs]
      heapUsed[numKeys] = heapUsed[numKeys]/runs;
      flag = false;
      printStats(state, rounds, batchSize, runTimes, heapUsed).then(() => {flag = true});
      wait.for.predicate(() => flag);
    }
  }
}

getStats();

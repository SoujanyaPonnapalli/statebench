require('console-stamp')(console, '[HH:MM:ss.l]');
const asyncChunks = require('async-chunks');
const ethereumjs = require('merkle-patricia-tree');
const ethUtil = require('ethereumjs-util');
const rainblock = require('@rainblock/merkle-patricia-tree');
const utils = require('./utils');
const wait = require('wait-for-stuff');

const main = async (stateOpts, numKeys, batchSize, insertTimes, heapUsed) => {
  let state;
  if (stateOpts === 'noop') {
    state = null;
  } else if (stateOpts === 'rainblock') {
    state = new rainblock.MerklePatriciaTree();
  } else if (stateOpts === 'ethereumjs') {
    state = new ethereumjs();
  }

  if (!insertTimes[numKeys]) {
    insertTimes[numKeys] = [0, 0];
    heapUsed[numKeys] = 0;
  }

  global.gc();
  let startHeap = process.memoryUsage().heapUsed/(1024*1024);
  let startTime = process.hrtime();
  utils.generateStandardTree(state, numKeys, batchSize);
  let endTime = process.hrtime(startTime);
  let endHeap = process.memoryUsage().heapUsed/(1024*1024);
  insertTimes[numKeys][0] += endTime[0];
  insertTimes[numKeys][1] += endTime[1];
  heapUsed[numKeys] += (endHeap - startHeap);

  state = null;
  global.gc();
};

const printStats = async (numKeys, batchSize, insertTimes, heapUsed) => {
  const endTime = insertTimes[numKeys];
  console.log((numKeys).toString()+ ", "+
    (heapUsed[numKeys]).toFixed(2) + ", ",
    (endTime[0]*1000 + (endTime[1]/1000000)).toFixed(2));
}

function getStats () {
  const stateOpts = ['rainblock', 'ethereumjs'];
  const batchOpts = [1, 10, 100, 1000]

  for (let batchSize of batchOpts) {
    for (let opt of stateOpts) {
      if (!opt && batchSize !== 1) {
        continue;
      }
      console.log();
      console.log(opt, batchSize);
      console.log("NumKeys, heapUsed(MB), totalTime(ms) ");
      for (let numKeys = 100000; numKeys <= 10000000; numKeys += 100000) {
        const runTimes = {};
        const heapUsed = {};
        const runs = 5;

        for (let i = 0; i < runs; i++) {
          let flag = false;
          main(opt, numKeys, batchSize, runTimes, heapUsed).then(() => {flag = true});
          wait.for.predicate(() => flag);
        }

        runTimes[numKeys] = [runTimes[numKeys][0]/runs, runTimes[numKeys][1]/runs]
        heapUsed[numKeys] = heapUsed[numKeys]/runs;
        flag = false;
        printStats(numKeys, batchSize, runTimes, heapUsed).then(() => {flag = true});
        wait.for.predicate(() => flag);

        if ((numKeys % 10000000 === 0) && (numKeys/10000000 >= 1)) {
          numKeys += 9900000
          continue;
        }
        if ((numKeys % 1000000 === 0) && (numKeys/1000000 >= 1)) {
          numKeys += 900000
        }
      }
    }
  }
}

getStats();

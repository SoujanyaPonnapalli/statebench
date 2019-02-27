require('console-stamp')(console, '[HH:MM:ss.l]');
const asyncChunks = require('async-chunks');
const ethereumjs = require('merkle-patricia-tree');
const ethUtil = require('ethereumjs-util');
const rainblock = require('@rainblock/merkle-patricia-tree');
const utils = require('./utils');
const wait = require('wait-for-stuff');

let batchOps = []

const main = (stateOpts, numKeys, batchSize, insertTimes, heapUsed) => {
  if (!insertTimes[numKeys]) {
    insertTimes[numKeys] = [0, 0];
    heapUsed[numKeys] = 0;
  }

  let state;
  if (stateOpts === 'rainblock') {
    state = new rainblock.MerklePatriciaTree();
  } else if (stateOpts === 'ethereumjs') {
    state = new ethereumjs();
  }	
  global.gc();
  let newBatch = utils.generateStandardTree(null, numKeys - batchOps.length, batchSize);
  batchOps = batchOps.concat(newBatch);
  let startHeap = process.memoryUsage().heapUsed/(1024*1024);
  let startTime = process.hrtime();

  if (state instanceof rainblock.MerklePatriciaTree) {
    state.batch(batchOps);
  } else if (state) {
    let flag = false;
    state.batch(batchOps, () => {flag = true});
    wait.for.predicate(() => flag);
  }

  let endTime = process.hrtime(startTime);
  let endHeap = process.memoryUsage().heapUsed/(1024*1024);
  insertTimes[numKeys][0] += endTime[0];
  insertTimes[numKeys][1] += endTime[1];
  heapUsed[numKeys] += (endHeap - startHeap);

};

const printStats = async (numKeys, batchSize, insertTimes, heapUsed) => {
  const endTime = insertTimes[numKeys];
  console.log((numKeys).toString()+ ", "+
    (heapUsed[numKeys]).toFixed(2) + ", ",
    (endTime[0]*1000 + (endTime[1]/1000000)).toFixed(2));
}

function getStats () {
  const stateOpts = ['rainblock', 'ethereumjs']
  //const stateOpts = ['noop', 'ethereumjs', 'rainblock'];
  const batchOpts = [1]//, 10, 100, 1000]

  for (let batchSize of batchOpts) {
    for (let opt of stateOpts) {
      batchOps = [];
      console.log(opt, batchSize);
      console.log("NumKeys, heapUsed(MB), totalTime(ms) ");
      for (let numKeys = 100000; numKeys <= 1000000; numKeys += 100000) {
        const runTimes = {};
        const heapUsed = {};
        const runs = 5;

        for (let i = 0; i < runs; i++) {
          main(opt, numKeys, batchSize, runTimes, heapUsed)
        }

        runTimes[numKeys] = [runTimes[numKeys][0]/runs, runTimes[numKeys][1]/runs]
        heapUsed[numKeys] = heapUsed[numKeys]/runs;
        flag = false;
        printStats(numKeys, batchSize, runTimes, heapUsed).then(() => {flag = true});
        wait.for.predicate(() => flag);
      }
    }
  }
}

getStats();

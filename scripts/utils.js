const benchmark =  require('benchmark');
const fs = require("fs-extra");
const path = require("path");
const Pick = require("stream-json/filters/Pick");
const RLP = require('rlp');
const streamChain = require("stream-chain");
const streamJson = require("stream-json");
const streamObject = require("stream-json/streamers/StreamObject");

module.exports = {
  ethAccountToRlp,
  newBenchmark,
  addAsyncTest,
  readStateDump
}

module.exports.startBlock = 100000;
module.exports.endBlock = 4000000;
module.exports.interval = 100000;
module.exports.skipBlocks = [2500000, 2600000, 2700000];
module.exports.batchSize = [100, 500, 1000];


function ethAccountToRlp (account) {
  let hexBalance = BigInt(`${account.balance}`).toString(16);
  
  if (hexBalance === '0') {
      hexBalance = '';
  }
  else if (hexBalance.length % 2 === 1) {
      hexBalance = `0${hexBalance}`;
  }
  
  return RLP.encode([
      account.nonce,
      Buffer.from(hexBalance, 'hex'),
      Buffer.from(account.root, 'hex'),
      Buffer.from(account.codeHash, 'hex')
  ]);
}

function addAsyncTest (
  suite, name, asyncTest, setup, state, ...args) {

  suite.add(name, {
    defer: true,
    setup: () => {
      if (setup) {
        setup(state, ...args);
      }
    },
    fn: (deferred) => {
      asyncTest(state, ...args).then(() => deferred.resolve());
    }
  });
};

function newBenchmark () {
  const suite = new benchmark.Suite();
  
  suite.on('cycle', (event) => {
    const benchmarkRun = event.target;
    const stats = benchmarkRun.stats;
    const meanInMillis = (stats.mean * 1000).toFixed(3);
    const stdDevInMillis = (stats.deviation * 1000).toFixed(4);
    const runs = stats.sample.length;
    const ops = benchmarkRun.hz.toFixed(benchmarkRun.hz < 100 ? 2 : 0);
    const err = stats.rme.toFixed(2);
  
    console.log(`${benchmarkRun.name}, ${ops}, ${meanInMillis}, ${runs}, \
 ${err}%, ${stdDevInMillis}`);
  });

  return suite;
}

function readStateDump (blockNum) {
  const filename = path.join(__dirname + '/../../stateDumps/state_' + blockNum +'.json');
  const pipeline = streamChain.chain([
    fs.createReadStream(filename),
    streamJson.parser(),
    Pick.pick({ filter: 'accounts' }),
    streamObject.streamObject(),
  ]);

  return pipeline;
}

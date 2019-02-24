"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rainblock = require("@rainblock/merkle-patricia-tree");
const ethereumjs = require("merkle-patricia-tree");
const stream_chain_1 = require("stream-chain");
const stream_json_1 = require("stream-json");
const Pick_1 = require("stream-json/filters/Pick");
const StreamObject_1 = require("stream-json/streamers/StreamObject");
const path = require("path");
const fs = require("fs-extra");
const asyncChunks = require('async-chunks');
const RLP = require('rlp');
const ethUtil = require('ethereumjs-util');
const benchmark = require('benchmark');
const async = require('async');
const {promisify} = require('util');
const memwatch = require('node-memwatch');
const wait = require('wait-for-stuff');

const heapdump = require('heapdump');
const BranchNode = require("@rainblock/merkle-patricia-tree/build/src/index").BranchNode;
const LeafNode = require("@rainblock/merkle-patricia-tree/build/src/index").LeafNode;
const ExtensionNode = require("@rainblock/merkle-patricia-tree/build/src/index").ExtensionNode;

function ethereumAccountToRlp(account) {
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

function delay(t, val) {
   return new Promise(function(resolve) {
       setTimeout(function() {
         resolve(val);
       }, t);
   });
}

const readFile = async (maxKeys) => {
  const blockNum = process.argv[2];
  const filename = path.join(__dirname + '../../../stateDumps/state_' + blockNum +'.json');
  const pipeline = stream_chain_1.chain([
    fs.createReadStream(filename),
    stream_json_1.parser(),
    Pick_1.pick({ filter: 'accounts' }),
    StreamObject_1.streamObject(),
  ]);

   const els = [];
   const elt = [];
   let numKeys = 0;
   for await (const data of asyncChunks(pipeline)) {
     if (numKeys < maxKeys) {
       const key = ethUtil.keccak256(Buffer.from(data.key, 'hex'));
       const val = (ethereumAccountToRlp(data.value));
       els.push({'key': key, 'val': val});
       numKeys += 1;
     }
   }
  return els;
}

const test_memdiff_ETH = async (els) => {
  let trees = [];
  
  const maxBatches = process.argv[4];
  
  let state = new ethereumjs();

  console.log("ETH Tree addition");
  console.log("Batch, ", "memdiff(kB), ", "memusage(MB), ", "memtotal(MB)");

  let memi = process.memoryUsage().heapUsed;
  let memf, memdiff;
  for (let i = 0; i < maxBatches; i++) {
       
    let flag_ETH = false;
    state.batch(els, () => {flag_ETH = true});
    wait.for.predicate(() => flag_ETH);
    trees.push(state);
    state = new ethereumjs();

    memf = process.memoryUsage().heapUsed;
    memdiff = memf - memi;
    memi = memf;
    console.log(`${i}, ${(memdiff/1024).toFixed(2)}, ${(memf/(1024*1024)).toFixed(2)}, ${(process.memoryUsage().heapTotal/(1024*1024)).toFixed(2)}`);
  }

  console.log("ETH Tree removal");
  console.log("Batch, ", "memdiff(kB), ", "memusage(MB), ", "memtotal(MB)");
  
  memi = process.memoryUsage().heapUsed;
  for (let i = 0; i < maxBatches; i++) {
    trees.shift();
    global.gc();
    memf = process.memoryUsage().heapUsed;
    memdiff = memf-memi;
    memi = memf;
    console.log(`${i}, ${(memdiff/1024).toFixed(2)}, ${(memf/(1024*1024)).toFixed(2)}, ${(process.memoryUsage().heapTotal/(1024*1024)).toFixed(2)}`);
  }
}
const test_memdiff_RBC = async (els) => {
  let trees = [];
  
  const maxBatches = process.argv[4];
  
  let state = new rainblock.MerklePatriciaTree();

  console.log("Tree addition");
  console.log("Batch, ", "memdiff(kB), ", "memusage(MB), ", "memtotal(MB)");

  let memi = process.memoryUsage().heapUsed;
  let memf, memdiff;
  for (let i = 0; i < maxBatches; i++) {
    if (trees.length) {
      const prevTree = trees.pop();
      trees.push(prevTree);
      trees.push(prevTree.batchCOW(els));
    } else {
      trees.push(state.batchCOW(els));
    }
    memf = process.memoryUsage().heapUsed;
    memdiff = memf - memi;
    memi = memf;
    console.log(`${i}, ${(memdiff/1024).toFixed(2)}, ${(memf/(1024*1024)).toFixed(2)}, ${(process.memoryUsage().heapTotal/(1024*1024)).toFixed(2)}`);
  }

  console.log("Tree removal");
  console.log("Batch, ", "memdiff(kB), ", "memusage(MB), ", "memtotal(MB)");
  
  memi = process.memoryUsage().heapUsed;
  for (let i = 0; i < maxBatches; i++) {
    trees.shift();
    global.gc();
    memf = process.memoryUsage().heapUsed;
    memdiff = memf-memi;
    memi = memf;
    console.log(`${i}, ${(memdiff/1024).toFixed(2)}, ${(memf/(1024*1024)).toFixed(2)}, ${(process.memoryUsage().heapTotal/(1024*1024)).toFixed(2)}`);
  }
}

const test_gctime_ETH = async (els) => {
  let trees = [];
  
  const maxBatches = process.argv[4];
  
  let state = new ethereumjs();
  
  for (let i = 0; i < maxBatches; i++) {
    let flag_ETH = false;
    state.batch(els, () => {flag_ETH = true});
    wait.for.predicate(() => flag_ETH);
    trees.push(state);
    state = new ethereumjs();
  }

  console.log("Tree removal");
  console.log("Batch, ", "gctime");
  
  let start, end;
  for (let i = 0; i < maxBatches; i++) {
    trees.shift();
    start = process.hrtime();
    global.gc();
    end = process.hrtime(start);
    console.log(`${i}, ${end}`);
  }
}
const test_gctime_RBC = async (els) => {
  let trees = [];
  
  const maxBatches = process.argv[4];
  
  let state = new rainblock.MerklePatriciaTree();

//  console.log("Tree addition");
//  console.log("Batch, ", "memdiff(kB), ", "memusage(MB), ", "memtotal(MB)");

//  let memi = process.memoryUsage().heapUsed;
//  let memf, memdiff;
  for (let i = 0; i < maxBatches; i++) {
    if (trees.length) {
      const prevTree = trees.pop();
      trees.push(prevTree);
      trees.push(prevTree.batchCOW(els));
    } else {
      trees.push(state.batchCOW(els));
    }
//    memf = process.memoryUsage().heapUsed;
//    memdiff = memf - memi;
//    memi = memf;
//    console.log(`${i}, ${(memdiff/1024).toFixed(2)}, ${(memf/(1024*1024)).toFixed(2)}, ${(process.memoryUsage().heapTotal/(1024*1024)).toFixed(2)}`);
  }

  console.log("Tree removal");
  console.log("Batch, ", "gctime");
  
//  memi = process.memoryUsage().heapUsed;
  let start, end;
  for (let i = 0; i < maxBatches; i++) {
    trees.shift();
    start = process.hrtime();
    global.gc();
    end = process.hrtime(start);
//    memf = process.memoryUsage().heapUsed;
//    memdiff = memf-memi;
//    memi = memf;
    console.log(`${i}, ${end}`);
  }
}

const test_memsize_RBC = async (els) => {
  let trees = [];
  
  const maxBatches = process.argv[4];
  
  let state = new rainblock.MerklePatriciaTree();

  console.log("Tree addition");
  console.log("Batch, ", "Leafs, ", "Leaf nodes size, ", "Branches, ", "Branch nodes size, ", "Extensions, ", "Extension nodes size, ", "Array elements diff, ", "Array elements size, ", "Total Size");

  let hdi = new memwatch.HeapDiff();
  let hdf;
  for (let i = 0; i < maxBatches; i++) {
    if (trees.length) {
      const prevTree = trees.pop();
      trees.push(prevTree);
      trees.push(prevTree.batchCOW(els));
    } else {
      trees.push(state.batchCOW(els));
    }
    hdf = hdi.end();
    let arr_num, arr_size, branch_num, branch_size, leaf_num, leaf_size, ext_num, ext_size;
    let nodels = hdf.change.details;
    for (let node of nodels) {
      if (node["what"] == 'Array') {
        arr_num = node["+"] - node["-"];
        arr_size = node.size; 
      }
      if (node["what"] == 'LeafNode') {
        leaf_num = node["+"] - node["-"];
        leaf_size = node.size; 
      }
      if (node["what"] == 'BranchNode') {
        branch_num = node["+"] - node["-"];
        branch_size = node.size; 
      }
      if (node["what"] == 'ExtensionNode') {
        ext_num = node["+"] - node["-"];
        ext_size = node.size; 
      }
    }  
    console.log(`${i}, ${leaf_num}, ${leaf_size}, ${branch_num}, ${branch_size}, ${ext_num}, ${ext_size}, ${arr_num}, ${arr_size}, ${hdf.change.size}`);
    hdi = new memwatch.HeapDiff();
  }

  console.log("Tree removal");
  console.log("Batch, ", "Leafs, ", "Leaf nodes size, ", "Branches, ", "Branch nodes size, ", "Extensions, ", "Extension nodes size, ", "Array elements diff, ", "Array elements size, ", "Total Size");

  hdi = new memwatch.HeapDiff();
  for (let i = 0; i < maxBatches; i++) {
    trees.shift();
    global.gc();
    hdf = hdi.end();
    let arr_num, arr_size, branch_num, branch_size, leaf_num, leaf_size, ext_num, ext_size;
    let nodels = hdf.change.details;
    for (let node of nodels) {
      if (node["what"] == 'Array') {
        arr_num = node["+"] - node["-"];
        arr_size = node.size;
      }
      if (node["what"] == 'LeafNode') {
        leaf_num = node["+"] - node["-"];
        leaf_size = node.size;
      }
      if (node["what"] == 'BranchNode') {
        branch_num = node["+"] - node["-"];
        branch_size = node.size;
      }
      if (node["what"] == 'ExtensionNode') {
        ext_num = node["+"] - node["-"];
        ext_size = node.size;
      }
    }
    console.log(`${i}, ${leaf_num}, ${leaf_size}, ${branch_num}, ${branch_size}, ${ext_num}, ${ext_size}, ${arr_num}, ${arr_size}, ${hdf.change.size}`);
    hdi = new memwatch.HeapDiff();
  
  }
}

let state_global;
let stats_global = [];
let flag = 0;

const generateStats = function() {
  if (flag == 7) {
    state_global = null;
  }

  flag = flag + 1;
  let heapUsed = process.memoryUsage().heapUsed;
  stats_global.push(heapUsed);
}

const test_memgraph_ETH_batch = (els) => {
  
  console.log("Tree creation for ETH batch");
  const maxKeys = process.argv[3];
  state_global = new ethereumjs();

  let flag_ETH = false;
  state_global.batch(els, () => {flag_ETH = true});
  wait.for.predicate(() => flag_ETH);

  setInterval(generateStats, 1000);

  process.on('SIGINT', function(){
    var data = JSON.stringify(stats_global);
    fs.writeFile("./graph/stats_ETH_batch_" + maxKeys + ".json", data, function(err) {
      if(err) {
        console.log(err);
      } else {
        flag = 0;
        console.log("\nSaved stats");
      }
      process.exit();
    });
  });
}
const test_memgraph_RBC_batch = (els) => {
  
  console.log("Tree creation for batch");
  const maxKeys = process.argv[3];
  state_global = new rainblock.MerklePatriciaTree();
  state_global.batch(els);

  setInterval(generateStats, 1000);

  process.on('SIGINT', function(){
    var data = JSON.stringify(stats_global);
    fs.writeFile("./graph/stats_RBC_batch_" + maxKeys + ".json", data, function(err) {
      if(err) {
        console.log(err);
      } else {
        flag = 0;
        console.log("\nSaved stats");
      }
      process.exit();
    });
  });
}

const test_memgraph_RBC_batchCOW = (els) => {
  
  console.log("Tree creation for batchCOW");
  const maxKeys = process.argv[3];
  state_global = new rainblock.MerklePatriciaTree();
  state_global = state_global.batchCOW(els);

  setInterval(generateStats, 1000);

  process.on('SIGINT', function(){
    var data = JSON.stringify(stats_global);
    fs.writeFile("./graph/stats_RBC_batchCOW_" + maxKeys + ".json", data, function(err) {
      if(err) {
        console.log(err);
      } else {
        flag = 0;
        console.log("\nSaved stats");
      }
      process.exit();
    });
  });
}

function test() {

  if (process.argv.length !== 6) {
    console.log("USAGE: node filename.js blockNumber keySize batchSize testtype. For help, input testtype as help");
    process.exit();
  }

  const maxKeys = process.argv[3];
  const prom = readFile(maxKeys);
  let els = [];
  prom.then((keys) => {els = keys});
  wait.for.predicate(() => els.length > 0)
  const maxBatches = process.argv[4];
  const type_test = process.argv[5];
  
  console.log("GCTIME block: ", process.argv[2], " keys: ", maxKeys, " batches: ", maxBatches, " test: ", type_test, " memory: ", (process.memoryUsage().heapUsed/(1024*1024)).toFixed(2), "/", (process.memoryUsage().heapTotal/(1024*1024)).toFixed(2) );

  switch (type_test){
    case "memdiff_eth":
      test_memdiff_ETH(els);
      break;
    case "memdiff_rbc":
      test_memdiff_RBC(els);
      break;
    case "gctime_eth":
      test_gctime_ETH(els);
      break;
    case "gctime_rbc":
      test_gctime_RBC(els);
      break;
    case "memsize_rbc":
      test_memsize_RBC(els);
      break;
    case "memgraph_batch":
      test_memgraph_RBC_batch(els);
      break;
    case "memgraph_batchCOW":
      test_memgraph_RBC_batchCOW(els);
      break;
    case "memgraph_ETH_batch":
      test_memgraph_ETH_batch(els);
      break;
    default:
      console.log("Provide correct app:\nmemdiff(_eth/_rbc) - Difference in memory using process.memoryUsage when adding and removing a tree\ngctime(_eth/_rbc) - Time taken to garbage collect all objects dereferenced by removing tree reference\nmemsize(_rbc) - details of node type and size added and removed in a tree\nmemgraph_batch - print heap used and delete tree formed by batch in the middle. Stop with Ctrl+C.\nmemgraph_batchCOW - print heap used and delete tree formed by batchCOW in the middle. Stop with Ctrl+C.\nmemgraph_ETH_batch - for ethereumjs");
  }
}

test();

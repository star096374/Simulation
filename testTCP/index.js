'use strict';

const Node = require('./Node.js');
const Web3 = require('web3');
const web3 = new Web3();
const contract = require('truffle-contract');
const sha256 = require('js-sha256');
const fs = require('fs');

var validationABI = fs.readFileSync('../smart_contract/build/contracts/Validation.json');
var parsedValidationABI = JSON.parse(validationABI);
var lastNetworksKeyOfValidation = Object.keys(parsedValidationABI.networks).slice(-1)[0];
var validationAddress = parsedValidationABI.networks[lastNetworksKeyOfValidation].address;

const validation_artifacts = require('../smart_contract/build/contracts/Validation.json');
var Validation = contract(validation_artifacts);
var validation = Validation.at(validationAddress);

var reputationABI = fs.readFileSync('../smart_contract/build/contracts/Reputation.json');
var parsedReputationABI = JSON.parse(reputationABI);
var lastNetworksKeyOfReputation = Object.keys(parsedReputationABI.networks).slice(-1)[0];
var reputationAddress = parsedReputationABI.networks[lastNetworksKeyOfReputation].address;

const reputation_artifacts = require('../smart_contract/build/contracts/Reputation.json');
var Reputation = contract(reputation_artifacts);
var reputation = Reputation.at(reputationAddress);

var paymentABI = fs.readFileSync('../smart_contract/build/contracts/Payment.json');
var parsedPaymentABI = JSON.parse(paymentABI);
var lastNetworksKeyOfPayment = Object.keys(parsedPaymentABI.networks).slice(-1)[0];
var paymentAddress = parsedPaymentABI.networks[lastNetworksKeyOfPayment].address;

const payment_artifacts = require('../smart_contract/build/contracts/Payment.json');
var Payment = contract(payment_artifacts);
var payment = Payment.at(paymentAddress);

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
Validation.setProvider(web3.currentProvider);
Reputation.setProvider(web3.currentProvider);
Payment.setProvider(web3.currentProvider);

var nodeID = ['node0', 'node1', 'node2', 'node3', 'node4', 'node5'];
var nodePort = [3000, 4000, 5000, 6000, 7000, 8000];
var nodeList = [];

var checkerID = ['checker0', 'checker1'];
var checkerPort = [9000, 10000];
var checkerList = [];

var startTime = 10000;
var checkReputationTime = 80000;
var simulationEndTime = 110000;

web3.eth.getAccounts(function(err, accs) {
  if (err != null) {
    console.log("There was an error fetching your accounts.");
    process.exit(1);
  }
  if (accs.length == 0) {
    console.log("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
    process.exit(1);
  }

  for (var i = 0; i < 6; i++) {
    nodeList.push(new Node({
      id: nodeID[i],
      port: nodePort[i],
      host: '127.0.0.1',
      ethereumAccount: accs[i],
      validationSystem: validation,
      reputationSystem: reputation,
      paymentSystem: payment
    }));
  }

  for (var i = 0; i < 2; i++) {
    checkerList.push(new Node({
      id: checkerID[i],
      port: checkerPort[i],
      host: '127.0.0.1',
      ethereumAccount: accs[i + nodeList.length],
      validationSystem: validation,
      reputationSystem: reputation,
      paymentSystem: payment
    }));
  }

  createTopology();
  initRelayContractRelationship();
});

// random session ID
var sessionID = Math.floor(Math.random() * 10000);

// store all the packets
var packetArray = [];
var theNumberOfPackets = 5;

for (var i = 0; i < theNumberOfPackets; i++) {
  var packet = {
    sessionID: sessionID,
    sender: 'node0',
    receiver: 'node5',
    entryPathFilter: ['node3', 'node4', 'node5'],
    pathToken: ['node0'],
    payload: "test message" + i,
    sequenceNumber: i,
    theNumberOfPackets: theNumberOfPackets
  }
  packetArray.push(packet);
}

setTimeout(function() {
  console.log("*After %d secs*", startTime / 1000);
  console.log("[%s] Add Session struct to Validation System", nodeList[0].id);

  var receiverIndex = Number(packetArray[0].receiver[4]);
  nodeList[0].addSessionToValidationSystem(nodeList[receiverIndex].ethereumAccount, packetArray);
}, startTime);

setTimeout(function() {
  console.log("*After %d secs*", checkReputationTime / 1000);
  checkReputationScore();
}, checkReputationTime);

setTimeout(function() {
  console.log("*After %d secs*", simulationEndTime / 1000);
  console.log("*Simulation Finish*");
  process.exit(0);
}, simulationEndTime);

function createTopology() {
  nodeList[0].connectToAnotherServer('Exit Relay', '127.0.0.1', nodePort[1]);
  nodeList[1].connectToAnotherServer('Exit Relay', '127.0.0.1', nodePort[2]);
  nodeList[2].connectToAnotherServer('Gateway', '127.0.0.1', nodePort[3]);
  nodeList[4].connectToAnotherServer('Entry Relay', '127.0.0.1', nodePort[3]);
  nodeList[5].connectToAnotherServer('Entry Relay', '127.0.0.1', nodePort[4]);
}

function checkReputationScore() {
  var counter = 0;
  for (var i = 0; i < nodeList.length; i++) {
    nodeList[i].reputationSystem.getReputationScore({from: nodeList[i].ethereumAccount}).then(function(result) {
      console.log("[%s] Get reputation score from Reputation System", nodeID[counter]);
      console.log("[%s] -----Data from Reputation System-----", nodeID[counter]);
      console.log("[%s] Reputation score: %d", nodeID[counter], result.toNumber());
      console.log("[%s] -----Data End-----", nodeID[counter]);

      counter += 1;
    }).catch(function(err) {
      console.log(err);
    });
  }
}

function initRelayContractRelationship() {
  nodeList[0].setRelayContract(nodeID[1], 'Exit Relay', 2000, 100, 10);
  nodeList[1].setRelayContract(nodeID[2], 'Exit Relay', 2000, 100, 10);
  nodeList[4].setRelayContract(nodeID[3], 'Entry Relay', 2000, 100, 10);
  nodeList[5].setRelayContract(nodeID[4], 'Entry Relay', 2000, 100, 10);
}

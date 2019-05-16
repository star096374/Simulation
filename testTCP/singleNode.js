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

var id = process.argv[2];
var port = process.argv[3];
var ethereumAccountIndex = process.argv[4];

var nodeToConnect = [];

for (var i = 5; i < process.argv.length; i += 7) {
  nodeToConnect.push({
    id: process.argv[i],
    type: process.argv[i+1],
    ip: process.argv[i+2],
    port: process.argv[i+3],
    maxBandwidth: process.argv[i+4],
    expirationTime: process.argv[i+5],
    price: process.argv[i+6]
  });
}

var ethereumAccountList;
var nodeInstance;

web3.eth.getAccounts(function(err, accs) {
  if (err != null) {
    console.log("[%s] There was an error fetching your accounts.", id);
    process.exit(1);
  }
  if (accs.length == 0) {
    console.log("[%s] Couldn't get any accounts! Make sure your Ethereum client is configured correctly.", id);
    process.exit(1);
  }

  ethereumAccountList = accs;

  nodeInstance = new Node({
    id: id,
    port: port,
    host: '127.0.0.1',
    ethereumAccount: accs[ethereumAccountIndex],
    validationSystem: validation,
    reputationSystem: reputation,
    paymentSystem: payment
  });
});

if (nodeToConnect.length != 0) {
  var connectTime = 5000;
  setTimeout(function() {
    nodeToConnect.forEach(function(element) {
      var relayType;
      switch (element.type) {
        case 'Exit':
          relayType = 'Exit Relay';
          break;
        case 'Entry':
          relayType = 'Entry Relay';
          break;
        case 'Gateway':
          relayType = 'Gateway';
          break;
        default:
          console.log("[%s] Invalid relay type", id);
          return;
      }

      nodeInstance.connectToAnotherServer(relayType, element.ip, element.port);
      if (relayType != 'Gateway') {
        nodeInstance.setRelayContract(element.id, relayType, element.maxBandwidth, element.expirationTime, element.price);
      }
    });
  }, connectTime);
}

if (id == 'node0') {
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

  var startTime = 10000;
  setTimeout(function() {
    console.log("[%s] Add Session struct to Validation System", id);
    var receiverIndex = Number(packetArray[0].receiver[4]);
    nodeInstance.addSessionToValidationSystem(ethereumAccountList[receiverIndex], packetArray);
  }, startTime);
}

var checkReputationTime = 90000;
setTimeout(function() {
  nodeInstance.reputationSystem.getReputationScore({from: nodeInstance.ethereumAccount}).then(function(result) {
    console.log("[%s] Get reputation score from Reputation System", id);
    console.log("[%s] -----Data from Reputation System-----", id);
    console.log("[%s] Reputation score: %d", id, result.toNumber());
    console.log("[%s] -----Data End-----", id);
  }).catch(function(err) {
    console.log(err);
  });
}, checkReputationTime);

var endTime = 110000;
setTimeout(function() {
  console.log("[%s] Process end", id);
  process.exit(0);
}, endTime);

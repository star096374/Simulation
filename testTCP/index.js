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

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
Validation.setProvider(web3.currentProvider);
Reputation.setProvider(web3.currentProvider);

var id = ['node0', 'node1', 'node2', 'node3', 'node4', 'node5'];
var port = [3000, 4000, 5000, 6000, 7000, 8000];

var nodesList = [];

var checkerEthereumAccount;

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
    nodesList.push(new Node({
      id: id[i],
      port: port[i],
      host: '127.0.0.1',
      ethereumAccount: accs[i],
      validationSystem: validation,
      reputationSystem: reputation
    }));
  }

  createTopology();

  checkerEthereumAccount = accs[6];
  setTimeout(getDataForProofOfBandwidth, 10000);
});

// random session ID
var sessionID = Math.floor(Math.random() * 10000);

var packet = {
  sessionID: sessionID,
  sender: 'node0',
  receiver: 'node5',
  entryPathFilter: ['node3', 'node4', 'node5'],
  pathToken: ['node0'],
  payload: "test message"
}
var message = Buffer.from(JSON.stringify(packet));

setTimeout(function() {
  console.log("*After 5 secs*");
  console.log("[%s] Add Session struct to Validation System", nodesList[0].id);

  var receiverIndex = Number(packet.receiver[4]);
  nodesList[0].addSessionToValidationSystem(packet.sessionID, nodesList[receiverIndex].ethereumAccount, message, packet.payload);
}, 5000);

function createTopology() {
  nodesList[0].connectToAnotherServer('Exit Relay', '127.0.0.1', port[1]);
  nodesList[1].connectToAnotherServer('Exit Relay', '127.0.0.1', port[2]);
  nodesList[2].connectToAnotherServer('Gateway', '127.0.0.1', port[3]);
  nodesList[4].connectToAnotherServer('Entry Relay', '127.0.0.1', port[3]);
  nodesList[5].connectToAnotherServer('Entry Relay', '127.0.0.1', port[4]);
}

function getDataForProofOfBandwidth() {
  console.log("*After 10 secs*");
  console.log("[checker] Get data for proof of bandwidth");

  var sessionID, payload, pathToken;
  var dataArray = [];
  var isAllDataCollected = false;
  validation.requestForCheckingSession().then(function(result) {
    sessionID = result[0].toNumber();
    payload = result[1];
    pathToken = result[2];
    validation.setSessionIsPending(sessionID, {from: checkerEthereumAccount}).then(function() {
      var pathTokenList = pathToken.split(',');
      var counter = 0;
      for (var i = 0; i < pathTokenList.length-1; i++) {
        validation.requestForCheckingData(sessionID, pathTokenList[i]).then(function(dataResult) {
          dataArray.push({
            sessionID: sessionID,
            senderID: dataResult[0],
            hashValue: dataResult[1],
            seed: dataResult[2]
          });
          if (dataArray.length == pathTokenList.length-1) {
            isAllDataCollected = true;
          }
          validation.setDataIsPending(sessionID, pathTokenList[i], {from: checkerEthereumAccount}).then(function() {
            counter += 1;
            if (isAllDataCollected == true && counter == dataArray.length) {
              doProofOfBandwidth(sessionID, payload, pathTokenList, dataArray);
            }
          }).catch(function(err) {
            console.log(err);
          });
        }).catch(function(err) {
          console.log(err);
        });
      }
    }).catch(function(err) {
      console.log(err);
    });
  }).catch(function(err) {
    console.log(err);
  });
}

function doProofOfBandwidth(sessionID, payload, pathTokenList, dataArray) {
  console.log("[checker] Start to do proof of bandwidth");
  var result = true;
  for (var i = 0; i < pathTokenList.length-1; i++) {
    var isMatched = false;
    for (var j = 0; j < dataArray.length; j++) {
      if (dataArray[j].senderID == pathTokenList[i]) {
        if (sha256(dataArray[j].seed + payload) == dataArray[j].hashValue) {
          isMatched = true;
          break;
        }
      }
    }
    if (isMatched == true) {
      continue;
    }
    else {
      result = false;
      break;
    }
  }

  console.log("[checker] Set the result of proof of bandwidth to Validation System");
  validation.setSessionIsSuccessful(sessionID, result, pathTokenList.toString(), {from: checkerEthereumAccount, gas: 1000000}).then(function() {
    validation.getSession(sessionID, {from: checkerEthereumAccount}).then(function(result) {
      console.log("[checker] -----Data from Validation System-----");
      console.log("[checker] SessionID: %d", result[0].toNumber());
      console.log("[checker] isSuccessful: %s", result[5].toString());
      console.log("[checker] -----Data End-----");
      reputation.getReputationScore({from: checkerEthereumAccount}).then(function(result) {
        console.log("[checker] Get reputation score from Reputation System");
        console.log("[checker] -----Data from Reputation System-----");
        console.log("[checker] Reputation score: %d", result.toNumber());
        console.log("[checker] -----Data End-----");
      }).catch(function(err) {
        console.log(err);
      });
    }).catch(function(err) {
      console.log(err);
    });
  }).catch(function(err) {
    console.log(err);
  });
}

setTimeout(function() {
  console.log("*After 15 secs*");
  var counter = 0;
  for (var i = 0; i < nodesList.length; i++) {
    nodesList[i].reputationSystem.getReputationScore({from: nodesList[i].ethereumAccount}).then(function(result) {
      console.log("[%s] Get reputation score from Reputation System", id[counter]);
      console.log("[%s] -----Data from Reputation System-----", id[counter]);
      console.log("[%s] Reputation score: %d", id[counter], result.toNumber());
      console.log("[%s] -----Data End-----", id[counter]);

      counter += 1;
      if (counter == nodesList.length) {
        console.log("*Simulation Finish*");
        process.exit(0);
      }
    }).catch(function(err) {
      console.log(err);
    });
  }
}, 15000);

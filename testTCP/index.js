'use strict';

const Node = require('./Node.js');
const Web3 = require('web3');
const web3 = new Web3();
const contract = require('truffle-contract');

const validation_artifacts = require('../smart_contract/build/contracts/Validation.json');
var Validation = contract(validation_artifacts);
var validation = Validation.at('0x5a5a790754539c22fadffd38e7dd885fb0690050');

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
Validation.setProvider(web3.currentProvider);

var id = ['node0', 'node1', 'node2', 'node3', 'node4', 'node5'];
var port = [3000, 4000, 5000, 6000, 7000, 8000];

var nodesList = [];

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
      validationSystem: validation
    }));
  }

  createTopology();
});

var packet = {
  sessionID: 1,
  sender: 'node0',
  receiver: 'node5',
  entryPathFilter: ['node3', 'node4', 'node5'],
  pathToken: ['node0'],
  payload: "test message"
}
var message = Buffer.from(JSON.stringify(packet));

setTimeout(function() {
  console.log("*After 1 sec*");
  console.log("[%s] Add Session struct to Validation System", nodesList[0].id);

  var receiverIndex = Number(packet.receiver[4]);
  nodesList[0].addSessionToValidationSystem(packet.sessionID, nodesList[receiverIndex].ethereumAccount, message, packet.payload);
}, 1000);

function createTopology() {
  nodesList[0].connectToAnotherServer('Exit Relay', '127.0.0.1', port[1]);
  nodesList[1].connectToAnotherServer('Exit Relay', '127.0.0.1', port[2]);
  nodesList[2].connectToAnotherServer('Gateway', '127.0.0.1', port[3]);
  nodesList[4].connectToAnotherServer('Entry Relay', '127.0.0.1', port[3]);
  nodesList[5].connectToAnotherServer('Entry Relay', '127.0.0.1', port[4]);
}

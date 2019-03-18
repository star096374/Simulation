'use strict';

const Web3 = require('web3');
const web3 = new Web3();
const contract = require('truffle-contract');

const reputation_artifacts = require('../smart_contract/build/contracts/Reputation.json');
var Reputation = contract(reputation_artifacts);
var reputation = Reputation.at('0xe305d5188ca1eb305491948f9e4d67b52c057bd7');

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
Reputation.setProvider(web3.currentProvider);

web3.eth.getAccounts(function(err, accs) {
  if (err != null) {
    console.log("There was an error fetching your accounts.");
    process.exit(1);
  }
  if (accs.length == 0) {
    console.log("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
    process.exit(1);
  }

  reputation.getResult().then(function(result) {
    console.log("Session ID: %d", result[0].toNumber());
    console.log("isSuccessful: %s", result[1].toString());
  }).catch(function(err) {
    console.log(err);
  })
});

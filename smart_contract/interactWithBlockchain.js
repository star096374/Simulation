'use strict';

const Web3 = require('web3');
const web3 = new Web3();
const contract = require('truffle-contract');

const ballot_artifacts = require('./build/contracts/Ballot.json');

var Ballot = contract(ballot_artifacts);

var ballot = Ballot.at('0x4bcff58ceb5a476ee51776b97614ce3e53349e98');

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
Ballot.setProvider(web3.currentProvider);

web3.eth.getAccounts(function(err, accs) {
  if (err != null) {
    console.log("There was an error fetching your accounts.");
    return;
  }

  if (accs.length == 0) {
    console.log("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
  }

  ballot.vote(1, {from: accs[0]}).catch(function (err) {
    console.log(err);
  });

  ballot.winningProposal().then(function(result) {
    console.log("Winner: " + result.toNumber());
  }).catch(function(err) {
    console.log(err);
  });
});

'use strict';

const Web3 = require('web3');
const web3 = new Web3();
const contract = require('truffle-contract');

const payment_artifacts = require('../smart_contract/build/contracts/Payment.json');
var Payment = contract(payment_artifacts);
var payment = Payment.at('0x44de39f374151af248d58353abac1abcd5dedd79');

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
Payment.setProvider(web3.currentProvider);

web3.eth.getAccounts(function(err, accs) {
  if (err != null) {
    console.log("There was an error fetching your accounts.");
    process.exit(1);
  }
  if (accs.length == 0) {
    console.log("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
    process.exit(1);
  }

  payment.saveMoney({from: accs[0], value: web3.toWei(10, 'ether')}).then(function() {
    console.log("Account balance: %d ether", web3.fromWei(web3.eth.getBalance(accs[0]), 'ether').toNumber());
    payment.getBalance().then(function(result) {
      console.log("Contract balance: %d ether", web3.fromWei(result, 'ether').toNumber());
      payment.getMoney({from: accs[0]}).then(function() {
        console.log("Account balance: %d ether", web3.fromWei(web3.eth.getBalance(accs[0]), 'ether').toNumber());
        payment.getBalance().then(function(result) {
          console.log("Contract balance: %d ether", web3.fromWei(result, 'ether').toNumber());
        }).catch(function(err) {
          console.log(err);
        });
      }).catch(function(err) {
        console.log(err);
      });
    }).catch(function(err) {
      console.log(err);
    });
  }).catch(function(err) {
    console.log(err);
  });
});

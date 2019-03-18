var Validation = artifacts.require("./Validation.sol");
var Reputation = artifacts.require("./Reputation.sol");
var Payment = artifacts.require("./Payment.sol");

module.exports = function(deployer) {
  deployer.deploy(Reputation).then(function() {
    deployer.deploy(Validation, Reputation.address);
  });
  deployer.deploy(Payment);
}

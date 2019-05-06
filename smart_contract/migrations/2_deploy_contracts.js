var Validation = artifacts.require("./Validation.sol");
var Reputation = artifacts.require("./Reputation.sol");
var Payment = artifacts.require("./Payment.sol");

module.exports = function(deployer) {
  deployer.then(async () => {
    await deployer.deploy(Reputation);
    await deployer.deploy(Validation, Reputation.address);
    await deployer.deploy(Payment, Validation.address);
  });
}

pragma solidity >=0.4.22 <0.6.0;

contract Payment {

  mapping (address => uint256) balanceStatus;

  constructor() public {

  }

  function saveMoney() public payable {
    balanceStatus[msg.sender] = msg.value;
  }

  function getBalance() public view returns(uint256) {
    return address(this).balance;
  }

  function getMoney() public {
    uint256 balance = balanceStatus[msg.sender];
    if (balance != 0) {
      msg.sender.transfer(balance);
    }
  }

  function pay() public pure {

  }
}

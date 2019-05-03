pragma solidity >=0.4.22 <0.6.0;

contract Payment {

  mapping (address => uint256) balanceStatus;
  // node id => ethereum address
  mapping (string => address) addressList;

  struct RelayContract {
    string relayType;
    uint256 maxBandwidth;
    uint256 setTime;
    uint256 expirationTime;
    uint256 price;
  }
  // purchaser ID => vendor ID => RelayContract
  mapping (string => mapping (string => RelayContract)) RelayContractStatus;

  constructor() public {

  }

  function initAddressList(string id) public {
    addressList[id] = msg.sender;
  }

  function setRelayContract(string _purchaserID, string _vendorID, string _relayType, uint256 _maxBandwidth, uint256 _expirationTime, uint256 _price) public payable {
    if (msg.value != _price) {
      revert("The ether you sent is unmatched with price variable");
    }
    balanceStatus[msg.sender] = msg.value;
    RelayContractStatus[_purchaserID][_vendorID].relayType = _relayType;
    RelayContractStatus[_purchaserID][_vendorID].maxBandwidth = _maxBandwidth;
    RelayContractStatus[_purchaserID][_vendorID].setTime = now;
    RelayContractStatus[_purchaserID][_vendorID].expirationTime = _expirationTime;
    RelayContractStatus[_purchaserID][_vendorID].price = _price;
  }

  /*function saveMoney() public payable {
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
  }*/

  function pay() public pure {

  }

  function getRelayContractStatus(string _purchaserID, string _vendorID) public view returns(string, uint256, uint256, uint256, uint256) {
    return (RelayContractStatus[_purchaserID][_vendorID].relayType, RelayContractStatus[_purchaserID][_vendorID].maxBandwidth, RelayContractStatus[_purchaserID][_vendorID].setTime, RelayContractStatus[_purchaserID][_vendorID].expirationTime, RelayContractStatus[_purchaserID][_vendorID].price);
  }
}

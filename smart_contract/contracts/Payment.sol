pragma solidity >=0.4.22 <0.6.0;

contract ValidationInterface {
  function getTransferStatus(string, string, string) public pure returns(uint256) {

  }
}

contract Payment {

  event relayContractIsSet(string purchaserID, string vendorID, string relayType, uint256 maxBandwidth, uint256 expirationTime);

  mapping (address => uint256) balanceStatus;
  // node id => ethereum address
  mapping (string => address) addressList;

  struct RelayContract {
    string relayType;
    uint256 maxBandwidth;
    uint256 setTime;
    uint256 expirationTime;
    uint256 price;
    bool isFinished;
  }
  // purchaser ID => vendor ID => RelayContract
  mapping (string => mapping (string => RelayContract)) relayContractStatus;

  ValidationInterface private validation;

  constructor(address _validationAddress) public {
    require(_validationAddress != address(0));

    validation = ValidationInterface(_validationAddress);
  }

  function initAddressList(string id) public {
    addressList[id] = msg.sender;
  }

  function setRelayContract(string _purchaserID, string _vendorID, string _relayType, uint256 _maxBandwidth, uint256 _expirationTime, uint256 _price) public payable {
    if (msg.value != _price) {
      revert("The ether you sent is unmatched with price variable");
    }

    balanceStatus[msg.sender] = msg.value;
    relayContractStatus[_purchaserID][_vendorID].relayType = _relayType;
    relayContractStatus[_purchaserID][_vendorID].maxBandwidth = _maxBandwidth;
    relayContractStatus[_purchaserID][_vendorID].setTime = now;
    relayContractStatus[_purchaserID][_vendorID].expirationTime = _expirationTime;
    relayContractStatus[_purchaserID][_vendorID].price = _price;
    relayContractStatus[_purchaserID][_vendorID].isFinished = false;

    emit relayContractIsSet(_purchaserID, _vendorID, _relayType, _maxBandwidth, _expirationTime);
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

  function relayContractFinish(string _purchaserID, string _vendorID) public {
    if (now < relayContractStatus[_purchaserID][_vendorID].setTime + relayContractStatus[_purchaserID][_vendorID].expirationTime) {
      return;
    }

    if (relayContractStatus[_purchaserID][_vendorID].isFinished == false) {
      relayContractStatus[_purchaserID][_vendorID].isFinished = true;
      uint256 _usedBandwidth = validation.getTransferStatus(_purchaserID, _vendorID, relayContractStatus[_purchaserID][_vendorID].relayType);
      // transfer money to vendor and purchaser
      balanceStatus[addressList[_purchaserID]] -= relayContractStatus[_purchaserID][_vendorID].price;
      uint256 _moneyToVendor = relayContractStatus[_purchaserID][_vendorID].price * _usedBandwidth / relayContractStatus[_purchaserID][_vendorID].maxBandwidth;
      addressList[_vendorID].transfer(_moneyToVendor);
      uint256 _moneyToPurchaser = relayContractStatus[_purchaserID][_vendorID].price - _moneyToVendor;
      addressList[_purchaserID].transfer(_moneyToPurchaser);
    }
  }

  function getRelayContractStatus(string _purchaserID, string _vendorID) public view returns(string, uint256, uint256, uint256, uint256) {
    return (relayContractStatus[_purchaserID][_vendorID].relayType, relayContractStatus[_purchaserID][_vendorID].maxBandwidth, relayContractStatus[_purchaserID][_vendorID].setTime, relayContractStatus[_purchaserID][_vendorID].expirationTime, relayContractStatus[_purchaserID][_vendorID].price);
  }
}

pragma solidity >=0.4.22 <0.6.0;

import "solidity-util/lib/Strings.sol";

contract Reputation {

  using Strings for string;

  mapping (address => int256) reputationScore;
  // node id => ethereum address
  mapping (string => address) addressList;

  int256 scoreUnit = 10;

  constructor() public {

  }

  function initReputationScore(string id) public {
    reputationScore[msg.sender] = 0;
    addressList[id] = msg.sender;
  }

  function addReputationScore(bool _isSuccessful, string _pathToken) public {
    if (_isSuccessful == true) {
      string[] storage pathTokenList = _pathToken.split(',');
      for (uint256 i = 0; i < pathTokenList.length; i++) {
        reputationScore[addressList[pathTokenList[i]]] += scoreUnit;
      }
    }
  }

  function getReputationScore() public view returns(int256) {
    return (reputationScore[msg.sender]);
  }
}

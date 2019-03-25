pragma solidity >=0.4.22 <0.6.0;

import "solidity-util/lib/Strings.sol";

contract Reputation {

  using Strings for string;

  mapping (address => int256) reputationScore;
  // node id => ethereum address
  mapping (string => address) addressList;

  int256 scoreUnit = 10;
  // because split() will push the result to the storage ref, you have to remember the original length
  uint256 lengthOfPathTokenList = 0;

  constructor() public {

  }

  function initReputationScore(string id) public {
    addressList[id] = msg.sender;
  }

  function addReputationScore(bool _isSuccessful, string _pathToken, address _checker) public {
    if (_isSuccessful == true) {
      string[] storage pathTokenList = _pathToken.split(',');
      for (uint256 i = lengthOfPathTokenList; i < pathTokenList.length; i++) {
        reputationScore[addressList[pathTokenList[i]]] += scoreUnit;
      }
      lengthOfPathTokenList = pathTokenList.length;
      // add reputation score of the checker
      reputationScore[_checker] += scoreUnit;
    }
  }

  function getReputationScore() public view returns(int256) {
    return (reputationScore[msg.sender]);
  }
}

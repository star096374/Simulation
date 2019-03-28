pragma solidity >=0.4.22 <0.6.0;

import "solidity-util/lib/Strings.sol";

contract Reputation {

  using Strings for string;

  mapping (address => int256) reputationScore;
  // node id => ethereum address
  mapping (string => address) addressList;

  int256 scoreUnit = 5;
  // because split() will push the result to the storage ref, you have to remember the original length
  uint256 lengthOfPathTokenList = 0;

  constructor() public {

  }

  function initReputationScore(string id) public {
    addressList[id] = msg.sender;
  }

  function addReputationScore(bool _transferResult, string _pathToken, uint256 _payloadLength, address _checker, string _transferBreakpoint, bool _PoBResult, string _PoBBreakpoint) public {
    string[] storage pathTokenList = _pathToken.split(',');
    if (_transferResult == true && _PoBResult == true) {
      for (uint256 i = lengthOfPathTokenList; i < pathTokenList.length; i++) {
        reputationScore[addressList[pathTokenList[i]]] += scoreUnit * int256(_payloadLength);
      }
    }
    else {
      for (uint256 j = lengthOfPathTokenList; j < pathTokenList.length; j++) {
        if (_PoBResult == true) {
          if (j == pathTokenList.length - 1) {
            reputationScore[addressList[pathTokenList[j]]] -= scoreUnit * int256(_payloadLength);
            reputationScore[addressList[_transferBreakpoint]] -= scoreUnit * int256(_payloadLength);
          }
          else {
            reputationScore[addressList[pathTokenList[j]]] += scoreUnit * int256(_payloadLength);
          }
        }
        else {
          if (pathTokenList[lengthOfPathTokenList].compareTo(_PoBBreakpoint) == true) {
            reputationScore[addressList[_PoBBreakpoint]] -= scoreUnit * int256(_payloadLength);
            break;
          }
          else {
            if (pathTokenList[j+1].compareTo(_PoBBreakpoint) == true) {
              reputationScore[addressList[pathTokenList[j]]] -= scoreUnit * int256(_payloadLength);
              reputationScore[addressList[_PoBBreakpoint]] -= scoreUnit * int256(_payloadLength);
              break;
            }
            else {
              reputationScore[addressList[pathTokenList[j]]] += scoreUnit * int256(_payloadLength);
            }
          }
        }
      }
    }
    lengthOfPathTokenList = pathTokenList.length;
    // add reputation score of the checker
    reputationScore[_checker] += scoreUnit * int256(_payloadLength / 5);
  }

  function getReputationScore() public view returns(int256) {
    return (reputationScore[msg.sender]);
  }
}

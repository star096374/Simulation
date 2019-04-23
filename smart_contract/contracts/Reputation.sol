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

  struct transactionStatus {
    uint256 firstTransactionTime;
    int256 addedScore;
  }

  mapping (address => mapping (address => transactionStatus)) reputationStatus;

  int256 maxAddedScore = 10000;
  uint256 resetDuration = 60;

  constructor() public {

  }

  function initReputationScore(string id) public {
    addressList[id] = msg.sender;
  }

  function addReputationScore(bool _transferResult, string _pathToken, uint256 _packetLength, address _checker, string _transferBreakpoint, bool _PoBResult, string _PoBBreakpoint) public {
    string[] storage pathTokenList = _pathToken.split(',');
    address fromNode;
    address toNode;
    int256 scoreToAdd;
    if (_transferResult == true && _PoBResult == true) {
      for (uint256 i = lengthOfPathTokenList; i < pathTokenList.length - 1; i++) {
        fromNode = addressList[pathTokenList[i]];
        toNode = addressList[pathTokenList[i+1]];
        if (reputationStatus[fromNode][toNode].firstTransactionTime == 0) {
          reputationStatus[fromNode][toNode].firstTransactionTime = now;
        }
        else if (now - reputationStatus[fromNode][toNode].firstTransactionTime > resetDuration) {
          reputationStatus[fromNode][toNode].firstTransactionTime = now;
          reputationStatus[fromNode][toNode].addedScore = 0;
        }

        scoreToAdd = scoreUnit * int256(_packetLength);
        if (reputationStatus[fromNode][toNode].addedScore + scoreToAdd > maxAddedScore) {
          scoreToAdd = maxAddedScore - reputationStatus[fromNode][toNode].addedScore;
        }

        reputationScore[fromNode] += scoreToAdd;
        reputationStatus[fromNode][toNode].addedScore += scoreToAdd;
        if (i == pathTokenList.length - 2) {
          reputationScore[toNode] += scoreToAdd;
        }
      }
    }
    else {
      for (uint256 j = lengthOfPathTokenList; j < pathTokenList.length; j++) {
        if (_PoBResult == true) {
          if (j == pathTokenList.length - 1) {
            reputationScore[addressList[pathTokenList[j]]] -= scoreUnit * int256(_packetLength);
            reputationScore[addressList[_transferBreakpoint]] -= scoreUnit * int256(_packetLength);
          }
          else {
            fromNode = addressList[pathTokenList[j]];
            toNode = addressList[pathTokenList[j+1]];
            if (reputationStatus[fromNode][toNode].firstTransactionTime == 0) {
              reputationStatus[fromNode][toNode].firstTransactionTime = now;
            }
            else if (now - reputationStatus[fromNode][toNode].firstTransactionTime > resetDuration) {
              reputationStatus[fromNode][toNode].firstTransactionTime = now;
              reputationStatus[fromNode][toNode].addedScore = 0;
            }

            scoreToAdd = scoreUnit * int256(_packetLength);
            if (reputationStatus[fromNode][toNode].addedScore + scoreToAdd > maxAddedScore) {
              scoreToAdd = maxAddedScore - reputationStatus[fromNode][toNode].addedScore;
            }

            reputationScore[fromNode] += scoreToAdd;
            reputationStatus[fromNode][toNode].addedScore += scoreToAdd;
          }
        }
        else {
          if (pathTokenList[lengthOfPathTokenList].compareTo(_PoBBreakpoint) == true) {
            reputationScore[addressList[_PoBBreakpoint]] -= scoreUnit * int256(_packetLength);
            break;
          }
          else {
            if (pathTokenList[j+1].compareTo(_PoBBreakpoint) == true) {
              reputationScore[addressList[pathTokenList[j]]] -= scoreUnit * int256(_packetLength);
              reputationScore[addressList[_PoBBreakpoint]] -= scoreUnit * int256(_packetLength);
              break;
            }
            else {
              fromNode = addressList[pathTokenList[j]];
              toNode = addressList[pathTokenList[j+1]];
              if (reputationStatus[fromNode][toNode].firstTransactionTime == 0) {
                reputationStatus[fromNode][toNode].firstTransactionTime = now;
              }
              else if (now - reputationStatus[fromNode][toNode].firstTransactionTime > resetDuration) {
                reputationStatus[fromNode][toNode].firstTransactionTime = now;
                reputationStatus[fromNode][toNode].addedScore = 0;
              }

              scoreToAdd = scoreUnit * int256(_packetLength);
              if (reputationStatus[fromNode][toNode].addedScore + scoreToAdd > maxAddedScore) {
                scoreToAdd = maxAddedScore - reputationStatus[fromNode][toNode].addedScore;
              }

              reputationScore[fromNode] += scoreToAdd;
              reputationStatus[fromNode][toNode].addedScore += scoreToAdd;
            }
          }
        }
      }
    }
    lengthOfPathTokenList = pathTokenList.length;
    // add reputation score of the checker
    reputationScore[_checker] += int256(_packetLength);
  }

  function getReputationScore() public view returns(int256) {
    return (reputationScore[msg.sender]);
  }
}

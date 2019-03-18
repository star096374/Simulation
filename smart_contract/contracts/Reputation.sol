pragma solidity >=0.4.22 <0.6.0;

contract Reputation {

  uint256 sessionID;
  bool isSuccessful;

  mapping (address => int256) reputationScore;

  constructor() public {

  }

  function initReputationScore() public {
    reputationScore[msg.sender] = 0;
  }

  function addReputation(uint256 _sessionID, bool _isSuccessful) public {
    sessionID = _sessionID;
    isSuccessful = _isSuccessful;
  }

  function getReputationScore() public view returns(int256) {
    return (reputationScore[msg.sender]);
  }

  function getResult() public view returns(uint256, bool) {
    return (sessionID, isSuccessful);
  }
}

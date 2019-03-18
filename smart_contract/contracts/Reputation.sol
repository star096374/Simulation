pragma solidity >=0.4.22 <0.6.0;

contract Reputation {

  uint256 sessionID;
  bool isSuccessful;

  constructor() public {

  }

  function addReputation(uint256 _sessionID, bool _isSuccessful) public {
    sessionID = _sessionID;
    isSuccessful = _isSuccessful;
  }

  function getResult() public view returns(uint256, bool) {
    return (sessionID, isSuccessful);
  }
}

pragma solidity >=0.4.22 <0.6.0;

import "solidity-util/lib/Strings.sol";

// a limited definition of the contract we wish to access
contract ReputationInterface {
  function addReputationScore(bool, string, uint256, address, string, bool, string) public pure {

  }
}

contract Validation {

  using Strings for string;

  event timeToUploadSeed(uint256 sessionID, address receiver, string pathToken);

  struct Session {
    uint256 id;
    address receiver;
    string payload;
    uint256 payloadLength;
    string pathToken;
    bool checkable;
    bool isPending;
    bool transferResult;
    string transferBreakpoint;
    bool PoBResult;
    string PoBBreakpoint;
  }

  struct Data {
    uint256 sessionID;
    address sender;
    string senderID;
    string hashValue;
    string seed;
    bool isPending;
  }

  Session[] SessionArray;
  Data[] DataArray;

  // notice that the type here is the contract definition itself
  ReputationInterface private reputation;

  // we will set the contract address that we wish to access in our constructor
  constructor(address _reputationAddress) public {
    // make sure that the address isn't empty
    require(_reputationAddress != address(0));

    // set the contract that we want to access by using the definiton at the top and use the address provided
    reputation = ReputationInterface(_reputationAddress);
  }

  function addSession(uint256 sessionID, address receiver, string payload, uint256 payloadLength) public {
    SessionArray.push(Session(sessionID, receiver, payload, payloadLength, "", false, false, false, "", false, ""));
  }

  function uploadData(uint256 sessionID, string senderID, string hashValue) public {
    DataArray.push(Data(sessionID, msg.sender, senderID, hashValue, "", false));
  }

  function uploadPathToken(uint256 _sessionID, string _pathToken, string _transferBreakpoint) public {
    address _receiver;
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID) {
        SessionArray[i].pathToken = _pathToken;
        _receiver = SessionArray[i].receiver;
        if (_receiver != msg.sender) {
          SessionArray[i].transferBreakpoint = _transferBreakpoint;
        }
        else {
          SessionArray[i].transferResult = true;
        }
        break;
      }
    }
    emit timeToUploadSeed(_sessionID, _receiver, _pathToken);
  }

  function uploadSeed(uint256 _sessionID, string _hashValue, string _seed) public {
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID) {
        if (DataArray[i].sender == msg.sender) {
          if (DataArray[i].hashValue.compareTo(_hashValue)) {
            DataArray[i].seed = _seed;
            break;
          }
        }
      }
    }

    bool isAllSeedsUploaded = true;
    for (uint256 j = 0; j < DataArray.length; j++) {
      if (DataArray[j].sessionID == _sessionID) {
        bytes memory temp = bytes(DataArray[j].seed);
        if (temp.length == 0) {
          isAllSeedsUploaded = false;
          break;
        }
      }
    }

    if (isAllSeedsUploaded == true) {
      for (uint256 k = 0; k < SessionArray.length; k++) {
        if (SessionArray[k].id == _sessionID) {
          SessionArray[k].checkable = true;
          break;
        }
      }
    }
  }

  function requestForCheckingSession() public view returns(uint256, string, string) {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].checkable == true && SessionArray[i].isPending == false) {
        return (SessionArray[i].id, SessionArray[i].payload, SessionArray[i].pathToken);
      }
    }
  }

  function setSessionIsPending(uint256 _sessionID) public {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID) {
        SessionArray[i].isPending = true;
        break;
      }
    }
  }

  function requestForCheckingData(uint256 _sessionID, string _senderID) public view returns(string, string, string) {
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID && DataArray[i].senderID.compareTo(_senderID) && DataArray[i].isPending == false) {
        return (DataArray[i].senderID, DataArray[i].hashValue, DataArray[i].seed);
      }
    }
  }

  function setDataIsPending(uint256 _sessionID, string _senderID) public {
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID && DataArray[i].senderID.compareTo(_senderID)) {
        DataArray[i].isPending = true;
        break;
      }
    }
  }

  function isProofOfBandwidthSuccessful(uint256 _sessionID, bool _PoBResult, string _pathToken, string _PoBBreakpoint) public {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID) {
        SessionArray[i].PoBResult = _PoBResult;
        SessionArray[i].PoBBreakpoint = _PoBBreakpoint;
        addReputationScore(SessionArray[i].transferResult, _pathToken, SessionArray[i].payloadLength, msg.sender, SessionArray[i].transferBreakpoint, _PoBResult, _PoBBreakpoint);
        break;
      }
    }
  }

  function getData(uint256 _sessionID) public view returns(uint256, string, string) {
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID && DataArray[i].sender == msg.sender) {
        return (DataArray[i].sessionID, DataArray[i].hashValue, DataArray[i].seed);
      }
    }
  }

  function getSession(uint256 _sessionID) public view returns(uint256, address, string, uint256, string, bool, string, bool, string) {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID) {
        return (SessionArray[i].id, SessionArray[i].receiver, SessionArray[i].payload, SessionArray[i].payloadLength, SessionArray[i].pathToken, SessionArray[i].transferResult, SessionArray[i].transferBreakpoint, SessionArray[i].PoBResult, SessionArray[i].PoBBreakpoint);
      }
    }
  }

  function addReputationScore(bool _transferResult, string _pathToken, uint256 _payloadLength, address _checker, string _transferBreakpoint, bool _PoBResult, string _PoBBreakpoint) public view {
    // access contract function located in other contract
    reputation.addReputationScore(_transferResult, _pathToken, _payloadLength, _checker, _transferBreakpoint, _PoBResult, _PoBBreakpoint);
  }

}

pragma solidity >=0.4.22 <0.6.0;

contract Validation {

  struct Session {
    uint256 id;
    address receiver;
    string payload;
    string pathToken;
    bool checkable;
    bool isSuccessful;
  }

  struct Data {
    uint256 sessionID;
    address sender;
    string hashValue;
    string seed;
  }

  Session[] SessionArray;
  Data[] DataArray;

  constructor() public {

  }

  function addSession(uint256 sessionID, address receiver) public {
    SessionArray.push(Session(sessionID, receiver, "", "", false, false));
  }

  function uploadData(uint256 sessionID, string hashValue) public {
    DataArray.push(Data(sessionID, msg.sender, hashValue, ""));
  }

  function uploadPayloadAndPathToken(uint256 _sessionID, string _payload, string _pathToken) public {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID) {
        SessionArray[i].payload = _payload;
        SessionArray[i].pathToken = _pathToken;
      }
    }
  }

  function uploadSeed(uint256 _sessionID, string _hashValue, string _seed) public {
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID) {
        if (DataArray[i].sender == msg.sender) {
          if (sha256(abi.encodePacked(DataArray[i].hashValue)) == sha256(abi.encodePacked(_hashValue))) {
            DataArray[i].seed = _seed;
          }
        }
      }
    }
  }

  function setCheckable(uint256 _sessionID) public {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID) {
        SessionArray[i].checkable = true;
      }
    }
  }

  function getData(uint256 index) public view returns(uint256, string, string) {
    return (DataArray[index].sessionID, DataArray[index].hashValue, DataArray[index].seed);
  }

  function getSession(uint256 index) public view returns(uint256, address, string, string) {
    return (SessionArray[index].id, SessionArray[index].receiver, SessionArray[index].payload, SessionArray[index].pathToken);
  }

}

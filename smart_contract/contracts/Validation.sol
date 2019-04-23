pragma solidity >=0.4.22 <0.6.0;

import "solidity-util/lib/Strings.sol";

// a limited definition of the contract we wish to access
contract ReputationInterface {
  function addReputationScore(bool, string, uint256, address, string, bool, string) public pure {

  }
}

contract Validation {

  using Strings for string;

  event timeToUploadSeed(uint256 sessionID, address receiver, string pathToken, uint256 sequenceNumber);
  event competeForPoB(uint256 sessionID);
  event winPoBCompetition(uint256 sessionID, address winnerOfPoBCompetition, uint256 theNumberOfPackets);

  struct Session {
    uint256 id;
    address receiver;
    string payload;
    uint256 packetLength;
    string pathToken;
    bool checkable;
    bool isPending;
    bool transferResult;
    string transferBreakpoint;
    bool PoBResult;
    string PoBBreakpoint;
    address PoBChecker;
    uint256 sequenceNumber;
    uint256 theNumberOfPackets;
  }

  struct Data {
    uint256 sessionID;
    address fromNode;
    string fromNodeID;
    string hashValue;
    string seed;
    bool isPending;
    uint256 sequenceNumber;
    string toNodeID;
  }

  // competition for proof of bandwidth
  struct PoB {
    uint256 sessionID;
    address competitor;
    uint256 randomNumber;
  }

  Session[] SessionArray;
  Data[] DataArray;
  PoB[] PoBArray;

  // notice that the type here is the contract definition itself
  ReputationInterface private reputation;

  // we will set the contract address that we wish to access in our constructor
  constructor(address _reputationAddress) public {
    // make sure that the address isn't empty
    require(_reputationAddress != address(0));

    // set the contract that we want to access by using the definiton at the top and use the address provided
    reputation = ReputationInterface(_reputationAddress);
  }

  function addSession(uint256 sessionID, address receiver, string payload, uint256 packetLength, uint256 sequenceNumber, uint256 theNumberOfPackets) public {
    SessionArray.push(Session(sessionID, receiver, payload, packetLength, "", false, false, false, "", false, "", 0, sequenceNumber, theNumberOfPackets));
  }

  function uploadData(uint256 sessionID, string fromNodeID, string hashValue, uint256 sequenceNumber) public {
    DataArray.push(Data(sessionID, msg.sender, fromNodeID, hashValue, "", false, sequenceNumber, ""));
  }

  function uploadPathToken(uint256 _sessionID, string _pathToken, string _transferBreakpoint, uint256 _sequenceNumber) public {
    address _receiver;
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID && SessionArray[i].sequenceNumber == _sequenceNumber) {
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
    emit timeToUploadSeed(_sessionID, _receiver, _pathToken, _sequenceNumber);
  }

  function uploadSeedAndToNodeID(uint256 _sessionID, string _hashValue, string _seed, uint256 _sequenceNumber, string _toNodeID) public {
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID && DataArray[i].sequenceNumber == _sequenceNumber) {
        if (DataArray[i].fromNode == msg.sender) {
          if (DataArray[i].hashValue.compareTo(_hashValue)) {
            DataArray[i].seed = _seed;
            DataArray[i].toNodeID = _toNodeID;
            break;
          }
        }
      }
    }
  }

  function setSessionCheckable(uint256 _sessionID, uint256 _sequenceNumber) public {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID && SessionArray[i].checkable == false && SessionArray[i].sequenceNumber == _sequenceNumber) {
        SessionArray[i].checkable = true;
      }
    }

    bool isAbleToCompeteForPoB = true;
    for (uint256 j = 0; j < SessionArray.length; j++) {
      if (SessionArray[j].id == _sessionID) {
        if (SessionArray[j].checkable == false) {
          isAbleToCompeteForPoB = false;
          break;
        }
      }
    }

    if (isAbleToCompeteForPoB == true) {
      emit competeForPoB(_sessionID);
    }
  }

  function joinCompetitionForPoB(uint256 _sessionID, uint256 _randomNumber) public {
    PoBArray.push(PoB(_sessionID, msg.sender, _randomNumber % 100));
  }

  function decideCheckerOfPoB(uint256 _sessionID) public {
    uint256 theNumberOfCompetitor = 0;
    uint256 totalRandomNumber = 0;
    for (uint256 i = 0; i < PoBArray.length; i++) {
      if (PoBArray[i].sessionID == _sessionID) {
        theNumberOfCompetitor++;
        totalRandomNumber += PoBArray[i].randomNumber;
      }
    }

    uint256 PoBWinner = totalRandomNumber % theNumberOfCompetitor;
    uint256 counter = 0;
    address _PoBWinnerAddress;
    for (uint256 j = 0; j < PoBArray.length; j++) {
      if (PoBArray[j].sessionID == _sessionID) {
        if (PoBWinner == counter) {
          _PoBWinnerAddress = PoBArray[j].competitor;
          break;
        }
        else {
          counter++;
        }
      }
    }

    uint256 _theNumberOfPackets = 0;
    for (uint256 k = 0; k < SessionArray.length; k++) {
      if (SessionArray[k].id == _sessionID) {
        SessionArray[k].PoBChecker = _PoBWinnerAddress;
        _theNumberOfPackets++;
      }
    }

    emit winPoBCompetition(_sessionID, _PoBWinnerAddress, _theNumberOfPackets);
  }

  function requestForCheckingSession(uint256 _sessionID, uint256 _sequenceNumber) public view returns(string, string, uint256) {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID && SessionArray[i].checkable == true && SessionArray[i].isPending == false && SessionArray[i].sequenceNumber == _sequenceNumber) {
        if (msg.sender == SessionArray[i].PoBChecker) {
          return (SessionArray[i].payload, SessionArray[i].pathToken, SessionArray[i].sequenceNumber);
        }
      }
    }
  }

  function setSessionIsPending(uint256 _sessionID, uint256 _sequenceNumber) public {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID && SessionArray[i].sequenceNumber == _sequenceNumber) {
        SessionArray[i].isPending = true;
        break;
      }
    }
  }

  function requestForCheckingData(uint256 _sessionID, string _fromNodeID, uint256 _sequenceNumber) public view returns(string, string, string, uint256) {
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID && DataArray[i].fromNodeID.compareTo(_fromNodeID) && DataArray[i].isPending == false && DataArray[i].sequenceNumber == _sequenceNumber) {
        return (DataArray[i].fromNodeID, DataArray[i].hashValue, DataArray[i].seed, DataArray[i].sequenceNumber);
      }
    }
  }

  function setDataIsPending(uint256 _sessionID, string _fromNodeID, uint256 _sequenceNumber) public {
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID && DataArray[i].fromNodeID.compareTo(_fromNodeID) && DataArray[i].sequenceNumber == _sequenceNumber) {
        DataArray[i].isPending = true;
        break;
      }
    }
  }

  function isProofOfBandwidthSuccessful(uint256 _sessionID, bool _PoBResult, string _pathToken, string _PoBBreakpoint, uint256 _sequenceNumber) public {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID && SessionArray[i].sequenceNumber == _sequenceNumber) {
        SessionArray[i].PoBResult = _PoBResult;
        SessionArray[i].PoBBreakpoint = _PoBBreakpoint;
        addReputationScore(SessionArray[i].transferResult, _pathToken, SessionArray[i].packetLength, msg.sender, SessionArray[i].transferBreakpoint, _PoBResult, _PoBBreakpoint);
        break;
      }
    }
  }

  function getData(uint256 _sessionID, uint256 _sequenceNumber) public view returns(uint256, string, string, uint256, string) {
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID && DataArray[i].fromNode == msg.sender && DataArray[i].sequenceNumber == _sequenceNumber) {
        return (DataArray[i].sessionID, DataArray[i].hashValue, DataArray[i].seed, DataArray[i].sequenceNumber, DataArray[i].toNodeID);
      }
    }
  }

  function getSessionInformation(uint256 _sessionID, uint256 _sequenceNumber) public view returns(uint256, address, string, uint256, string, uint256, uint256, address) {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID && SessionArray[i].sequenceNumber == _sequenceNumber) {
        return (SessionArray[i].id, SessionArray[i].receiver, SessionArray[i].payload, SessionArray[i].packetLength, SessionArray[i].pathToken, SessionArray[i].sequenceNumber, SessionArray[i].theNumberOfPackets, SessionArray[i].PoBChecker);
      }
    }
  }

  function getSessionStatus(uint256 _sessionID, uint256 _sequenceNumber) public view returns(uint256, address, string, bool, uint256, uint256, string, bool, string) {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID && SessionArray[i].sequenceNumber == _sequenceNumber) {
        return (SessionArray[i].id, SessionArray[i].receiver, SessionArray[i].pathToken, SessionArray[i].transferResult, SessionArray[i].sequenceNumber, SessionArray[i].theNumberOfPackets, SessionArray[i].transferBreakpoint, SessionArray[i].PoBResult, SessionArray[i].PoBBreakpoint);
      }
    }
  }

  function getPoB(uint256 _sessionID) public view returns(uint256, uint256) {
    for (uint256 i = 0; i < PoBArray.length; i++) {
      if (PoBArray[i].sessionID == _sessionID && PoBArray[i].competitor == msg.sender) {
        return (PoBArray[i].sessionID, PoBArray[i].randomNumber);
      }
    }
  }

  function addReputationScore(bool _transferResult, string _pathToken, uint256 _packetLength, address _checker, string _transferBreakpoint, bool _PoBResult, string _PoBBreakpoint) public view {
    // access contract function located in other contract
    reputation.addReputationScore(_transferResult, _pathToken, _packetLength, _checker, _transferBreakpoint, _PoBResult, _PoBBreakpoint);
  }

}

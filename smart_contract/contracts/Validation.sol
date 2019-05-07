pragma solidity >=0.4.22 <0.6.0;

import "solidity-util/lib/Strings.sol";

// a limited definition of the contract we wish to access
contract ReputationInterface {
  function modifyReputationScore(bool, string, uint256, address, string, bool, string) public pure {

  }

  function pathTokenIsInvalid(string, string, uint256, address) public pure {

  }
}

contract Validation {

  using Strings for string;

  event timeToUploadSeed(uint256 sessionID, address receiver, string pathToken, uint256 sequenceNumber);
  event competeForPoB(uint256 sessionID);
  event winPoBCompetition(uint256 sessionID, address winnerOfPoBCompetition, uint256 theNumberOfPackets);
  event PoBisTriggered(uint256 sessionID);

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
    address sender;
    string senderID;
    bool isPathTokenInvalid;
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
    uint256 counterOfTheSameSessionIDAndSequenceNumber;
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

  function addSession(uint256 sessionID, address receiver, string payload, uint256 packetLength, uint256 sequenceNumber, uint256 theNumberOfPackets, string senderID) public {
    SessionArray.push(Session(sessionID, receiver, payload, packetLength, "", false, false, false, "", false, "", 0, sequenceNumber, theNumberOfPackets, msg.sender, senderID, false));
  }

  function uploadData(uint256 sessionID, string fromNodeID, string hashValue, uint256 sequenceNumber) public {
    uint256 _counter = 0;
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == sessionID && DataArray[i].sequenceNumber == sequenceNumber) {
        _counter++;
      }
    }
    DataArray.push(Data(sessionID, msg.sender, fromNodeID, hashValue, "", false, sequenceNumber, "", _counter));
  }

  function uploadToNodeID(uint256 _sessionID, uint256 _sequenceNumber, string _toNodeID) public {
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID && DataArray[i].sequenceNumber == _sequenceNumber) {
        if (DataArray[i].fromNode == msg.sender) {
          DataArray[i].toNodeID = _toNodeID;
          break;
        }
      }
    }
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

  function uploadSeed(uint256 _sessionID, string _hashValue, string _seed, uint256 _sequenceNumber) public {
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID && DataArray[i].sequenceNumber == _sequenceNumber) {
        if (DataArray[i].fromNode == msg.sender) {
          if (DataArray[i].hashValue.compareTo(_hashValue)) {
            DataArray[i].seed = _seed;
            break;
          }
        }
      }
    }
  }

  function setSessionCheckable(uint256 _sessionID, uint256 _sequenceNumber) public {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID && SessionArray[i].sequenceNumber == _sequenceNumber) {
        if (SessionArray[i].checkable == false) {
          SessionArray[i].checkable = true;
        }
        else {
          return;
        }
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
      for (uint256 k = 0; k < SessionArray.length; k++) {
        if (SessionArray[k].id == _sessionID) {
          if (SessionArray[k].sender != msg.sender) {
            emit PoBisTriggered(_sessionID);
          }
          break;
        }
      }
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

  function requestForCheckingSession(uint256 _sessionID, uint256 _sequenceNumber) public view returns(string, string, uint256, string, bool) {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID && SessionArray[i].checkable == true && SessionArray[i].isPending == false && SessionArray[i].sequenceNumber == _sequenceNumber) {
        if (msg.sender == SessionArray[i].PoBChecker) {
          return (SessionArray[i].payload, SessionArray[i].pathToken, SessionArray[i].sequenceNumber, SessionArray[i].senderID, SessionArray[i].transferResult);
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

  function getTheNumberOfData(uint256 _sessionID) public view returns(uint256) {
    uint256 _counter = 0;
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID) {
        _counter++;
      }
    }
    return (_counter);
  }

  function requestForCheckingData(uint256 _sessionID, string _fromNodeID, uint256 _sequenceNumber) public view returns(string, string, string, uint256, string) {
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID && DataArray[i].fromNodeID.compareTo(_fromNodeID) && DataArray[i].isPending == false && DataArray[i].sequenceNumber == _sequenceNumber) {
        return (DataArray[i].fromNodeID, DataArray[i].hashValue, DataArray[i].seed, DataArray[i].sequenceNumber, DataArray[i].toNodeID);
      }
    }
  }

  function getDataArrayLength(uint256 _sessionID, uint256 _sequenceNumber) public view returns(uint256) {
    uint256 _counter = 0;
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID && DataArray[i].sequenceNumber == _sequenceNumber) {
        _counter++;
      }
    }
    return (_counter);
  }

  function requestForCheckingDataWithoutFromNodeID(uint256 _sessionID, uint256 _sequenceNumber, uint256 _counterOfTheSameSessionIDAndSequenceNumber) public view returns(string, string, string, uint256, string) {
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID && DataArray[i].isPending == false && DataArray[i].sequenceNumber == _sequenceNumber) {
        if (DataArray[i].counterOfTheSameSessionIDAndSequenceNumber == _counterOfTheSameSessionIDAndSequenceNumber) {
          return (DataArray[i].fromNodeID, DataArray[i].hashValue, DataArray[i].seed, DataArray[i].sequenceNumber, DataArray[i].toNodeID);
        }
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
        // access contract function located in other contract
        reputation.modifyReputationScore(SessionArray[i].transferResult, _pathToken, SessionArray[i].packetLength, msg.sender, SessionArray[i].transferBreakpoint, _PoBResult, _PoBBreakpoint);
        break;
      }
    }
  }

  function handlePathTokenIsInvalid(uint256 _sessionID, uint256 _sequenceNumber, string _lastFromNodeID, string _lastToNodeID) public {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID && SessionArray[i].sequenceNumber == _sequenceNumber) {
        SessionArray[i].isPathTokenInvalid = true;
        reputation.pathTokenIsInvalid(_lastFromNodeID, _lastToNodeID, SessionArray[i].packetLength, msg.sender);
        break;
      }
    }
  }

  function getTransferStatus(string _purchaserID, string _vendorID, string _relayType) public view returns(uint256) {
    uint256 _usedBandwidth = 0;
    if (_relayType.compareTo('Exit Relay')) {
      for (uint256 i = 0; i < DataArray.length; i++) {
        uint256 _packetLength = 0;
        for (uint256 j = 0; j < SessionArray.length; j++) {
          if (SessionArray[j].id == DataArray[i].sessionID && SessionArray[j].sequenceNumber == DataArray[i].sequenceNumber) {
            _packetLength = SessionArray[j].packetLength;
            break;
          }
        }
        if (DataArray[i].fromNodeID.compareTo(_purchaserID) && DataArray[i].toNodeID.compareTo(_vendorID)) {
          for (uint256 m = 0; m < DataArray.length; m++) {
            if (DataArray[m].fromNodeID.compareTo(_vendorID)) {
              if (DataArray[m].sessionID == DataArray[i].sessionID && DataArray[m].sequenceNumber == DataArray[i].sequenceNumber) {
                _usedBandwidth += _packetLength;
                break;
              }
            }
          }
        }
      }
    }
    else {
      for (uint256 k = 0; k < DataArray.length; k++) {
        if (DataArray[k].fromNodeID.compareTo(_vendorID) && DataArray[k].toNodeID.compareTo(_purchaserID)) {
          for (uint256 l = 0; l < SessionArray.length; l++) {
            if (SessionArray[l].id == DataArray[k].sessionID && SessionArray[l].sequenceNumber == DataArray[k].sequenceNumber) {
              _usedBandwidth += SessionArray[l].packetLength;
              break;
            }
          }
        }
      }
    }
    return (_usedBandwidth);
  }

  function getData(uint256 _sessionID, uint256 _sequenceNumber) public view returns(uint256, string, string, uint256, string) {
    for (uint256 i = 0; i < DataArray.length; i++) {
      if (DataArray[i].sessionID == _sessionID && DataArray[i].fromNode == msg.sender && DataArray[i].sequenceNumber == _sequenceNumber) {
        return (DataArray[i].sessionID, DataArray[i].hashValue, DataArray[i].seed, DataArray[i].sequenceNumber, DataArray[i].toNodeID);
      }
    }
  }

  function getSessionInformation(uint256 _sessionID, uint256 _sequenceNumber) public view returns(uint256, address, string, uint256, string, uint256, uint256, address, string) {
    for (uint256 i = 0; i < SessionArray.length; i++) {
      if (SessionArray[i].id == _sessionID && SessionArray[i].sequenceNumber == _sequenceNumber) {
        return (SessionArray[i].id, SessionArray[i].receiver, SessionArray[i].payload, SessionArray[i].packetLength, SessionArray[i].pathToken, SessionArray[i].sequenceNumber, SessionArray[i].theNumberOfPackets, SessionArray[i].PoBChecker, SessionArray[i].senderID);
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
}

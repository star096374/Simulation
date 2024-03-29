'use strict';

const net = require('net');
const sha256 = require('js-sha256');
const Web3 = require('web3');
const web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));

function Node(options) {
  if (options.id !== undefined) {
    this.id = options.id;
  }
  else {
    console.error("Node id is undefined");
    process.exit(1);
  }

  if (options.port !== undefined && options.host !== undefined) {
    this.port = options.port;
    this.host = options.host;
  }
  else {
    console.error("[%s] Server port or host is undefined", this.id);
    process.exit(1);
  }

  if (options.ethereumAccount !== undefined) {
    this.ethereumAccount = options.ethereumAccount;
  }
  else {
    console.error("[%s] Can't initialize the Ethereum account", this.id);
    process.exit(1);
  }

  if (options.validationSystem !== undefined) {
    this.validationSystem = options.validationSystem;
    this.seedArray = [];

    var timeToUploadSeed = this.validationSystem.timeToUploadSeed({fromBlock: 0, toBlock: 'latest'});
    this._addTimeToUploadSeedListener(timeToUploadSeed);

    if (this.id == "checker0" || this.id == "checker1") {
      var competeForPoB = this.validationSystem.competeForPoB({fromBlock: 0, toBlock: 'latest'});
      this._addCompeteForPoBListener(competeForPoB);

      var winPoBCompetition = this.validationSystem.winPoBCompetition({fromBlock: 0, toBlock: 'latest'});
      this._addWinPoBCompetitionListener(winPoBCompetition);
    }

    var timeToUploadPureHashOfPayload = this.validationSystem.timeToUploadPureHashOfPayload({fromBlock: 0, toBlock: 'latest'});
    this._addTimeToUploadPureHashOfPayloadListener(timeToUploadPureHashOfPayload);
  }
  else {
    console.error("[%s] Can't initialize Validation System", this.id);
    process.exit(1);
  }

  if (options.reputationSystem !== undefined) {
    this.reputationSystem = options.reputationSystem;

    this._registerInReputationSystem();
  }
  else {
    console.error("[%s] Can't initialize Reputation System", this.id);
    process.exit(1);
  }

  if (options.paymentSystem !== undefined) {
    this.paymentSystem = options.paymentSystem;

    this._registerInPaymentSystem();

    var relayContractIsSet = this.paymentSystem.relayContractIsSet({fromBlock: 0, toBlock: 'latest'});
    this._addRelayContractIsSetListener(relayContractIsSet);
  }
  else {
    console.error("[%s] Can't initialize Payment System", this.id);
    process.exit(1);
  }

  var self = this;
  // the socket connect to another server, i.e. you are the client
  this.socketClient = [];
  // the socket connected to the server, i.e. you are the server
  this.socketServer = [];

  // the array used to save the retransmission status of the packet
  this.retransmitArray = [];
  // the session ID and sequence number of the packet you have received
  // [<session ID>, <sequence number>]
  this.receivedPacket = [];
  // the session ID and sequence number of the ack you have received
  // [<session ID>, <sequence number>]
  this.receivedAck = [];

  // if proof of bandwidth is not triggered for a long time, sender will trigger it
  this.isPoBTriggered = [];

  // store the number of the uploaded pathToken of the session
  this.uploadedPathTokenNumber = {};
  // whether the PoBChecker is decided
  this.isPoBCheckerDecided = {};

  // store the status of relay contract
  this.relayContractStatus = [];

  // PoB accuracy experiment
  self.isPacketDroped = [];

  this.server = net.createServer(function(socket) {
    // if someone connect to this server, this function will be triggered
    console.log("[%s] A client %s:%d connect to the server", self.id, socket.remoteAddress, socket.remotePort);
    // send ID to the client
    socket.write(self.id + '\n');

    // defined the action when the event happen
    socket.on('data', function(data) {
      var dataQueue = data.toString().split('\n'); // '\n' is the delimiter of data
      dataQueue.pop(); // remove the last '\n' of data
      dataQueue.forEach(function(element) {
        var message;
        var isJson = true;
        try {
          message = JSON.parse(element);
        } catch (e) {
          isJson = false;
        }
        if (isJson == true) {
          // check whether you have received the packet
          if (self.receivedPacket.includes(message.sessionID + ',' + message.sequenceNumber) == true) {
            console.log("[%s] The packet has been received, drop it", self.id);
            // retransmit ack to sender
            socket.write(message.sessionID + ',' + message.sequenceNumber + '\n');
            return;
          }
          else {
            // PoB accuracy experiment
            if (self.id == 'node2' || self.id == 'node4' || self.id == 'node6') {
              var isPacketDropedIndex = self.isPacketDroped.map(function(element) {
                return element.sessionID + ',' + element.sequenceNumber;
              }).indexOf(message.sessionID + ',' + message.sequenceNumber);
              if (isPacketDropedIndex == -1) {
                var randomNumber = Math.floor(Math.random() * 4);
                if (randomNumber == 0) {
                  console.log("*[%s] Drop the packet, session ID: %d, sequence number: %d*", self.id, message.sessionID, message.sequenceNumber);
                  self.isPacketDroped.push({
                    sessionID: message.sessionID,
                    sequenceNumber: message.sequenceNumber,
                    dropOrNot: true
                  });
                  return;
                }
                else {
                  self.isPacketDroped.push({
                    sessionID: message.sessionID,
                    sequenceNumber: message.sequenceNumber,
                    dropOrNot: false
                  });
                }
              }
              else {
                if (self.isPacketDroped[isPacketDropedIndex].dropOrNot == true) {
                  console.log("*[%s] Drop the packet, session ID: %d, sequence number: %d*", self.id, message.sessionID, message.sequenceNumber);
                  return;
                }
              }
            }

            self.receivedPacket.push(message.sessionID + ',' + message.sequenceNumber);
            // send ack to sender
            socket.write(message.sessionID + ',' + message.sequenceNumber + '\n');
          }

          // add node ID to path token of the message
          message.pathToken.push(self.id);
          if (message.receiver == self.id) {
            console.log("[%s] -----Message Received-----", self.id);
            console.log("[%s] Session ID: %s", self.id, message.sessionID);
            console.log("[%s] Sender: %s", self.id, message.sender);
            console.log("[%s] Receiver: %s", self.id, message.receiver);
            console.log("[%s] Path token: %s", self.id, message.pathToken);
            console.log("[%s] Payload: %s", self.id, message.payload);
            console.log("[%s] Sequence number: %s", self.id, message.sequenceNumber);
            console.log("[%s] The number of packets: %s", self.id, message.theNumberOfPackets);
            console.log("[%s] -----Message End-----", self.id);

            // upload pathToken to Validation System
            self.validationSystem.uploadPathToken(message.sessionID, message.pathToken.toString(), "", message.sequenceNumber, {from: self.ethereumAccount, gas: 1000000}).then(function() {
              if (self.uploadedPathTokenNumber[message.sessionID] !== undefined) {
                self.uploadedPathTokenNumber[message.sessionID]++;
              }
              else {
                self.uploadedPathTokenNumber[message.sessionID] = 1;
                self.isPoBCheckerDecided[message.sessionID] = false;
              }
              self.validationSystem.getSessionStatus(message.sessionID, message.sequenceNumber, {from: self.ethereumAccount}).then(function(result) {
                console.log("[%s] Path token is uploaded to Validation System", self.id);
                console.log("[%s] -----Data from Validation System-----", self.id);
                console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
                console.log("[%s] Receiver address: %s", self.id, result[1]);
                console.log("[%s] Path token: %s", self.id, result[2]);
                console.log("[%s] Transfer result: %s", self.id, result[3].toString());
                console.log("[%s] Sequence number: %d", self.id, result[4]);
                console.log("[%s] The number of packets: %d", self.id, result[5]);
                console.log("[%s] -----Data End-----", self.id);

                setTimeout(function() {
                  console.log("[%s] Set checkable of the session true", self.id);
                  self.validationSystem.setSessionCheckable(message.sessionID, message.sequenceNumber, {from: self.ethereumAccount, gas: 1000000}).catch(function(err) {
                    console.log(err);
                  });

                  var triggerDecideCheckerOfPoBTimer;
                  if (message.sequenceNumber == 0) {
                    triggerDecideCheckerOfPoBTimer = setTimeout(function() {
                      console.log("[%s] Decide the checker of proof of bandwidth", self.id);
                      self.validationSystem.decideCheckerOfPoB(message.sessionID, {from: self.ethereumAccount, gas: 1000000}).then(function() {
                        self.validationSystem.getSessionInformation(message.sessionID, 0, {from: self.ethereumAccount}).then(function(result) {
                          console.log("[%s] -----Data from Validation System-----", self.id);
                          console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
                          console.log("[%s] PoBChecker address: %s", self.id, result[7].toString());
                          console.log("[%s] -----Data End-----", self.id);
                        }).catch(function(err) {
                          console.log(err);
                        });
                      }).catch(function(err) {
                        console.log(err);
                      });
                    }, 25000);
                  }

                  if (self.uploadedPathTokenNumber[message.sessionID] == message.theNumberOfPackets && self.isPoBCheckerDecided[message.sessionID] == false) {
                    self.isPoBCheckerDecided[message.sessionID] = true;
                    clearTimeout(triggerDecideCheckerOfPoBTimer);
                    setTimeout(function() {
                      console.log("[%s] Decide the checker of proof of bandwidth", self.id);
                      self.validationSystem.decideCheckerOfPoB(message.sessionID, {from: self.ethereumAccount, gas: 1000000}).then(function() {
                        self.validationSystem.getSessionInformation(message.sessionID, 0, {from: self.ethereumAccount}).then(function(result) {
                          console.log("[%s] -----Data from Validation System-----", self.id);
                          console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
                          console.log("[%s] PoBChecker address: %s", self.id, result[7].toString());
                          console.log("[%s] -----Data End-----", self.id);
                        }).catch(function(err) {
                          console.log(err);
                        });
                      }).catch(function(err) {
                        console.log(err);
                      });
                    }, 10000);
                  }
                }, 5000);
              }).catch(function(err) {
                console.log(err);
              });
            }).catch(function(err) {
              console.log(err);
            });
          }
          else {
            var packetWithNewPathToken = {
              sessionID: message.sessionID,
              sender: message.sender,
              receiver: message.receiver,
              entryPathFilter: message.entryPathFilter,
              pathToken: message.pathToken,
              payload: message.payload,
              sequenceNumber: message.sequenceNumber,
              theNumberOfPackets: message.theNumberOfPackets
            }
            var messageWithNewPathToken = Buffer.from(JSON.stringify(packetWithNewPathToken));

            // check the number of exit relay nodes
            var exitRelayNumber = 0;
            self.socketClient.forEach(function(item) {
              if (item.type == 'Exit Relay') {
                exitRelayNumber++;
              }
            });
            // check the number of gateway, i.e. from the last exit relay node to the first entry relay node
            var gatewayNumber = 0;
            self.socketClient.forEach(function(item) {
              if (item.type == 'Gateway') {
                gatewayNumber++;
              }
            });

            // hash payload by sha256, and then upload to Validation System
            var seed = self._generateRandomString();
            var hashedPayload = sha256(seed + sha256(message.payload));
            self.seedArray.push({
              sessionID: message.sessionID,
              hash: hashedPayload,
              seed: seed,
              sequenceNumber: message.sequenceNumber
            });
            self.validationSystem.uploadData(message.sessionID, self.id, hashedPayload, message.sequenceNumber, {from: self.ethereumAccount, gas: 1000000}).then(function() {
              self.validationSystem.getData(message.sessionID, message.sequenceNumber, {from: self.ethereumAccount}).then(function(result) {
                console.log("[%s] Hashed payload is uploaded to Validation System", self.id);
                console.log("[%s] -----Data from Validation System-----", self.id);
                console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
                console.log("[%s] Hash value: %s", self.id, result[1]);
                console.log("[%s] Sequence number: %s", self.id, result[3]);
                console.log("[%s] -----Data End-----", self.id);

                if (exitRelayNumber > 0) {
                  console.log("[%s] Forward message to exit relay nodes", self.id);
                  self.sendMessageToExitRelayNode(messageWithNewPathToken);
                }
                else if (gatewayNumber > 0) {
                  console.log("[%s] Forward message to gateway", self.id);
                  var firstEntryRelayNodeID = message.entryPathFilter.toString().split(',')[0];
                  var isMessageForwarded = false;
                  var forEachCounter = 0;
                  self.socketClient.forEach(function(item) {
                    if (item.type == 'Gateway' && item.id == firstEntryRelayNodeID) {
                      isMessageForwarded = true;
                      self.sendMessageToGateway(messageWithNewPathToken, firstEntryRelayNodeID);
                    }
                    forEachCounter++;
                    if (forEachCounter == self.socketClient.length && isMessageForwarded == false) {
                      console.log("[%s] Message is not forwarded", self.id);
                    }
                  });
                }
                else {
                  var newEntryPathFilter = message.entryPathFilter.toString().split(',');
                  newEntryPathFilter.shift();
                  var nextNodeID = newEntryPathFilter[0];
                  console.log("[%s] Forward message to the entry relay node %s", self.id, nextNodeID);

                  var newPacket = {
                    sessionID: message.sessionID,
                    sender: message.sender,
                    receiver: message.receiver,
                    entryPathFilter: newEntryPathFilter,
                    pathToken: message.pathToken,
                    payload: message.payload,
                    sequenceNumber: message.sequenceNumber,
                    theNumberOfPackets: message.theNumberOfPackets
                  }
                  var newMessage = Buffer.from(JSON.stringify(newPacket));

                  var isMessageForwarded = false;
                  var forEachCounter = 0;
                  self.socketServer.forEach(function(item) {
                    if (item.type == 'Entry Relay' && item.id == nextNodeID) {
                      isMessageForwarded = true;
                      self.sendMessageToEntryRelayNode(nextNodeID, newMessage);
                    }
                    forEachCounter++;
                    if (forEachCounter == self.socketServer.length && isMessageForwarded == false) {
                      console.log("[%s] Message is not forwarded", self.id);
                    }
                  });
                }
              }).catch(function(err) {
                console.log(err);
              });
            }).catch(function(err) {
              console.log(err);
            });
          }
        }
        else {
          element = element.toString().split(',');
          // receive ack, element = session ID, sequence number
          if (Number.isInteger(Number(element[1]))) {
            if (self.receivedAck.includes(element[0] + ',' + element[1]) == true) {
              console.log("*[%s] The ack has been received, drop it*", self.id);
              return;
            }
            else {
              console.log("*[%s] Receive ack, session ID: %d, sequence number: %d*", self.id,  element[0], element[1]);
              var index = self.retransmitArray.map(function(t) {
                return t.sessionID + ',' + t.sequenceNumber;
              }).indexOf(element.toString());
              clearInterval(self.retransmitArray[index].intervalID);
              self.retransmitArray.splice(index, 1);
              self.receivedAck.push(element[0] + ',' + element[1]);
            }
          }
          // element = [node ID, relay type]
          else {
            self.socketServer.push({
              id: element[0],
              type: element[1],
              address: socket.remoteAddress + ':' + socket.remotePort,
              socket: socket
            });
          }
        }
      });
    });
  });
  this.server.listen(this.port, this.host);
}

Node.prototype.connectToAnotherServer = function(type, host, port) {
  if (type !== 'Exit Relay' && type !== 'Gateway' && type !== 'Entry Relay') {
    console.error("[%s] connectToAnotherServer: Invalid Type", this.id);
    process.exit(1);
  }

  var self = this;
  var socket = new net.Socket();
  this.socketClient.push({
    type: type,
    address: host + ':' + port,
    socket: socket
  });
  socket.connect(port, host, function() {
    console.log("[%s] Connected to %s:%d", self.id, host, port);
    var info = [self.id, type];
    this.write(info + '\n');
  });
  socket.on('data', function(data) {
    var socketReference = this;
    var dataQueue = data.toString().split('\n'); // '\n' is the delimiter of data
    dataQueue.pop(); // remove the last '\n' of data
    dataQueue.forEach(function(element) {
      var message;
      var isJson = true;
      try {
        message = JSON.parse(element);
      } catch (e) {
        isJson = false;
      }
      if (isJson == true) {
        // check whether you have received the packet
        if (self.receivedPacket.includes(message.sessionID + ',' + message.sequenceNumber) == true) {
          console.log("[%s] The packet has been received, drop it", self.id);
          // retransmit ack to sender
          socketReference.write(message.sessionID + ',' + message.sequenceNumber + '\n');
          return;
        }
        else {
          self.receivedPacket.push(message.sessionID + ',' + message.sequenceNumber);
          // send ack to sender
          socketReference.write(message.sessionID + ',' + message.sequenceNumber + '\n');
        }

        message.pathToken.push(self.id);
        if (message.receiver == self.id) {
          console.log("[%s] -----Message Received-----", self.id);
          console.log("[%s] Session ID: %s", self.id, message.sessionID);
          console.log("[%s] Sender: %s", self.id, message.sender);
          console.log("[%s] Receiver: %s", self.id, message.receiver);
          console.log("[%s] Path token: %s", self.id, message.pathToken);
          console.log("[%s] Payload: %s", self.id, message.payload);
          console.log("[%s] Sequence number: %s", self.id, message.sequenceNumber);
          console.log("[%s] The number of packets: %s", self.id, message.theNumberOfPackets);
          console.log("[%s] -----Message End-----", self.id);

          // upload pathToken to Validation System
          self.validationSystem.uploadPathToken(message.sessionID, message.pathToken.toString(), "", message.sequenceNumber, {from: self.ethereumAccount, gas: 1000000}).then(function() {
            if (self.uploadedPathTokenNumber[message.sessionID] !== undefined) {
              self.uploadedPathTokenNumber[message.sessionID]++;
            }
            else {
              self.uploadedPathTokenNumber[message.sessionID] = 1;
              self.isPoBCheckerDecided[message.sessionID] = false;
            }
            self.validationSystem.getSessionStatus(message.sessionID, message.sequenceNumber, {from: self.ethereumAccount}).then(function(result) {
              console.log("[%s] Path token is uploaded to Validation System", self.id);
              console.log("[%s] -----Data from Validation System-----", self.id);
              console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
              console.log("[%s] Receiver address: %s", self.id, result[1]);
              console.log("[%s] Path token: %s", self.id, result[2]);
              console.log("[%s] Transfer result: %s", self.id, result[3].toString());
              console.log("[%s] Sequence number: %d", self.id, result[4]);
              console.log("[%s] The number of packets: %d", self.id, result[5]);
              console.log("[%s] -----Data End-----", self.id);

              setTimeout(function() {
                console.log("[%s] Set checkable of the session true", self.id);
                self.validationSystem.setSessionCheckable(message.sessionID, message.sequenceNumber, {from: self.ethereumAccount, gas: 1000000}).catch(function(err) {
                  console.log(err);
                });

                var triggerDecideCheckerOfPoBTimer;
                if (message.sequenceNumber == 0) {
                  triggerDecideCheckerOfPoBTimer = setTimeout(function() {
                    console.log("[%s] Decide the checker of proof of bandwidth", self.id);
                    self.validationSystem.decideCheckerOfPoB(message.sessionID, {from: self.ethereumAccount, gas: 1000000}).then(function() {
                      self.validationSystem.getSessionInformation(message.sessionID, 0, {from: self.ethereumAccount}).then(function(result) {
                        console.log("[%s] -----Data from Validation System-----", self.id);
                        console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
                        console.log("[%s] PoBChecker address: %s", self.id, result[7].toString());
                        console.log("[%s] -----Data End-----", self.id);
                      }).catch(function(err) {
                        console.log(err);
                      });
                    }).catch(function(err) {
                      console.log(err);
                    });
                  }, 25000);
                }

                if (self.uploadedPathTokenNumber[message.sessionID] == message.theNumberOfPackets && self.isPoBCheckerDecided[message.sessionID] == false) {
                  self.isPoBCheckerDecided[message.sessionID] = true;
                  clearTimeout(triggerDecideCheckerOfPoBTimer);
                  setTimeout(function() {
                    console.log("[%s] Decide the checker of proof of bandwidth", self.id);
                    self.validationSystem.decideCheckerOfPoB(message.sessionID, {from: self.ethereumAccount, gas: 1000000}).then(function() {
                      self.validationSystem.getSessionInformation(message.sessionID, 0, {from: self.ethereumAccount}).then(function(result) {
                        console.log("[%s] -----Data from Validation System-----", self.id);
                        console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
                        console.log("[%s] PoBChecker address: %s", self.id, result[7].toString());
                        console.log("[%s] -----Data End-----", self.id);
                      }).catch(function(err) {
                        console.log(err);
                      });
                    }).catch(function(err) {
                      console.log(err);
                    });
                  }, 10000);
                }
              }, 5000);
            }).catch(function(err) {
              console.log(err);
            });
          }).catch(function(err) {
            console.log(err);
          });
        }
        else {
          var newEntryPathFilter = message.entryPathFilter.toString().split(',');
          newEntryPathFilter.shift();
          var nextNodeID = newEntryPathFilter[0];

          var newPacket = {
            sessionID: message.sessionID,
            sender: message.sender,
            receiver: message.receiver,
            entryPathFilter: newEntryPathFilter,
            pathToken: message.pathToken,
            payload: message.payload,
            sequenceNumber: message.sequenceNumber,
            theNumberOfPackets: message.theNumberOfPackets
          }
          var newMessage = Buffer.from(JSON.stringify(newPacket));

          // hash payload by sha256, and then upload to Validation System
          var seed = self._generateRandomString();
          var hashedPayload = sha256(seed + sha256(message.payload));
          self.seedArray.push({
            sessionID: message.sessionID,
            hash: hashedPayload,
            seed: seed,
            sequenceNumber: message.sequenceNumber
          });
          self.validationSystem.uploadData(message.sessionID, self.id, hashedPayload, message.sequenceNumber, {from: self.ethereumAccount, gas: 1000000}).then(function() {
            self.validationSystem.getData(message.sessionID, message.sequenceNumber, {from: self.ethereumAccount}).then(function(result) {
              console.log("[%s] Hashed payload is uploaded to Validation System", self.id);
              console.log("[%s] -----Data from Validation System-----", self.id);
              console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
              console.log("[%s] Hash value: %s", self.id, result[1]);
              console.log("[%s] Sequence number: %d", self.id, result[3]);
              console.log("[%s] -----Data End-----", self.id);

              console.log("[%s] Forward message to the entry relay node %s", self.id, nextNodeID);

              var isMessageForwarded = false;
              var forEachCounter = 0;
              self.socketServer.forEach(function(item) {
                if (item.type == 'Entry Relay' && item.id == nextNodeID) {
                  isMessageForwarded = true;
                  self.sendMessageToEntryRelayNode(nextNodeID, newMessage);
                }
                forEachCounter++;
                if (forEachCounter == self.socketServer.length && isMessageForwarded == false) {
                  console.log("[%s] Message is not forwarded", self.id);
                }
              });
            }).catch(function(err) {
              console.log(err);
            });
          }).catch(function(err) {
            console.log(err);
          });
        }
      }
      else {
        element = element.split(',');
        if (element.length == 1) {
          // element = node ID
          var index = self.socketClient.map(function(t) {
            return t.socket;
          }).indexOf(socket);
          self.socketClient[index].id = element.toString();
        }
        else {
          // receive ack, element = session ID, sequence number
          if (self.receivedAck.includes(element[0] + ',' + element[1]) == true) {
            console.log("*[%s] The ack has been received, drop it*", self.id);
            return;
          }
          else {
            console.log("*[%s] Receive ack, session ID: %d, sequence number: %d*", self.id,  element[0], element[1]);
            var index = self.retransmitArray.map(function(t) {
              return t.sessionID + ',' + t.sequenceNumber;
            }).indexOf(element.toString());
            clearInterval(self.retransmitArray[index].intervalID);
            self.retransmitArray.splice(index, 1);
            self.receivedAck.push(element[0] + ',' + element[1]);
          }
        }
      }
    });
  });
  socket.on('close', function() {
    var index = self.socketClient.map(function(t) {
      return t.socket;
    }).indexOf(socket);
    console.log("[%s] Connection %s is closed", self.id, self.socketClient[index].address);
    self.socketClient.splice(index, 1);
  });
};

Node.prototype._sendMessage = function(type, host, port, message) {
  var self = this;
  var socketsList;
  var errorMessage;
  switch (type) {
    case 'client':
      socketsList = this.socketClient;
      errorMessage = "[" + this.id + "] You didn't connect to the server";
      break;
    case 'server':
      socketsList = this.socketServer;
      errorMessage = "[" + this.id + "] The client didn't connect to you";
      break;
    default:
      console.error("_sendMessage: Invalid Type");
      process.exit(1);
  }
  var socket;
  var index = socketsList.map(function(t) {
    return t.address;
  }).indexOf(host + ':' + port);
  if (index == -1) {
    console.error(errorMessage);
    process.exit(1);
  }
  socket = socketsList[index].socket;
  socket.write(message + '\n');

  // if you don't receive ack in 5 secs, retransmit the packet
  var transferBreakpoint = socketsList[index].id;
  var parsedMessage = JSON.parse(message);
  var retransmitTimer = setInterval(function() {
    var index = self.retransmitArray.map(function(t) {
      return t.sessionID + ',' + t.sequenceNumber;
    }).indexOf(parsedMessage.sessionID + ',' + parsedMessage.sequenceNumber);
    self.retransmitArray[index].counter += 1;
    if (self.retransmitArray[index].counter < 3) {
      console.log("[%s] Retransmit the packet, retransmit times: %d", self.id, self.retransmitArray[index].counter);
      socket.write(message + '\n');
    }
    else {
      console.log("[%s] Transmit failed three times, upload pathToken to Validation System", self.id);
      clearInterval(self.retransmitArray[index].intervalID);
      self.retransmitArray.splice(index, 1);

      // upload pathToken to Validation System
      self.validationSystem.uploadPathToken(parsedMessage.sessionID, parsedMessage.pathToken.toString(), transferBreakpoint, parsedMessage.sequenceNumber, {from: self.ethereumAccount, gas: 1000000}).then(function() {
        if (self.uploadedPathTokenNumber[parsedMessage.sessionID] !== undefined) {
          self.uploadedPathTokenNumber[parsedMessage.sessionID]++;
        }
        else {
          self.uploadedPathTokenNumber[parsedMessage.sessionID] = 1;
          self.isPoBCheckerDecided[parsedMessage.sessionID] = false;
        }
        self.validationSystem.getSessionStatus(parsedMessage.sessionID, parsedMessage.sequenceNumber, {from: self.ethereumAccount}).then(function(result) {
          console.log("[%s] Path token is uploaded to Validation System", self.id);
          console.log("[%s] -----Data from Validation System-----", self.id);
          console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
          console.log("[%s] Receiver address: %s", self.id, result[1]);
          console.log("[%s] Path token: %s", self.id, result[2]);
          console.log("[%s] Transfer result: %s", self.id, result[3].toString());
          console.log("[%s] Sequence number: %d", self.id, result[4]);
          console.log("[%s] The number of packets: %d", self.id, result[5]);
          console.log("[%s] Transfer breakpoint: %s", self.id, result[6]);
          console.log("[%s] -----Data End-----", self.id);

          setTimeout(function() {
            console.log("[%s] Set checkable of the session true", self.id);
            self.validationSystem.setSessionCheckable(parsedMessage.sessionID, parsedMessage.sequenceNumber, {from: self.ethereumAccount, gas: 1000000}).catch(function(err) {
              console.log(err);
            });

            var triggerDecideCheckerOfPoBTimer;
            if (parsedMessage.sequenceNumber == 0) {
              triggerDecideCheckerOfPoBTimer = setTimeout(function() {
                console.log("[%s] Decide the checker of proof of bandwidth", self.id);
                self.validationSystem.decideCheckerOfPoB(parsedMessage.sessionID, {from: self.ethereumAccount, gas: 1000000}).then(function() {
                  self.validationSystem.getSessionInformation(parsedMessage.sessionID, 0, {from: self.ethereumAccount}).then(function(result) {
                    console.log("[%s] -----Data from Validation System-----", self.id);
                    console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
                    console.log("[%s] PoBChecker address: %s", self.id, result[7].toString());
                    console.log("[%s] -----Data End-----", self.id);
                  }).catch(function(err) {
                    console.log(err);
                  });
                }).catch(function(err) {
                  console.log(err);
                });
              }, 25000);
            }

            if (self.uploadedPathTokenNumber[parsedMessage.sessionID] == parsedMessage.theNumberOfPackets && self.isPoBCheckerDecided[parsedMessage.sessionID] == false) {
              self.isPoBCheckerDecided[parsedMessage.sessionID] = true;
              clearTimeout(triggerDecideCheckerOfPoBTimer);
              setTimeout(function() {
                console.log("[%s] Decide the checker of proof of bandwidth", self.id);
                self.validationSystem.decideCheckerOfPoB(parsedMessage.sessionID, {from: self.ethereumAccount, gas: 1000000}).then(function() {
                  self.validationSystem.getSessionInformation(parsedMessage.sessionID, 0, {from: self.ethereumAccount}).then(function(result) {
                    console.log("[%s] -----Data from Validation System-----", self.id);
                    console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
                    console.log("[%s] PoBChecker address: %s", self.id, result[7].toString());
                    console.log("[%s] -----Data End-----", self.id);
                  }).catch(function(err) {
                    console.log(err);
                  });
                }).catch(function(err) {
                  console.log(err);
                });
              }, 10000);
            }
          }, 5000);
        }).catch(function(err) {
          console.log(err);
        });
      }).catch(function(err) {
        console.log(err);
      });
    }
  }, 5000);
  this.retransmitArray.push({
    sessionID: parsedMessage.sessionID,
    intervalID: retransmitTimer,
    counter: 0,
    sequenceNumber: parsedMessage.sequenceNumber
  });

  // upload toNodeID to Validation System
  this.validationSystem.uploadToNodeID(parsedMessage.sessionID, parsedMessage.sequenceNumber, socketsList[index].id.toString(), {from: this.ethereumAccount, gas: 1000000}).then(function() {
    self.validationSystem.getData(parsedMessage.sessionID, parsedMessage.sequenceNumber, {from: self.ethereumAccount}).then(function(result) {
      console.log("[%s] Check whether toNodeID is uploaded to Validation System", self.id);
      console.log("[%s] -----Data from Validation System-----", self.id);
      console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
      console.log("[%s] Sequence number: %d", self.id, result[3]);
      console.log("[%s] Next node ID: %s", self.id, result[4]);
      console.log("[%s] -----Data End-----", self.id);
    }).catch(function(err) {
      console.log(err);
    });
  }).catch(function(err) {
    console.log(err);
  });
}

Node.prototype.sendMessageToExitRelayNode = function(message) {
  var exitRelayNumber = 0;
  for (var i = 0; i < this.socketClient.length; i++) {
    if (this.socketClient[i].type == 'Exit Relay') {
      exitRelayNumber++;
    }
  }
  var randomNumber = Math.floor(Math.random() * exitRelayNumber);

  var counter = 0;
  for (var j = 0; j < this.socketClient.length; j++) {
    if (this.socketClient[j].type == 'Exit Relay') {
      if (counter == randomNumber) {
        var result = this.socketClient[j].address.split(':');
        var host = result[0];
        var port = result[1];
        this._sendMessage('client', host, port, message);
        break;
      }
      else {
        counter++;
      }
    }
  }
}

Node.prototype.sendMessageToGateway = function(message, firstEntryRelayNodeID) {
  var self = this;
  this.socketClient.forEach(function(element) {
    if (element.type == 'Gateway' && element.id == firstEntryRelayNodeID) {
      var result = element.address.split(':');
      var host = result[0];
      var port = result[1];
      self._sendMessage('client', host, port, message);
    }
  });
}

Node.prototype.sendMessageToEntryRelayNode = function(nextNodeID, message) {
  var self = this;
  this.socketServer.forEach(function(element) {
    if (element.type == 'Entry Relay' && element.id == nextNodeID) {
      var result = element.address.split(':');
      var host = result[0];
      var port = result[1];
      self._sendMessage('server', host, port, message);
    }
  });
}

Node.prototype.addSessionToValidationSystem = function(receiver, packetArray) {
  var self = this;

  var sessionID = packetArray[0].sessionID;
  var theNumberOfPackets = packetArray[0].theNumberOfPackets;
  var sessionCounter = -1;
  var uploadCounter = -1;
  var dataCounter = -1;
  var sendCounter = -1;
  for (var i = 0; i < theNumberOfPackets; i++) {
    var payload = packetArray[i].payload;
    var sequenceNumber = packetArray[i].sequenceNumber;
    var packetLength = JSON.stringify(packetArray[i]).length;
    this.validationSystem.addSession(sessionID, receiver, packetLength, sequenceNumber, theNumberOfPackets, self.id, {from: this.ethereumAccount, gas: 1000000}).then(function() {
      sessionCounter++;
      self.validationSystem.getSessionInformation(sessionID, sessionCounter, {from: self.ethereumAccount}).then(function(result) {
        console.log("[%s] -----Data from Validation System-----", self.id);
        console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
        console.log("[%s] Receiver address: %s", self.id, result[1]);
        console.log("[%s] Packet length: %d", self.id, result[3]);
        console.log("[%s] Sequence number: %d", self.id, result[5]);
        console.log("[%s] The number of packets: %d", self.id, result[6]);
        console.log("[%s] Sender ID: %s", self.id, result[8]);
        console.log("[%s] -----Data End-----", self.id);

        uploadCounter++;
        var payload = packetArray[uploadCounter].payload;
        var sequenceNumber = packetArray[uploadCounter].sequenceNumber;

        // hash payload by sha256, and then upload to Validation System
        var seed = self._generateRandomString();
        var hashedPayload = sha256(seed + sha256(payload));
        self.seedArray.push({
          sessionID: sessionID,
          hash: hashedPayload,
          seed: seed,
          sequenceNumber: sequenceNumber,
          pureHashOfPayload: sha256(payload)
        });

        self.validationSystem.uploadData(sessionID, self.id, hashedPayload, sequenceNumber, {from: self.ethereumAccount, gas: 1000000}).then(function() {
          dataCounter++;
          self.validationSystem.getData(sessionID, dataCounter, {from: self.ethereumAccount}).then(function(result) {
            console.log("[%s] Hashed payload is uploaded to Validation System", self.id);
            console.log("[%s] -----Data from Validation System-----", self.id);
            console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
            console.log("[%s] Hash value: %s", self.id, result[1]);
            console.log("[%s] Sequence Number: %d", self.id, result[3]);
            console.log("[%s] -----Data End-----", self.id);

            sendCounter++;
            var message = Buffer.from(JSON.stringify(packetArray[sendCounter]));
            self.sendMessageToExitRelayNode(message);
          }).catch(function(err) {
            console.log(err);
          });
        }).catch(function(err) {
          console.log(err);
        });
      }).catch(function(err) {
        console.log(err);
      });
    }).catch(function(err) {
      console.log(err);
    });

    if (i == 0) {
      var triggerPoBTimer = setTimeout(function() {
        console.log("[%s] Trigger proof of bandwidth, sessionID: %d", self.id, sessionID);
        for (var j = 0; j < theNumberOfPackets; j++) {
          self.validationSystem.setSessionCheckable(sessionID, j, {from: self.ethereumAccount, gas: 1000000}).catch(function(err) {
            console.log(err);
          });
        }
        setTimeout(function() {
          console.log("[%s] Decide the checker of proof of bandwidth", self.id);
          self.validationSystem.decideCheckerOfPoB(sessionID, {from: self.ethereumAccount, gas: 1000000}).then(function() {
            self.validationSystem.getSessionInformation(sessionID, 0, {from: self.ethereumAccount}).then(function(result) {
              console.log("[%s] -----Data from Validation System-----", self.id);
              console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
              console.log("[%s] PoBChecker address: %s", self.id, result[7].toString());
              console.log("[%s] -----Data End-----", self.id);
            }).catch(function(err) {
              console.log(err);
            });
          }).catch(function(err) {
            console.log(err);
          });
        }, 10000);
      }, 150000);

      self.isPoBTriggered.push({
        sessionID: sessionID,
        triggerPoBTimer: triggerPoBTimer
      });

      var PoBisTriggered = self.validationSystem.PoBisTriggered({fromBlock: 0, toBlock: 'latest'});
      this._addPoBisTriggeredListener(PoBisTriggered);
    }
  }
}

Node.prototype._generateRandomString = function() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 10; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

Node.prototype._addTimeToUploadSeedListener = function(timeToUploadSeed) {
  var self = this;
  timeToUploadSeed.watch(function(error, result) {
    if (!error) {
      /*console.log("[%s] Event timeToUploadSeed is triggered", self.id);
      console.log("[%s] -----Data from Validation System-----", self.id);
      console.log("[%s] Session ID: %d", self.id, result.args.sessionID);
      console.log("[%s] Receiver address: %s", self.id, result.args.receiver);
      console.log("[%s] Path token: %s", self.id, result.args.pathToken);
      console.log("[%s] -----Data End-----", self.id);*/

      // if you are receiver, you don't have to upload seed
      if (result.args.receiver == self.ethereumAccount) {
        return;
      }

      // check whether you are in the path token
      var pathTokenArray = result.args.pathToken.split(',');
      pathTokenArray.forEach(function(element) {
        if (element == self.id) {
          // according to session ID and sequence number, upload seed to Validation System
          var hash, seed;
          self.seedArray.forEach(function(item) {
            if (item.sessionID == result.args.sessionID && item.sequenceNumber == result.args.sequenceNumber) {
              hash = item.hash;
              seed = item.seed;
            }
          });
          self.validationSystem.uploadSeed(result.args.sessionID, hash, seed, result.args.sequenceNumber, {from: self.ethereumAccount, gas: 1000000}).then(function() {
            self.validationSystem.getData(result.args.sessionID, result.args.sequenceNumber, {from: self.ethereumAccount}).then(function(result) {
              console.log("[%s] Check whether seed is uploaded to Validation System", self.id);
              console.log("[%s] -----Data from Validation System-----", self.id);
              console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
              console.log("[%s] Hash value: %s", self.id, result[1]);
              console.log("[%s] Seed: %s", self.id, result[2]);
              console.log("[%s] Sequence number: %d", self.id, result[3]);
              console.log("[%s] -----Data End-----", self.id);
            }).catch(function(err) {
              console.log(err);
            });
          }).catch(function(err) {
            console.log(err);
          });
        }
      });
    }
    else {
      console.log(error);
    }
  });
}

Node.prototype._registerInReputationSystem = function() {
  var self = this;
  this.reputationSystem.initAddressList(this.id, {from: this.ethereumAccount}).then(function() {
    console.log("[%s] Registered in Reputation System", self.id);
    self.reputationSystem.getReputationScore({from: self.ethereumAccount}).then(function(result) {
      console.log("[%s] Get reputation score from Reputation System", self.id);
      console.log("[%s] -----Data from Reputation System-----", self.id);
      console.log("[%s] Reputation score: %d", self.id, result.toNumber());
      console.log("[%s] -----Data End-----", self.id);
    }).catch(function(err) {
      console.log(err);
    });
  }).catch(function(err) {
    console.log(err);
  });
}

Node.prototype._addCompeteForPoBListener = function(competeForPoB) {
  var self = this;
  competeForPoB.watch(function(error, result) {
    if (!error) {
      /*console.log("[%s] Event competeForPoB is triggered", self.id);
      console.log("[%s] -----Data from Validation System-----", self.id);
      console.log("[%s] Session ID: %d", self.id, result.args.sessionID);
      console.log("[%s] -----Data End-----", self.id);*/

      var randomNumber = Math.floor(Math.random() * 100);
      console.log("[%s] Join the competition of proof of bandwidth", self.id);
      self.validationSystem.joinCompetitionForPoB(result.args.sessionID, randomNumber, {from: self.ethereumAccount, gas: 1000000}).then(function() {
        self.validationSystem.getPoB(result.args.sessionID, {from: self.ethereumAccount}).then(function(result) {
          console.log("[%s] check whether the data of PoBArray on Validation System is correct", self.id);
          console.log("[%s] -----Data from Validation System-----", self.id);
          console.log("[%s] Session ID: %d", self.id, result[0]);
          console.log("[%s] Random number: %d", self.id, result[1]);
          console.log("[%s] -----Data End-----", self.id);
        }).catch(function(err) {
          console.log(err);
        });
      }).catch(function(err) {
        console.log(err);
      });
    }
    else {
      console.log(error);
    }
  });
}

Node.prototype._addWinPoBCompetitionListener = function(winPoBCompetition) {
  var self = this;
  winPoBCompetition.watch(function(error, result) {
    if (!error) {
      /*console.log("[%s] Event winPoBCompetition is triggered", self.id);
      console.log("[%s] -----Data from Validation System-----", self.id);
      console.log("[%s] Session ID: %d", self.id, result.args.sessionID);
      console.log("[%s] PoBChecker address: %s", self.id, result.args.winnerOfPoBCompetition);
      console.log("[%s] -----Data End-----", self.id);*/

      if (result.args.winnerOfPoBCompetition == self.ethereumAccount) {
        console.log("[%s] Win the competition of proof of bandwidth", self.id);
        self.getDataForProofOfBandwidth(result.args.sessionID, result.args.theNumberOfPackets);
      }
    }
    else {
      console.log(error);
    }
  });
}

Node.prototype.getDataForProofOfBandwidth = function(sessionID, theNumberOfPackets) {
  var self = this;
  this.PoBStartTime = Date.now();
  console.log("*[%s] PoB start time: %d*", this.id, this.PoBStartTime);
  console.log("[%s] Get data for proof of bandwidth", this.id);

  for (var i = 0; i < theNumberOfPackets; i++) {
    var sessionArray = [];
    var dataArray = [];
    var sessionCounter = 0;
    this.validationSystem.requestForCheckingSession(sessionID, i, {from: this.ethereumAccount}).then(function(result) {
      sessionArray.push({
        pureHashOfPayload: result[0],
        pathToken: result[1],
        sequenceNumber: result[2].toNumber(),
        senderID: result[3],
        transferResult: result[4]
      });
      self.validationSystem.setSessionIsPending(sessionID, result[2], {from: self.ethereumAccount}).then(function() {
        sessionCounter++;
        if (sessionCounter == theNumberOfPackets) {
          var dataCounter = 0;
          var theNumberOfdata = 0;
          self.validationSystem.getTheNumberOfData(sessionID, {from: self.ethereumAccount}).then(function(theNumberOfdataResult) {
            theNumberOfdata = theNumberOfdataResult;
            sessionArray.forEach(function(element) {
              if (element.pathToken != '') {
                if (element.transferResult == false) {
                  theNumberOfdata--;
                }
                var pathTokenList = element.pathToken.split(',');
                for (var j = 0; j < pathTokenList.length-1; j++) {
                  self.validationSystem.requestForCheckingData(sessionID, pathTokenList[j], element.sequenceNumber, {from: self.ethereumAccount}).then(function(dataResult) {
                    dataArray.push({
                      fromNodeID: dataResult[0],
                      hashValue: dataResult[1],
                      seed: dataResult[2],
                      sequenceNumber: dataResult[3].toNumber(),
                      toNodeID: dataResult[4]
                    });
                    self.validationSystem.setDataIsPending(sessionID, dataResult[0], dataResult[3], {from: self.ethereumAccount, gas: 1000000}).then(function() {
                      dataCounter++;
                      if (dataCounter == theNumberOfdata) {
                        self._doProofOfBandwidth(sessionID, theNumberOfPackets, sessionArray, dataArray);
                      }
                    }).catch(function(err) {
                      console.log(err);
                    });
                  }).catch(function(err) {
                    console.log(err);
                  });
                }
              }
              else {
                self.validationSystem.getDataArrayLength(sessionID, element.sequenceNumber, {from: self.ethereumAccount}).then(function(dataArrayLength) {
                  for (var i = 0; i < dataArrayLength; i++) {
                    self.validationSystem.requestForCheckingDataWithoutFromNodeID(sessionID, element.sequenceNumber, i, {from: self.ethereumAccount}).then(function(dataResult) {
                      dataArray.push({
                        fromNodeID: dataResult[0],
                        hashValue: dataResult[1],
                        seed: dataResult[2],
                        sequenceNumber: dataResult[3].toNumber(),
                        toNodeID: dataResult[4]
                      });
                      self.validationSystem.setDataIsPending(sessionID, dataResult[0], dataResult[3], {from: self.ethereumAccount, gas: 1000000}).then(function() {
                        dataCounter++;
                        if (dataCounter == theNumberOfdata) {
                          self._doProofOfBandwidth(sessionID, theNumberOfPackets, sessionArray, dataArray);
                        }
                      }).catch(function(err) {
                        console.log(err);
                      });
                    }).catch(function(err) {
                      console.log(err);
                    });
                  }
                }).catch(function(err) {
                  console.log(err);
                });
              }
            });
          }).catch(function(err) {
            console.log(err);
          });
        }
      }).catch(function(err) {
        console.log(err);
      });
    }).catch(function(err) {
      console.log(err);
    });
  }
}

Node.prototype._doProofOfBandwidth = function(sessionID, theNumberOfPackets, sessionArray, dataArray) {
  var self = this;
  console.log("[%s] Start to do proof of bandwidth", this.id);

  var sessionCounter = -1;
  var getReputationCounter = 0;
  for (var i = 0; i < theNumberOfPackets; i++) {
    var result = true;
    var PoBBreakpoint = "";
    var pathTokenList = sessionArray[i].pathToken.split(',');
    for (var j = 0; j < pathTokenList.length-1; j++) {
      var isMatched = false;
      for (var k = 0; k < dataArray.length; k++) {
        if (dataArray[k].sequenceNumber == sessionArray[i].sequenceNumber && dataArray[k].fromNodeID == pathTokenList[j]) {
          if (sha256(dataArray[k].seed + sessionArray[i].pureHashOfPayload) == dataArray[k].hashValue) {
            self.validationSystem.setDataIsValid(sessionID, dataArray[k].fromNodeID, dataArray[k].sequenceNumber, {from: self.ethereumAccount, gas: 1000000}).catch(function(err) {
              console.log(err);
            });
            isMatched = true;
            break;
          }
        }
      }
      if (isMatched == true) {
        continue;
      }
      else {
        result = false;
        PoBBreakpoint = pathTokenList[j];
        break;
      }
    }

    // check whether path token is invalid
    if (sessionArray[i].pathToken == "") {
      var lastFromNodeID = "";
      var lastToNodeID = "";
      var fromNodeID = sessionArray[i].senderID;
      var toNodeID = "";
      for (var j = 0; j < dataArray.length; j++) {
        if (sessionArray[i].sequenceNumber == dataArray[j].sequenceNumber && dataArray[j].fromNodeID == fromNodeID) {
          toNodeID = dataArray[j].toNodeID;
          lastFromNodeID = fromNodeID;
          lastToNodeID = toNodeID;
          fromNodeID = toNodeID;
          j = 0;
        }
      }

      console.log("[%s] Path token is invalid, sessionID: %d, sequenceNumber: %d", self.id, sessionID, sessionArray[i].sequenceNumber);
      this.validationSystem.handlePathTokenIsInvalid(sessionID, sessionArray[i].sequenceNumber, lastFromNodeID, lastToNodeID, {from: this.ethereumAccount, gas: 1000000}).then(function() {
        sessionCounter++;
        self.validationSystem.getSessionStatus(sessionID, sessionCounter, {from: self.ethereumAccount}).then(function(result) {
          console.log("[%s] -----Data from Validation System-----", self.id);
          console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
          console.log("[%s] Transfer result: %s", self.id, result[3].toString());
          console.log("[%s] Sequence number: %d", self.id, result[4]);
          console.log("[%s] The number of packets: %d", self.id, result[5]);
          if (result[6] != "") {
            console.log("[%s] Transfer breakpoint: %s", self.id, result[6]);
          }
          console.log("[%s] PoB result: %s", self.id, result[7].toString());
          if (result[8] != "") {
            console.log("[%s] PoB breakpoint: %s", self.id, result[8]);
          }
          console.log("[%s] -----Data End-----", self.id);

          getReputationCounter++;
          if (getReputationCounter == theNumberOfPackets) {
            self.PoBEndTime = Date.now();
            console.log("*[%s] PoB end time: %d*", self.id, self.PoBEndTime);
            console.log("*[%s] Time used to do PoB: %d (ms)*", self.id, (self.PoBEndTime-self.PoBStartTime));
            self.reputationSystem.getReputationScore({from: self.ethereumAccount}).then(function(result) {
              console.log("[%s] Get reputation score from Reputation System", self.id);
              console.log("[%s] -----Data from Reputation System-----", self.id);
              console.log("[%s] Reputation score: %d", self.id, result.toNumber());
              console.log("[%s] -----Data End-----", self.id);
            }).catch(function(err) {
              console.log(err);
            });
          }
        }).catch(function(err) {
          console.log(err);
        });
      }).catch(function(err) {
        console.log(err);
      });
      continue;
    }

    console.log("[%s] Set the result of proof of bandwidth to Validation System", this.id);
    this.validationSystem.isProofOfBandwidthSuccessful(sessionID, result, pathTokenList.toString(), PoBBreakpoint, sessionArray[i].sequenceNumber, {from: this.ethereumAccount, gas: 1000000}).then(function() {
      sessionCounter++;
      self.validationSystem.getSessionStatus(sessionID, sessionCounter, {from: self.ethereumAccount}).then(function(result) {
        console.log("[%s] -----Data from Validation System-----", self.id);
        console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
        console.log("[%s] Transfer result: %s", self.id, result[3].toString());
        console.log("[%s] Sequence number: %d", self.id, result[4]);
        console.log("[%s] The number of packets: %d", self.id, result[5]);
        if (result[6] != "") {
          console.log("[%s] Transfer breakpoint: %s", self.id, result[6]);
        }
        console.log("[%s] PoB result: %s", self.id, result[7].toString());
        if (result[8] != "") {
          console.log("[%s] PoB breakpoint: %s", self.id, result[8]);
        }
        console.log("[%s] -----Data End-----", self.id);

        getReputationCounter++;
        if (getReputationCounter == theNumberOfPackets) {
          self.PoBEndTime = Date.now();
          console.log("*[%s] PoB end time: %d*", self.id, self.PoBEndTime);
          console.log("*[%s] Time used to do PoB: %d (ms)*", self.id, (self.PoBEndTime-self.PoBStartTime));
          self.reputationSystem.getReputationScore({from: self.ethereumAccount}).then(function(result) {
            console.log("[%s] Get reputation score from Reputation System", self.id);
            console.log("[%s] -----Data from Reputation System-----", self.id);
            console.log("[%s] Reputation score: %d", self.id, result.toNumber());
            console.log("[%s] -----Data End-----", self.id);
          }).catch(function(err) {
            console.log(err);
          });
        }
      }).catch(function(err) {
        console.log(err);
      });
    }).catch(function(err) {
      console.log(err);
    });
  }
}

Node.prototype._addPoBisTriggeredListener = function(PoBisTriggered) {
  var self = this;
  PoBisTriggered.watch(function(error, result) {
    if (!error) {
      /*console.log("[%s] Event PoBisTriggered is triggered", self.id);
      console.log("[%s] -----Data from Validation System-----", self.id);
      console.log("[%s] Session ID: %d", self.id, result.args.sessionID);
      console.log("[%s] -----Data End-----", self.id);*/

      self.isPoBTriggered.forEach(function(element) {
        if (element.sessionID == result.args.sessionID) {
          clearTimeout(element.triggerPoBTimer);
        }
      });
    }
    else {
      console.log(error);
    }
  });
}

Node.prototype._registerInPaymentSystem = function() {
  var self = this;
  this.paymentSystem.initAddressList(this.id, {from: this.ethereumAccount}).then(function() {
    console.log("[%s] Registered in Payment System", self.id);
  }).catch(function(err) {
    console.log(err);
  });
}

Node.prototype.setRelayContract = function(vendor, relayType, maxBandwidth, expirationTime, price) {
  var self = this;
  price = web3.toWei(price, 'ether');
  this.paymentSystem.setRelayContract(this.id, vendor, relayType, maxBandwidth, expirationTime, price, {from: this.ethereumAccount, gas: 1000000, value: price}).then(function() {
    self.paymentSystem.getRelayContractStatus(self.id, vendor, {from: self.ethereumAccount}).then(function(result) {
      console.log("[%s] Relay contract is set", self.id);
      console.log("[%s] -----Data from Payment System-----", self.id);
      console.log("[%s] Purchaser ID: %s", self.id, self.id);
      console.log("[%s] Vendor ID: %s", self.id, vendor);
      console.log("[%s] Relay type: %s", self.id, result[0]);
      console.log("[%s] Max bandwidth: %d (char)", self.id, result[1].toNumber());
      var date = new Date(0);
      date.setUTCSeconds(result[2].toNumber());
      console.log("[%s] Set time: %s", self.id, date);
      console.log("[%s] Expiration time: %d (second)", self.id, result[3].toNumber());
      console.log("[%s] Price: %d (ether)", self.id, web3.fromWei(result[4], 'ether').toNumber());
      console.log("[%s] -----Data End-----", self.id);
    }).catch(function(err) {
      console.log(err);
    });
  }).catch(function(err) {
    console.log(err);
  });
}

Node.prototype._addRelayContractIsSetListener = function(relayContractIsSet) {
  var self = this;
  relayContractIsSet.watch(function(error, result) {
    if (!error) {
      /*console.log("[%s] Event relayContractIsSet is triggered", self.id);
      console.log("[%s] -----Data from Payment System-----", self.id);
      console.log("[%s] Purchaser ID: %s", self.id, result.args.purchaserID);
      console.log("[%s] Vendor ID: %s", self.id, result.args.vendorID);
      console.log("[%s] Relay type: %s", self.id, result.args.relayType);
      console.log("[%s] Max bandwidth: %d (char)", self.id, result.args.maxBandwidth.toNumber());
      console.log("[%s] Expiration time: %d (second)", self.id, result.args.expirationTime.toNumber());
      console.log("[%s] -----Data End-----", self.id);*/

      if (result.args.vendorID == self.id) {
        var relayContractTimer = setTimeout(function() {
          console.log("[%s] Relay contract expired, purchaser ID: %s", self.id, result.args.purchaserID);
          self.paymentSystem.relayContractFinish(result.args.purchaserID, self.id, {from: self.ethereumAccount, gas: 1000000}).then(function() {
            console.log("[%s] Balance: %d (ether)", self.id, web3.fromWei(web3.eth.getBalance(self.ethereumAccount), 'ether').toNumber());
          }).catch(function(err) {
            console.log(err);
          });
        }, result.args.expirationTime.toNumber() * 1000);

        self.relayContractStatus.push({
          purchaserID: result.args.purchaserID,
          relayType: result.args.relayType,
          maxBandwidth: result.args.maxBandwidth.toNumber(),
          relayContractTimer: relayContractTimer
        });
      }
    }
    else {
      console.log(error);
    }
  });
}

Node.prototype._addTimeToUploadPureHashOfPayloadListener = function(timeToUploadPureHashOfPayload) {
  var self = this;
  timeToUploadPureHashOfPayload.watch(function(error, result) {
    if (!error) {
      /*console.log("[%s] Event timeToUploadPureHashOfPayload is triggered", self.id);
      console.log("[%s] -----Data from Validation System-----", self.id);
      console.log("[%s] Session ID: %d", self.id, result.args.sessionID);
      console.log("[%s] Sequence number: %d", self.id, result.args.sequenceNumber);
      console.log("[%s] Sender address: %s", self.id, result.args.sender);
      console.log("[%s] -----Data End-----", self.id);*/

      if (result.args.sender == self.ethereumAccount) {
        var pureHashOfPayload;
        self.seedArray.forEach(function(item) {
          if (item.sessionID == result.args.sessionID && item.sequenceNumber == result.args.sequenceNumber) {
            pureHashOfPayload = item.pureHashOfPayload;
          }
        });
        self.validationSystem.uploadPureHashOfPayload(result.args.sessionID, result.args.sequenceNumber, pureHashOfPayload, {from: self.ethereumAccount, gas: 1000000}).then(function() {
          self.validationSystem.getSessionInformation(result.args.sessionID, result.args.sequenceNumber, {from: self.ethereumAccount}).then(function(result) {
            console.log("[%s] Check whether pureHashOfPayload is uploaded to Validation System", self.id);
            console.log("[%s] -----Data from Validation System-----", self.id);
            console.log("[%s] Session ID: %d", self.id, result[0]);
            console.log("[%s] Pure hash of payload: %s", self.id, result[2]);
            console.log("[%s] Sequence number: %d", self.id, result[5]);
            console.log("[%s] -----Data End-----", self.id);
          }).catch(function(err) {
            console.log(err);
          });
        }).catch(function(err) {
          console.log(err);
        });
      }
    }
    else {
      console.log(error);
    }
  });
}

module.exports = Node;

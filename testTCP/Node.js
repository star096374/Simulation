'use strict';

const net = require('net');
const sha256 = require('js-sha256');

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
      this._addcompeteForPoBListener(competeForPoB);

      var winPoBCompetition = this.validationSystem.winPoBCompetition({fromBlock: 0, toBlock: 'latest'});
      this._addwinPoBCompetitionListener(winPoBCompetition);
    }
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
                  self.validationSystem.setSessionCheckable(message.sessionID, message.sequenceNumber, {from: self.ethereumAccount}).catch(function(err) {
                    console.log(err);
                  });

                  if (message.sequenceNumber == 0) {
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
                    }, 5000);
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
            var hashedPayload = sha256(seed + message.payload);
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
                  self.sendMessageToExitRelayNodes(messageWithNewPathToken);
                }
                else if (gatewayNumber > 0) {
                  console.log("[%s] Forward message to gateway", self.id);
                  self.sendMessageToGateway(messageWithNewPathToken);
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

                  self.socketServer.forEach(function(item) {
                    if (item.type == 'Entry Relay' && item.id == nextNodeID) {
                      self.sendMessageToEntryRelayNode(nextNodeID, newMessage);
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
              console.log("*[%s] Receive ack, session ID: %d, sequenceNumber: %d*", self.id,  element[0], element[1]);
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
    socket.write(info + '\n');
  });
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
          self.receivedPacket.push(message.sessionID + ',' + message.sequenceNumber);
          // send ack to sender
          socket.write(message.sessionID + ',' + message.sequenceNumber + '\n');
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
                self.validationSystem.setSessionCheckable(message.sessionID, message.sequenceNumber, {from: self.ethereumAccount}).catch(function(err) {
                  console.log(err);
                });

                if (message.sequenceNumber == 0) {
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
                  }, 5000);
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
          var hashedPayload = sha256(seed + message.payload);
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
              self.socketServer.forEach(function(item) {
                if (item.type == 'Entry Relay' && item.id == nextNodeID) {
                  self.sendMessageToEntryRelayNode(nextNodeID, newMessage);
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
          self.socketClient[index].id = element;
        }
        else {
          // receive ack, element = session ID, sequence number
          if (self.receivedAck.includes(element[0] + ',' + element[1]) == true) {
            console.log("*[%s] The ack has been received, drop it*", self.id);
            return;
          }
          else {
            console.log("*[%s] Receive ack, session ID: %d, sequenceNumber: %d*", self.id,  element[0], element[1]);
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
            self.validationSystem.setSessionCheckable(parsedMessage.sessionID, parsedMessage.sequenceNumber, {from: self.ethereumAccount}).catch(function(err) {
              console.log(err);
            });

            if (parsedMessage.sequenceNumber == 0) {
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
              }, 5000);
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

  // store fromNodeID to seedArray
  this.seedArray.forEach(function(item) {
    if (item.sessionID == parsedMessage.sessionID && item.sequenceNumber == parsedMessage.sequenceNumber) {
      item.toNodeID = socketsList[index].id;
    }
  });
}

Node.prototype.sendMessageToExitRelayNodes = function(message) {
  var self = this;
  this.socketClient.forEach(function(element) {
    if (element.type == 'Exit Relay') {
      var result = element.address.split(':');
      var host = result[0];
      var port = result[1];
      self._sendMessage('client', host, port, message);
    }
  });
}

Node.prototype.sendMessageToGateway = function(message) {
  var self = this;
  this.socketClient.forEach(function(element) {
    if (element.type == 'Gateway') {
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
    this.validationSystem.addSession(sessionID, receiver, payload, packetLength, sequenceNumber, theNumberOfPackets, {from: this.ethereumAccount, gas: 1000000}).then(function() {
      sessionCounter++;
      self.validationSystem.getSessionInformation(sessionID, sessionCounter, {from: self.ethereumAccount}).then(function(result) {
        console.log("[%s] -----Data from Validation System-----", self.id);
        console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
        console.log("[%s] Receiver address: %s", self.id, result[1]);
        console.log("[%s] Payload: %s", self.id, result[2]);
        console.log("[%s] Packet length: %d", self.id, result[3]);
        console.log("[%s] Sequence number: %d", self.id, result[5]);
        console.log("[%s] The number of packets: %d", self.id, result[6]);
        console.log("[%s] -----Data End-----", self.id);

        uploadCounter++;
        var payload = packetArray[uploadCounter].payload;
        var sequenceNumber = packetArray[uploadCounter].sequenceNumber;

        // hash payload by sha256, and then upload to Validation System
        var seed = self._generateRandomString();
        var hashedPayload = sha256(seed + payload);
        self.seedArray.push({
          sessionID: sessionID,
          hash: hashedPayload,
          seed: seed,
          sequenceNumber: sequenceNumber
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
            self.sendMessageToExitRelayNodes(message);
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
          var hash, seed, toNodeID;
          self.seedArray.forEach(function(item) {
            if (item.sessionID == result.args.sessionID && item.sequenceNumber == result.args.sequenceNumber) {
              hash = item.hash;
              seed = item.seed;
              toNodeID = item.toNodeID.toString();
            }
          });
          self.validationSystem.uploadSeedAndToNodeID(result.args.sessionID, hash, seed, result.args.sequenceNumber, toNodeID, {from: self.ethereumAccount, gas: 1000000}).then(function() {
            self.validationSystem.getData(result.args.sessionID, result.args.sequenceNumber, {from: self.ethereumAccount}).then(function(result) {
              console.log("[%s] Check whether seed is uploaded to Validation System", self.id);
              console.log("[%s] -----Data from Validation System-----", self.id);
              console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
              console.log("[%s] Hash value: %s", self.id, result[1]);
              console.log("[%s] Seed: %s", self.id, result[2]);
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
      });
    }
    else {
      console.log(error);
    }
  });
}

Node.prototype._registerInReputationSystem = function() {
  var self = this;
  this.reputationSystem.initReputationScore(this.id, {from: this.ethereumAccount}).then(function() {
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

Node.prototype._addcompeteForPoBListener = function(competeForPoB) {
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

Node.prototype._addwinPoBCompetitionListener = function(winPoBCompetition) {
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
  console.log("[%s] Get data for proof of bandwidth", this.id);

  for (var i = 0; i < theNumberOfPackets; i++) {
    var sessionArray = [];
    var dataArray = [];
    var sessionCounter = 0;
    this.validationSystem.requestForCheckingSession(sessionID, i, {from: this.ethereumAccount}).then(function(result) {
      sessionArray.push({
        payload: result[0],
        pathToken: result[1],
        sequenceNumber: result[2].toNumber()
      });
      self.validationSystem.setSessionIsPending(sessionID, result[2], {from: self.ethereumAccount}).then(function() {
        sessionCounter++;
        if (sessionCounter == theNumberOfPackets) {
          var dataCounter = 0;
          var theNumberOfdata = 0;
          sessionArray.forEach(function(element) {
            var pathTokenList = element.pathToken.split(',');
            theNumberOfdata += pathTokenList.length-1;
            for (var j = 0; j < pathTokenList.length-1; j++) {
              self.validationSystem.requestForCheckingData(sessionID, pathTokenList[j], element.sequenceNumber, {from: self.ethereumAccount}).then(function(dataResult) {
                dataArray.push({
                  senderID: dataResult[0],
                  hashValue: dataResult[1],
                  seed: dataResult[2],
                  sequenceNumber: dataResult[3].toNumber()
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
        if (dataArray[k].sequenceNumber == sessionArray[i].sequenceNumber && dataArray[k].senderID == pathTokenList[j]) {
          if (sha256(dataArray[k].seed + sessionArray[i].payload) == dataArray[k].hashValue) {
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

module.exports = Node;

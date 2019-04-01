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

    var competeForPoB = this.validationSystem.competeForPoB({fromBlock: 0, toBlock: 'latest'});
    if (this.id == "checker0" || this.id == "checker1") {
      this._addcompeteForPoBListener(competeForPoB);
    }

    var winPoBCompetition = this.validationSystem.winPoBCompetition({fromBlock: 0, toBlock: 'latest'});
    if (this.id == "checker0" || this.id == "checker1") {
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
  // the session ID of the packet you have received
  this.receivedPacket = [];

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
          // receive ack, message = session ID
          if (typeof message == 'number') {
            isJson = false;
          }
        } catch (e) {
          isJson = false;
        }
        if (isJson == true) {
          // check whether you have received the packet
          if (self.receivedPacket.includes(message.sessionID) == true) {
            console.log("[%s] The packet has been received, drop it", self.id);
            return;
          }
          else {
            self.receivedPacket.push(message.sessionID);
            // send ack to sender
            socket.write(message.sessionID + '\n');
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
            console.log("[%s] -----Message End-----", self.id);

            // upload pathToken to Validation System
            self.validationSystem.uploadPathToken(message.sessionID, message.pathToken.toString(), "", {from: self.ethereumAccount, gas: 1000000}).then(function() {
              console.log("[%s] Upload path token to Validation System", self.id);

              self.validationSystem.getSession(message.sessionID, {from: self.ethereumAccount}).then(function(result) {
                console.log("[%s] -----Data from Validation System-----", self.id);
                console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
                console.log("[%s] Receiver address: %s", self.id, result[1]);
                console.log("[%s] Path token: %s", self.id, result[4]);
                console.log("[%s] Transfer result: %s", self.id, result[5].toString());
                console.log("[%s] -----Data End-----", self.id);

                setTimeout(function() {
                  console.log("[%s] Set checkable of the session true", self.id);
                  self.validationSystem.setSessionCheckable(message.sessionID, {from: self.ethereumAccount}).catch(function(err) {
                    console.log(err);
                  });

                  setTimeout(function() {
                    console.log("[%s] Decide the checker of proof of bandwidth", self.id);
                    self.validationSystem.decideCheckerOfPoB(message.sessionID, {from: self.ethereumAccount}).then(function() {
                      self.validationSystem.getSession(message.sessionID, {from: self.ethereumAccount}).then(function(result) {
                        console.log("[%s] -----Data from Validation System-----", self.id);
                        console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
                        console.log("[%s] PoBChecker address: %s", self.id, result[9].toString());
                        console.log("[%s] -----Data End-----", self.id);
                      }).catch(function(err) {
                        console.log(err);
                      });
                    }).catch(function(err) {
                      console.log(err);
                    });
                  }, 5000);
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
              payload: message.payload
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
            console.log("[%s] Upload hashed payload to Validation System", self.id);
            var seed = self._generateRandomString();
            var hashedPayload = sha256(seed + message.payload);
            self.seedArray.push({
              sessionID: message.sessionID,
              hash: hashedPayload,
              seed: seed
            });
            self.validationSystem.uploadData(message.sessionID, self.id, hashedPayload, {from: self.ethereumAccount, gas: 1000000}).then(function() {
              self.validationSystem.getData(message.sessionID, {from: self.ethereumAccount}).then(function(result) {
                console.log("[%s] -----Data from Validation System-----", self.id);
                console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
                console.log("[%s] Hash value: %s", self.id, result[1]);
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
                    payload: message.payload
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
          // receive ack, element = session ID
          if (element.length == 1) {
            element = element.toString();
            console.log("*[%s] Receive ack, session ID: %d*", self.id, element);
            var index = self.retransmitArray.map(function(t) {
              return t.sessionID.toString();
            }).indexOf(element);
            clearInterval(self.retransmitArray[index].intervalID);
            self.retransmitArray.splice(index, 1);
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
        // receive ack, message = session ID
        if (typeof message == 'number') {
          isJson = false;
        }
      } catch (e) {
        isJson = false;
      }
      if (isJson == true) {
        // check whether you have received the packet
        if (self.receivedPacket.includes(message.sessionID) == true) {
          console.log("[%s] The packet has been received, drop it", self.id);
          return;
        }
        else {
          self.receivedPacket.push(message.sessionID);
          // send ack to sender
          socket.write(message.sessionID + '\n');
        }

        message.pathToken.push(self.id);
        if (message.receiver == self.id) {
          console.log("[%s] -----Message Received-----", self.id);
          console.log("[%s] Session ID: %s", self.id, message.sessionID);
          console.log("[%s] Sender: %s", self.id, message.sender);
          console.log("[%s] Receiver: %s", self.id, message.receiver);
          console.log("[%s] Path token: %s", self.id, message.pathToken);
          console.log("[%s] Payload: %s", self.id, message.payload);
          console.log("[%s] -----Message End-----", self.id);

          // upload pathToken to Validation System
          self.validationSystem.uploadPathToken(message.sessionID, message.pathToken.toString(), "", {from: self.ethereumAccount, gas: 1000000}).then(function() {
            console.log("[%s] Upload path token to Validation System", self.id);

            self.validationSystem.getSession(message.sessionID, {from: self.ethereumAccount}).then(function(result) {
              console.log("[%s] -----Data from Validation System-----", self.id);
              console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
              console.log("[%s] Receiver address: %s", self.id, result[1]);
              console.log("[%s] Path token: %s", self.id, result[4]);
              console.log("[%s] Transfer result: %s", self.id, result[5].toString());
              console.log("[%s] -----Data End-----", self.id);

              setTimeout(function() {
                console.log("[%s] Set checkable of the session true", self.id);
                self.validationSystem.setSessionCheckable(message.sessionID, {from: self.ethereumAccount}).catch(function(err) {
                  console.log(err);
                });

                setTimeout(function() {
                  console.log("[%s] Decide the checker of proof of bandwidth", self.id);
                  self.validationSystem.decideCheckerOfPoB(message.sessionID, {from: self.ethereumAccount}).then(function() {
                    self.validationSystem.getSession(message.sessionID, {from: self.ethereumAccount}).then(function(result) {
                      console.log("[%s] -----Data from Validation System-----", self.id);
                      console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
                      console.log("[%s] PoBChecker address: %s", self.id, result[9].toString());
                      console.log("[%s] -----Data End-----", self.id);
                    }).catch(function(err) {
                      console.log(err);
                    });
                  }).catch(function(err) {
                    console.log(err);
                  });
                }, 5000);
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
            payload: message.payload
          }
          var newMessage = Buffer.from(JSON.stringify(newPacket));

          // hash payload by sha256, and then upload to Validation System
          console.log("[%s] Upload hashed payload to Validation System", self.id);
          var seed = self._generateRandomString();
          var hashedPayload = sha256(seed + message.payload);
          self.seedArray.push({
            sessionID: message.sessionID,
            hash: hashedPayload,
            seed: seed
          });
          self.validationSystem.uploadData(message.sessionID, self.id, hashedPayload, {from: self.ethereumAccount, gas: 1000000}).then(function() {
            self.validationSystem.getData(message.sessionID, {from: self.ethereumAccount}).then(function(result) {
              console.log("[%s] -----Data from Validation System-----", self.id);
              console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
              console.log("[%s] Hash value: %s", self.id, result[1]);
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
        if (isNaN(Number(element)) == true) {
          // element = node ID
          var index = self.socketClient.map(function(t) {
            return t.socket;
          }).indexOf(socket);
          self.socketClient[index].id = element;
        }
        else {
          // receive ack, element = session ID
          console.log("*[%s] Receive ack, session ID: %d*", self.id, element);
          var index = self.retransmitArray.map(function(t) {
            return t.sessionID.toString();
          }).indexOf(element);
          clearInterval(self.retransmitArray[index].intervalID);
          self.retransmitArray.splice(index, 1);
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
      return t.sessionID;
    }).indexOf(parsedMessage.sessionID);
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
      self.validationSystem.uploadPathToken(parsedMessage.sessionID, parsedMessage.pathToken.toString(), transferBreakpoint, {from: self.ethereumAccount, gas: 1000000}).then(function() {
        console.log("[%s] Upload path token to Validation System", self.id);

        self.validationSystem.getSession(parsedMessage.sessionID, {from: self.ethereumAccount}).then(function(result) {
          console.log("[%s] -----Data from Validation System-----", self.id);
          console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
          console.log("[%s] Receiver address: %s", self.id, result[1]);
          console.log("[%s] Path token: %s", self.id, result[4]);
          console.log("[%s] Transfer result: %s", self.id, result[5].toString());
          console.log("[%s] Transfer breakpoint: %s", self.id, result[6]);
          console.log("[%s] -----Data End-----", self.id);

          setTimeout(function() {
            console.log("[%s] Set checkable of the session true", self.id);
            self.validationSystem.setSessionCheckable(parsedMessage.sessionID, {from: self.ethereumAccount}).catch(function(err) {
              console.log(err);
            });

            setTimeout(function() {
              console.log("[%s] Decide the checker of proof of bandwidth", self.id);
              self.validationSystem.decideCheckerOfPoB(parsedMessage.sessionID, {from: self.ethereumAccount}).then(function() {
                self.validationSystem.getSession(parsedMessage.sessionID, {from: self.ethereumAccount}).then(function(result) {
                  console.log("[%s] -----Data from Validation System-----", self.id);
                  console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
                  console.log("[%s] PoBChecker address: %s", self.id, result[9].toString());
                  console.log("[%s] -----Data End-----", self.id);
                }).catch(function(err) {
                  console.log(err);
                });
              }).catch(function(err) {
                console.log(err);
              });
            }, 5000);
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
    counter: 0
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

Node.prototype.addSessionToValidationSystem = function(sessionID, receiver, message, payload) {
  var self = this;
  this.validationSystem.addSession(sessionID, receiver, payload, payload.length, {from: this.ethereumAccount, gas: 1000000}).then(function() {
    self.validationSystem.getSession(sessionID, {from: self.ethereumAccount}).then(function(result) {
      console.log("[%s] -----Data from Validation System-----", self.id);
      console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
      console.log("[%s] Receiver address: %s", self.id, result[1]);
      console.log("[%s] Payload: %s", self.id, result[2]);
      console.log("[%s] Payload length: %d", self.id, result[3]);
      console.log("[%s] -----Data End-----", self.id);

      // hash payload by sha256, and then upload to Validation System
      console.log("[%s] Upload hashed payload to Validation System", self.id);
      var seed = self._generateRandomString();
      var hashedPayload = sha256(seed + payload);
      self.seedArray.push({
        sessionID: sessionID,
        hash: hashedPayload,
        seed: seed
      });
      self.validationSystem.uploadData(sessionID, self.id, hashedPayload, {from: self.ethereumAccount, gas: 1000000}).then(function() {
        self.validationSystem.getData(sessionID, {from: self.ethereumAccount}).then(function(result) {
          console.log("[%s] -----Data from Validation System-----", self.id);
          console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
          console.log("[%s] Hash value: %s", self.id, result[1]);
          console.log("[%s] -----Data End-----", self.id);
          console.log("[%s] Start sending message", self.id);
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
          // according to session ID, upload seed to Validation System
          var hash, seed;
          self.seedArray.forEach(function(item) {
            if (item.sessionID == result.args.sessionID) {
              hash = item.hash;
              seed = item.seed;
            }
          });
          self.validationSystem.uploadSeed(result.args.sessionID, hash, seed, {from: self.ethereumAccount, gas: 1000000}).then(function() {
            self.validationSystem.getData(result.args.sessionID, {from: self.ethereumAccount}).then(function(result) {
              console.log("[%s] Check whether seed is uploaded to Validation System", self.id);
              console.log("[%s] -----Data from Validation System-----", self.id);
              console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
              console.log("[%s] Hash value: %s", self.id, result[1]);
              console.log("[%s] Seed: %s", self.id, result[2]);
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
        self.getDataForProofOfBandwidth(result.args.sessionID);
      }
    }
    else {
      console.log(error);
    }
  });
}

Node.prototype.getDataForProofOfBandwidth = function(sessionID) {
  var self = this;
  console.log("[%s] Get data for proof of bandwidth", this.id);

  var payload, pathToken;
  var dataArray = [];
  var isAllDataCollected = false;
  this.validationSystem.requestForCheckingSession(sessionID, {from: this.ethereumAccount}).then(function(result) {
    payload = result[0];
    pathToken = result[1];
    self.validationSystem.setSessionIsPending(sessionID, {from: self.ethereumAccount}).then(function() {
      var pathTokenList = pathToken.split(',');
      var counter = 0;
      for (var i = 0; i < pathTokenList.length-1; i++) {
        self.validationSystem.requestForCheckingData(sessionID, pathTokenList[i], {from: self.ethereumAccount}).then(function(dataResult) {
          dataArray.push({
            sessionID: sessionID,
            senderID: dataResult[0],
            hashValue: dataResult[1],
            seed: dataResult[2]
          });
          if (dataArray.length == pathTokenList.length-1) {
            isAllDataCollected = true;
          }
          self.validationSystem.setDataIsPending(sessionID, pathTokenList[i], {from: self.ethereumAccount}).then(function() {
            counter += 1;
            if (isAllDataCollected == true && counter == dataArray.length) {
              self._doProofOfBandwidth(sessionID, payload, pathTokenList, dataArray);
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
  }).catch(function(err) {
    console.log(err);
  });
}

Node.prototype._doProofOfBandwidth = function(sessionID, payload, pathTokenList, dataArray) {
  var self = this;
  console.log("[%s] Start to do proof of bandwidth", this.id);

  var result = true;
  var PoBBreakpoint = "";
  for (var i = 0; i < pathTokenList.length-1; i++) {
    var isMatched = false;
    for (var j = 0; j < dataArray.length; j++) {
      if (dataArray[j].senderID == pathTokenList[i]) {
        if (sha256(dataArray[j].seed + payload) == dataArray[j].hashValue) {
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
      PoBBreakpoint = pathTokenList[i];
      break;
    }
  }

  console.log("[%s] Set the result of proof of bandwidth to Validation System", this.id);
  this.validationSystem.isProofOfBandwidthSuccessful(sessionID, result, pathTokenList.toString(), PoBBreakpoint, {from: this.ethereumAccount, gas: 1000000}).then(function() {
    self.validationSystem.getSession(sessionID, {from: self.ethereumAccount}).then(function(result) {
      console.log("[%s] -----Data from Validation System-----", self.id);
      console.log("[%s] Session ID: %d", self.id, result[0].toNumber());
      console.log("[%s] Transfer result: %s", self.id, result[5].toString());
      if (result[6] != "") {
        console.log("[%s] Transfer breakpoint: %s", self.id, result[6]);
      }
      console.log("[%s] PoB result: %s", self.id, result[7].toString());
      if (result[8] != "") {
        console.log("[%s] PoB breakpoint: %s", self.id, result[8]);
      }
      console.log("[%s] -----Data End-----", self.id);
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
  }).catch(function(err) {
    console.log(err);
  });
}

module.exports = Node;

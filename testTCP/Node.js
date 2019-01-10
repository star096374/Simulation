'use strict';

const net = require('net');

function Node(options) {
  var self = this;
  if (options.id !== undefined) {
    this.id = options.id;
  }
  if (options.port !== undefined && options.host !== undefined) {
    this.port = options.port;
    this.host = options.host;
  }
  else {
    console.error("[%s] Server port or host is undefined.", this.id);
    return;
  }

  // the socket connected to the server, i.e. you are the server
  this.socketServer = [];

  this.server = net.createServer(function(socket) {
    // If someone connect to this server, this function will be triggered.
    console.log('[%s] A client %s:%d connect to the server',self.id, socket.remoteAddress, socket.remotePort);

    // Defined the action when the event happen.
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
          if (message.receiver == self.id) {
            console.log('[%s] -----Message Received-----', self.id);
            console.log('[%s] Sender: %s', self.id, message.sender);
            console.log('[%s] Receiver: %s', self.id, message.receiver);
            console.log('[%s] Payload: %s', self.id, message.payload);
            console.log('[%s] -----Message End-----', self.id);
          }
          else {
            // check the number of exit relay nodes
            var exitRelayNumber = 0;
            self.socketClient.filter(function(item) {
              if (item.type == 'Exit Relay') {
                exitRelayNumber++;
              }
            });
            // check the number of gateway, i.e. from the last exit relay node to the first entry relay node
            var gatewayNumber = 0;
            self.socketClient.filter(function(item) {
              if (item.type == 'Gateway') {
                gatewayNumber++;
              }
            });
            if (exitRelayNumber > 0) {
              console.log('[%s] Forward message to exit relay nodes', self.id);
              self.sendMessageToExitRelayNodes(element);
            }
            else if (gatewayNumber > 0) {
              console.log('[%s] Forward message to gateway', self.id);
              self.sendMessageToGateway(element);
            }
            else {
              console.log('[%s] Forward message to the entry relay node', self.id);
              self.sendMessageToReceiver(element);
            }
          }
        }
        else {
          self.socketServer.push({
            type: element,
            address: socket.remoteAddress + ':' + socket.remotePort,
            socket: socket
          });
        }
      });
    });
  });
  this.server.listen(this.port, this.host);

  // the socket connect to another server, i.e. you are the client
  this.socketClient = [];
}

Node.prototype.connectToAnotherServer = function(type, host, port) {
  var self = this;
  var socket = new net.Socket();
  this.socketClient.push({
    type: type,
    address: host + ':' + port,
    socket: socket
  });
  socket.connect(port, host, function() {
    console.log('[%s] Connected to ' + host + ':' + port, self.id);
    socket.write(type + '\n');
  });
  socket.on('data', function(data) {
    var message = JSON.parse(data.toString());
    if (message.receiver == self.id) {
      console.log('[%s] -----Message Received-----', self.id);
      console.log('[%s] Sender: %s', self.id, message.sender);
      console.log('[%s] Receiver: %s', self.id, message.receiver);
      console.log('[%s] Payload: %s', self.id, message.payload);
      console.log('[%s] -----Message End-----', self.id);
    }
    else {
      console.log('[%s] Forward message to the entry relay node', self.id);
      self.sendMessageToReceiver(data);      
    }
  });
  socket.on('close', function() {
    var index = self.socketClient.map(function(t) {
      return t.socket;
    }).indexOf(socket);
    self.socketClient.splice(index, 1);
    console.log('[%s] Connection closed-' + socket.remoteAddress + ':' + socket.remotePort, self.id);
  });
};

Node.prototype._sendMessageToClient = function(host, port, message) {
  var socket;
  var index = this.socketClient.map(function(t) {
    return t.address;
  }).indexOf(host + ':' + port);
  if (index == -1) {
    console.error("[%s] You didn't connect to the server.", this.id);
    return;
  }
  socket = this.socketClient[index].socket;
  socket.write(message + '\n');
}

Node.prototype.sendMessageToExitRelayNodes = function(message) {
  var self = this;
  this.socketClient.forEach(function(element) {
    if (element.type == 'Exit Relay') {
      var result = element.address.split(':');
      var host = result[0];
      var port = result[1];
      self._sendMessageToClient(host, port, message);
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
      self._sendMessageToClient(host, port, message);
    }
  });
}

Node.prototype._sendMessageToServer = function(host, port, message) {
  var socket;
  var index = this.socketServer.map(function(t) {
    return t.address;
  }).indexOf(host + ':' + port);
  if (index == -1) {
    console.error("[%s] The client didn't connect to you.", this.id);
    return;
  }
  socket = this.socketServer[index].socket;
  socket.write(message + '\n');
}

Node.prototype.sendMessageToReceiver = function(message) {
  var self = this;
  this.socketServer.forEach(function(element) {
    if (element.type == 'Entry Relay') {
      var result = element.address.split(':');
      var host = result[0];
      var port = result[1];
      self._sendMessageToServer(host, port, message);
    }
  });
}

module.exports = Node;

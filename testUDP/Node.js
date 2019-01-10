'use strict';

const dgram = require('dgram');

function Node(options) {
  if (options.id !== undefined) {
    this.id = options.id;
  }
  if (options.port !== undefined && options.host !== undefined) {
    this.port = options.port;
    this.host = options.host;
  }
  else {
    console.error("[%s] Port or host is undefined.", this.id);
    return;
  }
  this.socket = dgram.createSocket('udp4');
  this._addEventListener(this.socket);
}

// Defined the action when the event happen.
Node.prototype._addEventListener = function(socket) {
  var self = this;
  socket.on('listening', function() {
    var address = socket.address();
    console.log('[%s] Node listening on ' + address.address + ':' + address.port, self.id);
  });

  socket.on('message', function(message, remote) {
    message = JSON.parse(message.toString());
    console.log('[%s] receiver: ' + message.receiver + '-%s:%d', self.id, remote.address, remote.port);
    console.log('[%s] payload: ' + message.payload + '-%s:%d', self.id, remote.address, remote.port);
  });

  socket.bind(this.port, this.host);
}

module.exports = Node;

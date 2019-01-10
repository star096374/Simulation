const io = require('socket.io')();
const io_client = require('socket.io-client');
const async = require('async');

io.listen(3000);
console.log('[server] Listening on 3000 ...');

var counter = 0;
var connection_state = [];
io.on('connection', function(socket) {
  console.log('[server] A client %s connected.', socket.id);
  switch(counter) {
    case 0:
      socket.join('room1');
      connection_state.push({id: socket.id, room: ['room1']});
      break;
    case 1:
      socket.join(['room1', 'room2']);
      connection_state.push({id: socket.id, room: ['room1', 'room2']});
      break;
    case 2:
      socket.join('room2');
      connection_state.push({id: socket.id, room: ['room2']});
      break;
  }
  counter++;

  socket.on('data', function(receiver, payload) {
    console.log('[server] from client %s', socket.id);
    console.log('receiver: %s', receiver);
    console.log('payload: %s', payload);
    var connection_state_index = connection_state.map(function(t) {
      return t.id;
    }).indexOf(socket.id);
    if(connection_state[connection_state_index].room.length == 1) {

    }
    else {

    }
  });
});

var client_id;
var client, client2, client3;

async.series([
  function(callback) {
    client = io_client('http://localhost:3000');
    client.on('connect', function() {
      console.log('[client %s] Connected.', client.id);
      callback(null, client.id);
    });
  },
  function(callback) {
    client2 = io_client('http://localhost:3000');
    client2.on('connect', function() {
      console.log('[client %s] Connected.', client2.id);
      callback(null, client2.id);
    });
  },
  function(callback) {
    client3 = io_client('http://localhost:3000');
    client3.on('connect', function() {
      console.log('[client %s] Connected.', client3.id);
      callback(null, client3.id);
    });
  }
], function(errs, results) {
  if(errs) throw errs;
  client_id = results.slice();
  client.emit('data', client_id[2], 'Hello World!');
});

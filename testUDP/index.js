'use strict';

const Node = require('./Node.js');

var node1 = new Node({
  id: 'node1',
  port: 3000,
  host: '127.0.0.1'
});

var node2 = new Node({
  id: 'node2',
  port: 4000,
  host: '127.0.0.1'
});

var data = {
  receiver: 'Andy',
  payload: 'test message'
}
var message = Buffer.from(JSON.stringify(data));
node1.socket.send(message, 4000, '127.0.0.1', function(err, bytes) {
  if (err) throw err;
  console.log('[%s] UDP message sent to 127.0.0.1:4000', node1.id);
  node1.socket.close();
});

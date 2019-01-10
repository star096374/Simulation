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

var node3 = new Node({
  id: 'node3',
  port: 5000,
  host: '127.0.0.1'
})

var node4 = new Node({
  id: 'node4',
  port: 6000,
  host: '127.0.0.1'
})

var node5 = new Node({
  id: 'node5',
  port: 7000,
  host: '127.0.0.1'
})

var packet = {
  sender: 'node1',
  receiver: 'node5',
  payload: 'test message'
}
var message = Buffer.from(JSON.stringify(packet));

node1.connectToAnotherServer('Exit Relay', '127.0.0.1', 4000);
node2.connectToAnotherServer('Gateway', '127.0.0.1', 5000);
node4.connectToAnotherServer('Entry Relay', '127.0.0.1', 5000);
node5.connectToAnotherServer('Entry Relay', '127.0.0.1', 6000);

setTimeout(function() {
  console.log('*After 1 sec*');
  node1.sendMessageToExitRelayNodes(message);
}, 1000);

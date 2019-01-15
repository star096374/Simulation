'use strict';

const Node = require('./Node.js');

var id = ['node0', 'node1', 'node2', 'node3', 'node4', 'node5'];
var port = [3000, 4000, 5000, 6000, 7000, 8000];

var nodesList = [];

for (var i = 0; i < 6; i++) {
  nodesList.push(new Node({
    id: id[i],
    port: port[i],
    host: '127.0.0.1'
  }));
}

createTopology();

var packet = {
  sender: 'node0',
  receiver: 'node5',
  entryPathFilter: ['node3', 'node4', 'node5'],
  payload: "test message"
}
var message = Buffer.from(JSON.stringify(packet));

setTimeout(function() {
  console.log("*After 1 sec*");
  console.log("[%s] Start sending message", nodesList[0].id);
  nodesList[0].sendMessageToExitRelayNodes(message);
}, 1000);

function createTopology() {
  nodesList[0].connectToAnotherServer('Exit Relay', '127.0.0.1', port[1]);
  nodesList[1].connectToAnotherServer('Exit Relay', '127.0.0.1', port[2]);
  nodesList[2].connectToAnotherServer('Gateway', '127.0.0.1', port[3]);
  nodesList[4].connectToAnotherServer('Entry Relay', '127.0.0.1', port[3]);
  nodesList[5].connectToAnotherServer('Entry Relay', '127.0.0.1', port[4]);
}

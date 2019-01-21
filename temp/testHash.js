const sha256 = require('js-sha256');

var message = 'test';

var seed1 = 'node1';
var seed2 = 'node2';

var message_hashed_1 = sha256(seed1 + message);
var message_hashed_2 = sha256(seed2 + message);

console.log('node1: ' + message_hashed_1);
console.log('node2: ' + message_hashed_2);

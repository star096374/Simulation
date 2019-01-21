'use strict';

var crypto = require('crypto');

crypto.generateKeyPair('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
}, function(err, publicKey, privateKey) {
  var plaintext = 'hello world';
  var ciphertext = encrypt(publicKey, plaintext);
  if (decrypt(privateKey, ciphertext) == plaintext) {
    console.log('Success');
  }
});

function encrypt(publicKey, toEncrypt) {
  var buffer = Buffer.from(toEncrypt);
  var encrypted = crypto.publicEncrypt(publicKey, buffer);
  return encrypted.toString('base64');
}

function decrypt(privateKey, toDecrypt) {
  var buffer = Buffer.from(toDecrypt, 'base64');
  var decrypted = crypto.privateDecrypt(privateKey, buffer);
  return decrypted.toString('utf8');
}

var Promise = require("bluebird"),
    path = require('path'),
    util = require('util'),
    _ = require('lodash'),
    exec = Promise.promisify(require('child_process').exec),
    spawn = require('./spawn');

var Security = function() {
  this.cmd = 'security';

  // return array of identities
  this.getIdentities = function() {
    if(this.identities) return Promise.resolve(this.identities);
    return this._listIdentities().each(this._extractKeyFromIdentity);
  };

  // convenient function to get public key from pem certificate
  this.pemToPub = function(pem) {
    return exec(util.format('%s | openssl x509 -noout -pubkey', pem))
      .spread(function(stdout, stderr) {
        return stdout;
      });
  };

  // get names of code signing identities (as displayed in keychain)
  this._listIdentities = function() {
    if(this.identities) return Promise.resolve(this.identities);

    return this._exec(['find-identity', '-p', 'codesigning', '-v'], {getOutput: true}).bind(this)
      .then(function(list) {
        list = list || '';
        list = list.match(/\".*\"/g);

        if(!list) return Promise.reject('No signing identities found. Install certificates from Apple Member center');

        this.identities = list.map(function(id) {
          return {name: id.replace(/\"/g, ""), pubKey: null};
        });

        return this.identities;
      });
  };

  // extract public key from identity
  this._extractKeyFromIdentity = function(identity) {
    return this.pemToPub(util.format('security find-certificate -c "%s" -p', identity.name))
      .then(function(pub) {
        if(!pub) return Promise.reject('Public key null for ' + identity.name);
        identity.pubKey = pub;
        return identity;
      });
  };

  this._exec = function(args, opts) {
    return spawn(this.cmd, args, opts);
  };
};

module.exports = new Security();

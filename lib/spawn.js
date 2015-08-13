var Promise = require('bluebird'),
    util = require('util'),
    _ = require('lodash'),
    childProcess = require('child_process');

var spawn = function(cmd, args, opts) {
  return new Promise(function (resolve, reject) {
    var child, output = [];

    args = args || [];

    if (opts && opts.env) {
      opts.env = _.assign(process.env, opts.env);
    }

    child = childProcess.spawn(cmd, args, opts);

    function errorMsg(err) {
      return util.format('Spawn error [%s %s]: %s', cmd, args.join(' '), JSON.stringify(err));
    }

    child.on('error', function(err) {
      return reject(errorMsg(err));
    });

    child.on('close', function(code) {
      if(code) return reject(errorMsg(code));
      return resolve(output.join(""));
    });

    if(!opts || opts && !opts.discardStderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', console.error);
    }

    if(opts && opts.logOutput) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', console.log);
    }

    if(opts && opts.getOutput) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', function(data) {
        output.push(data);
      });
    }
  });
};

module.exports = spawn;

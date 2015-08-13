var Promise = require("bluebird"),
    util = require('util'),
    fs = Promise.promisifyAll(require('fs')),
    plist = require('plist'),
    path = require('path'),
    spawn = require('./spawn'),
    XCodeBuild = require('./xcodebuild');

var IosBuilder = function(cwd) {
  this.cwd = cwd || process.cwd();
  this.xcode = new XCodeBuild(cwd);

  this.init = function() {
    return Promise.all([
      this.xcode.check()
    ]).bind(this);
  };

  this.prebuild = function(opts) {
    if(!opts.prebuild) return Promise.resolve();

    var cwd = process.cwd();
    return spawn('sh', ['-c', path.join(cwd, opts.prebuild)], {cwd: cwd});
  };

  this.build = function(opts) {
    var xcode = this.xcode;

    function build() {
      return xcode.build({
        configuration: opts.configuration,
        scheme: opts.scheme,
        sdk: opts.sdk,
        workspace: opts.workspace,
        identity: opts.identity,
        profileId: opts.profileId
      });
    }

    return this.prebuild(opts).then(build);
  };

  this.exportIpa = function(opts) {
    var xcode = this.xcode;

    function archive() {
      return xcode.archive({
        archiveName: opts.archiveName,
        scheme: opts.scheme,
        workspace: opts.workspace,
        project: opts.project,
        configuration: opts.configuration,
        profileId: opts.profileId,
        identity: opts.identity,
        extractDsym: opts.extractDsym
      });
    }

    function exportIpa() {
      return xcode.exportIpa({
        archiveName: opts.archiveName,
        ipaName: opts.ipaName,
        extractDsym: opts.extractDsym
      });
    }

    return this.prebuild(opts)
      .then(archive)
      .then(exportIpa);
  };

  this.updateProjectInfo = function(pfile, variables) {
    if(!pfile) throw new Error('[updateProjectInfo] A pfile path needs to be specified.');

    var pFile = path.join(this.cwd, pfile);

    return fs.readFileAsync(pFile, 'utf8').then(function(pContents) {
      pContents = plist.parse(pContents);
      for (var key in variables) {
        if (variables.hasOwnProperty(key)) {
          pContents[key] = variables[key];
        }
      }
      return plist.build(pContents);
    }).then(function (pContents) {
      return fs.writeFileAsync(pFile, pContents);
    });
  };
};

IosBuilder.create = function(cwd) {
  var ib = new IosBuilder(cwd);
  return ib.init().then(function() {
    return ib;
  });
};

module.exports = IosBuilder;

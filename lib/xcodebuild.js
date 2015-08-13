var Promise = require('bluebird'),
    path = require('path'),
    _ = require('lodash'),
    JSZip = require('jszip'),
    fs = Promise.promisifyAll(require('fs')),
    glob = Promise.promisify(require('glob')),
    spawn = require('./spawn');

var XCodeBuild = function(cwd) {
  this.cmd = 'xcodebuild';
  this.cwd = cwd || process.cwd();

  this.check = function() {
    if(this._check) return this._check;

    function ok() {
      this._check = true;
    }

    return this.exist().bind(this)
      //.then(this.hasSchemes)
      //.then(this.listSdk)
      .then(this.getProjectName)
      .then(ok);
  };

  this.exist = function() {
    if(this._exist) return Promise.resolve(this._exist);

    return spawn('command', ['-v', this.cmd]).bind(this)
      .then(function(code) {
        if(code) return Promise.reject('Please install ' + this.cmd);

        this._exist = true;
        return true;
      });
  };

  this.exec = function(args, opts) {
    return spawn(this.cmd, args, opts);
  };

  this.selectSdk = function(isSimulator) {
    return this.listSdk().then(function(sdks) {

      for(var i = 0; i<sdks.length; i++) {
        if(isSimulator && sdks[i].match(/sim/) ||
          !isSimulator && !sdks[i].match(/sim/)) {
            return sdks[i];
          }
      }

      return Promise.reject('No sdk found');
    });
  };

  this.listSdk = function() {
    if(this._sdk) {
      return Promise.resolve(this._sdk);
    }

    return this.exec(['-showsdks'], {getOutput: true}).bind(this)
      .then(function(data) {
        data = data.match(/[A-Za-z]+\d\.\d/g);

        if(!data) {
          return Promise.reject('No sdk found.');
        }

        this._sdk = data;
        return data;
      });
  };

  this.hasSchemes = function() {
    if(this._hasSchemes) {
      return Promise.resolve(this._hasSchemes);
    }

    return this.exec(['-list'], {getOutput: true, cwd: this.cwd}).bind(this)
      .then(function(data) {
        data = data.match(/Schemes\:/g);

        if(!data) {
          return Promise.reject('No schemes found. Simply open your project with xcode to generate schemes.');
        }

        this._hasSchemes = true;
        return true;
      });
  };

  this.getProjectName = function() {
    if(this.projectName) {
      return Promise.resolve(this.projectName);
    }

    return glob(this.cwd + "/*.xcodeproj").bind(this)
      .then(function(files) {
        if(!files.length) return Promise.reject('Cannot find xcodeproj in ' + this.cwd);

        this.projectName = path.basename(files[0], '.xcodeproj');
        return this.projectName;
      });
  };
};

var Build = {
  _setupBuild: function(opts) {
    var getSdk, args = [], env = {};
    opts = opts || {};

    if(!opts.identity || !opts.profileId) {
      return Promise.reject('Code signing error: Specify a profile and an identity to continue');
    }

    if(opts.sdk) {
      getSdk = Promise.resolve(opts.sdk);
    } else {
      getSdk = this.selectSdk(opts.simulator);
    }

    if (opts.project && opts.workspace) {
      return Promise.reject('Cannot specify both a project and a workspace.');
    }

    if(opts.scheme) args.push('-scheme', opts.scheme);
    if(opts.project) args.push('-project', opts.project);
    if(opts.workspace) args.push('-workspace', opts.workspace);
    if(opts.configuration) args.push('-configuration', opts.configuration);

    args.push('clean', 'build');
    args.push('-derivedDataPath', opts.outDir || path.join(this.cwd, 'build'));

    // xcodebuild is really stupid.
    // Environment variables aren't real.
    // Is this real life?
    if(opts.extractDsym) args.push('DEBUG_INFORMATION_FORMAT=dwarf-with-dsym');
    args.push('CODE_SIGN_IDENTITY='+opts.identity);
    args.push('PROVISIONING_PROFILE='+opts.profileId);

    return getSdk.then(function(sdk) {
      args.push('-sdk', sdk);
      return {
        args: args,
        env: env
      };
    });
  },

  build: function(opts) {
    function build(command) {
      return this.exec(command.args, {logOutput: true, cwd: this.cwd, env: command.env });
    }

    return this._setupBuild(opts).bind(this).then(build);
  }
};

var Archive = {
  _setupArchive: function(opts) {
    var args = [], env = {};
    opts = opts || {};

    if(!opts.identity || !opts.profileId) {
      return Promise.reject('Code signing error: Specify a profile and an identity to continue');
    }

    opts.archiveName = opts.archiveName || this.projectName;

    if(opts.configuration) args.push('-configuration', opts.configuration);
    if(opts.scheme) args.push('-scheme', opts.scheme);
    if(opts.project) args.push('-project', opts.project);
    if(opts.workspace) args.push('-workspace', opts.workspace);

    args.push('-derivedDataPath', opts.outDir || path.join(this.cwd, 'build'));
    args.push('clean', 'archive', '-archivePath', path.join(this.cwd, 'build', opts.archiveName + '.xcarchive'));

    if(opts.extractDsym) args.push('DEBUG_INFORMATION_FORMAT=dwarf-with-dsym');
    args.push('CODE_SIGN_IDENTITY='+opts.identity);
    args.push('PROVISIONING_PROFILE='+opts.profileId);

    return Promise.resolve({
      args: args,
      env: env
    });
  },

  archive: function(opts) {
    var self = this;
    return this._setupArchive(opts).bind(this).then(function (command) {
      return self.exec(command.args, {logOutput: true, cwd: self.cwd, env: command.env});
    });
  }
};

var Ipa = {
  _setupExportIpa: function(opts) {
    var args = [];

    opts.archiveName = opts.archiveName || this.projectName;

    args.push('-exportArchive', '-exportFormat', 'IPA');
    args.push('-archivePath', path.join(this.cwd, 'build', opts.archiveName + '.xcarchive'));
    args.push('-exportWithOriginalSigningIdentity');
    args.push('-exportPath', path.join(this.cwd, 'build', opts.ipaName + '.ipa'));

    return Promise.resolve({
      args: args
    });
  },

  exportIpa: function(opts) {
    var self = this;
    opts = opts || {};

    opts.ipaName = opts.ipaName || (this.projectName + '.' + new Date().getTime());

    return this._setupExportIpa(opts).bind(this).then(function (command) {
      return self.exec(command.args, { logOutput: true, cwd: self.cwd, env: command.env });
    }).then(function () {
      if (opts.extractDsym) {
        return self._extractDsym.call(self, opts);
      } else {
        return arguments;
      }
    });
  },

  _extractDsym: function(opts) {
    var archivePath = path.join(this.cwd, 'build', opts.ipaName + '.xcarchive');
    var dSYMPath = path.join(this.cwd, 'build', opts.ipaName + '.dSYM');

    return glob(archivePath + '/**/*.dSYM').then(function (dSYMs) {
      if (dSYMs.length === 0) {
        return Promise.reject('No dSYM directory found');
      } else {
        var dSYM = dSYMs[0];
        return [dSYM, glob(dSYM + '/**/*')];
      }
    }).spread(function (dSYM, files) {
      var zip = new JSZip();
      var zipFiles = files.map(function (file) {
        return fs.readFileAsync(file).then(function (fileData) {
          var fileNameInZip = path.relative(dSYM, file);
          zip.file(fileNameInZip, fileData);
        }).catch(function (error) {
          if (error.code !== 'EISDIR') {
            throw error;
          }
        });
      });
      return Promise.all(zipFiles).then(function() { return zip; });
    }).then(function (zip) {
      var content = zip.generate({
        type: 'nodebuffer',
        platform: process.platform
      });
      return fs.writeFileAsync(dSYMPath, content);
    });
  }

};

_.extend(XCodeBuild.prototype, Build);
_.extend(XCodeBuild.prototype, Archive);
_.extend(XCodeBuild.prototype, Ipa);

module.exports = XCodeBuild;

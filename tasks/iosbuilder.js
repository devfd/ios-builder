var IosBuilder = require('../'),
    path = require('path');

module.exports = function(grunt) {

  grunt.registerMultiTask('irun', function() {
    var done = this.async(),
        config = grunt.config('iconfig') || {},
        data = this.data,
        cwd = path.resolve(config.path) || process.cwd();

    IosBuilder.create(cwd).then(function(ios) {
      ios.updateProjectInfo({
        appId: data.appId,
        appMode: data.appMode,
        displayName: config.displayName
      })
      .then(function() {
        return ios.build({
          appId: data.appId,
          appMode: data.appMode,
          scheme: data.scheme || config.scheme,
          configuration: data.configuration || config.configuration,
          sdk: data.sdk || config.sdk,
          profileId: data.profileId,
          identity: data.identity,
          prebuild: data.prebuild || config.prebuild
        });
      })
      .then(done);
    });
  });

  grunt.registerMultiTask('ideploy', function() {
    var done = this.async(),
        config = grunt.config('iconfig') || {},
        data = this.data,
        cwd = path.resolve(config.path) || process.cwd();

    IosBuilder.create(cwd).then(function(ios) {
      ios.updateProjectInfo({
        appId: data.appId,
        appMode: data.appMode,
        displayName: config.displayName
      })
      .then(function() {
        return ios.exportIpa({
          appId: data.appId,
          appMode: data.appMode,
          archiveName: data.archiveName,
          scheme: data.scheme || config.scheme,
          configuration: data.configuration || config.configuration,
          profileId: data.profileId,
          profileName: data.profileName,
          identity: data.identity,
          ipaName: data.ipaName,
          prebuild: data.prebuild || config.prebuild
        });
      })
      .then(done);
    });
  });
}

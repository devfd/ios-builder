ios-builder [![Build Status](https://travis-ci.org/devfd/ios-builder.svg?branch=master)](https://travis-ci.org/devfd/ios-builder)
===========

Build and export to IPA using Node.js.

Features
--------

* Fully Promise compatable using Bluebird.
* Can automatically extract zipped dSYM folders for debugging.

Example
-------

```javascript
var IosBuilder = require('./ios-builder');

var ios;

IosBuilder.create(directory).then(function(iosObject) {
    ios = iosObject;
}).then(function () {
    return ios.updateProjectInfo('Info.plist', {
        'BundleDisplayName': 'Example App',
        'BundleName': 'ExampleApp'
    });
}).then(function (){
    return ios.exportIpa({
        appId: 'com.example.app',
        archiveName: 'Example App',
        scheme: null,
        profileId: 'abcd-efghij-klmn',
        identity: 'iPhone Distribution: Example application',
        ipaName: 'ExampleAPp',
        extractDsym: true
    });
});
```
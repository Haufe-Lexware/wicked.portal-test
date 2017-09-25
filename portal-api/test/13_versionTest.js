var assert = require('chai').assert;
var request = require('request');
var utils = require('./testUtils');
var consts = require('./testConsts');
var packageJson = require('../package.json'); 

var baseUrl = consts.BASE_URL;

describe('/confighash', function () {

    var configHash = null;

    it('should be possible to retrieve a config hash', function (done) {
        request.get({
            url: baseUrl + 'confighash'
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            configHash = utils.getText(body);
            assert.isOk(configHash, 'did not retrieve config hash');
            done();
        });
    });

    it('should be possible to retrieve globals with a valid hash', function (done) {
        request.get({
            url: baseUrl + 'globals',
            headers: {
                'X-Config-Hash': configHash
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('should not be possible to retrieve globals with an invalid hash', function (done) {
        request.get({
            url: baseUrl + 'globals',
            headers: {
                'X-Config-Hash': 'configHash'
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 428);
            done();
        });
    });

    it('should be possible to retrieve globals with an valid version', function (done) {
        request.get({
            url: baseUrl + 'globals',
            headers: {
                'X-Config-Hash': configHash,
                'User-Agent': 'wicked.portal-test/' + packageJson.version
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('should not be possible to retrieve globals with an invalid version', function (done) {
        request.get({
            url: baseUrl + 'globals',
            headers: {
                'X-Config-Hash': configHash,
                'User-Agent': 'wicked.portal-test/0.1.0'
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 428);
            done();
        });
    });


    it('should be possible to retrieve globals with a non-wicked user agent version', function (done) {
        request.get({
            url: baseUrl + 'globals',
            headers: {
                'User-Agent': 'curl/7.5.23'
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            done();
        });
    });

    it('should have added a default sessionStore configuration in globals', function (done) {
        request.get({
            url: baseUrl + 'globals',
            headers: {
                'X-Config-Hash': configHash
            }
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            var jsonBody = utils.getJson(body);
            assert.isOk(jsonBody.sessionStore, 'globals.json do not contain a sessionStore property');
            assert.equal(jsonBody.sessionStore.type, 'file', 'default sessionStore.type is not equal "file"');
            done();
        });
    });
});
var assert = require('chai').assert;
var request = require('request');
var utils = require('./testUtils');
var consts = require('./testConsts');

var baseUrl = consts.BASE_URL;

describe('/auth-server', function () {
    it('should be possible to retrieve a known auth-server', function (done) {
        request.get({
            url: baseUrl + 'auth-servers/sample-server' 
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            var jsonBody = utils.getJson(body);
            assert.equal(jsonBody.name, 'sample-server');
            done();
        });
    });

    it('should return a 404 if the auth-server could not be found', function (done) {
        request.get({
            url: baseUrl + 'auth-servers/bad-server' 
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 404);
            done();
        });
    });
});

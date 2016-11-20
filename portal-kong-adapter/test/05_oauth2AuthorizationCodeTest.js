var assert = require('chai').assert;
var request = require('request');
var async = require('async');
var http = require('http');
var URL = require('url');
var qs = require('querystring');
var utils = require('./testUtils');
var consts = require('./testConsts');

var adapterUrl = consts.KONG_ADAPTER_URL;
var kongUrl = consts.KONG_ADMIN_URL;
var gatewayUrl = consts.KONG_GATEWAY_URL;
var apiUrl = consts.BASE_URL;
var internalApiUrl = 'http://kong-adapter-test-data:3003/';
var INTERNAL_API_PORT = 3003;

var adminUserId = '1'; // See test-config/globals.json
var adminEmail = 'foo@bar.com';
var devUserId = '11'; // Fred Flintstone
var devEmail = 'fred@flintstone.com';

var oauth2Api = 'superduper';

var adapterQueue = 'kong-adapter';

function getAuthorizationCode(authenticated_userid, api_id, client_id, scope, auth_server, callback) {
    if (typeof (auth_server) === 'function' && !callback)
        callback = auth_server;
    else if (typeof (scope) === 'function' && !auth_server && !callback)
        callback = scope;
    var registerUrl = adapterUrl + 'oauth2/token/code';

    var correlationId = utils.createRandomId();
    console.log('getAuthorizationCode, correlation id=' + correlationId);

    var reqBody = {
        authenticated_userid: authenticated_userid,
        api_id: api_id,
        client_id: client_id
    };
    if (scope)
        reqBody.scope = scope;
    if (auth_server)
        reqBody.auth_server = auth_server;
    request.post({
        url: registerUrl,
        json: true,
        body: reqBody,
        headers: {
            'Correlation-Id': correlationId
        }
    }, function (err, res, body) {
        // We expect something like this back:
        // https://good.uri#code=239239827389729837298372983
        if (err)
            return callback(err);
        //assert.isNotOk(err);
        if (200 !== res.statusCode)
            return callback(new Error('/oauth2/token/code did not return 200: ' + res.statusCode));
        var jsonBody = utils.getJson(body);
        //console.log('getAuthorizationCode(), jsonBody:');
        //console.log(jsonBody);
        if (!jsonBody.redirect_uri) {
            return callback(new Error('/oauth2/token/implicit did not return a redirect_uri'));
        }
        try {
            var redirectUriString = jsonBody.redirect_uri;
            var redirectUri = URL.parse(redirectUriString);
            var query = redirectUri.query;
            //console.log('query: ' + query);
            var queryParams = qs.parse(query);
            //console.log(queryParams);
            //console.log('Code: ' + queryParams.code);
            //console.log('callback: ' + callback);
            return callback(null, queryParams.code);
        } catch (ex) {
            console.error(ex);
            console.error(ex.stack);
            return callback(ex);
        }
    });
}

function getAccessToken(code, client_id, client_secret, api_id, callback) {
    const tokenUrl = gatewayUrl + api_id + '/oauth2/token';
    const headers = {
        'X-Forwarded-Proto': 'https'
    };
    var tokenRequest = {
        grant_type: 'authorization_code',
        code: code,
        client_id: client_id,
        client_secret: client_secret
    }
    request.post({
        url: tokenUrl,
        headers: headers,
        json: true,
        body: tokenRequest
    }, function (err, res, body) {
        if (err)
            return callback(err);
        //assert.isNotOk(err);
        if (200 !== res.statusCode)
            return callback(new Error('/oauth2/token/code did not return 200: ' + res.statusCode));
        //console.log('getAccessToken(), body:');
        //console.log(body);
        var jsonBody = utils.getJson(body);
        //console.log(jsonBody);
        callback(null, jsonBody.access_token);
    })
}

describe('Using the Authorization Code grant,', function () {
    var badAppId = 'bad_app';
    var appId = 'good_app';

    before(function (done) {
        async.series([
            callback => utils.createApplication(appId, { name: 'Good App', redirectUri: 'https://good.uri' }, devUserId, callback),
            callback => utils.createApplication(badAppId, { name: 'Bad App' }, devUserId, callback)
        ], function (err, results) {
            assert.isNotOk(err, 'creating applications failed.');
            utils.awaitEmptyQueue(adapterQueue, adminUserId, done);
        });
    });

    after(function (done) {
        async.series([
            callback => utils.deleteApplication(appId, devUserId, callback),
            callback => utils.deleteApplication(badAppId, devUserId, callback)
        ], function (err, results) {
            assert.isNotOk(err, 'deleting applications failed.');
            utils.awaitEmptyQueue(adapterQueue, adminUserId, done);
        });
    });

    // This will be updated each time.
    var clientId = null;
    var clientSecret = null;
    var badClientId = null;

    beforeEach(function (done) {
        // Reset before each test
        clientId = null;
        // Add a subscription to play with
        utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function (err, subsInfo) {
            assert.isNotOk(err);
            clientId = subsInfo.clientId;
            clientSecret = subsInfo.clientSecret;
            assert.isOk(clientId);
            utils.addSubscription(appId, devUserId, 'mobile', 'basic', null, function (err, subsInfo) {
                assert.isNotOk(err);
                badClientId = subsInfo.clientId;
                utils.awaitEmptyQueue(adapterQueue, adminUserId, done);
            });
        });
    });

    afterEach(function (done) {
        async.parallel([
            function (callback) {
                if (clientId) {
                    utils.deleteSubscription(appId, devUserId, oauth2Api, function (err) {
                        assert.isNotOk(err);
                        callback(null);
                    });
                } else {
                    callback(null);
                }
            },
            function (callback) {
                if (badClientId) {
                    utils.deleteSubscription(appId, devUserId, 'mobile', function (err) {
                        assert.isNotOk(err);
                        callback(null);
                    });
                } else {
                    callback(null);
                }
            }
        ], function (err) {
            assert.isNotOk(err);
            done();
        });
    });

    it('must be possible to get an authorization code', function (done) {
        getAuthorizationCode('12345', oauth2Api, clientId, function (err, authCode) {
            assert.isNotOk(err, 'getAuthorizationCode failed');
            assert.isOk(authCode, 'no code received');
            done();
        });
    });

    it('must not be possible to get an authorization code for a non-auth-code grant API', function (done) {
        getAuthorizationCode('23456', 'mobile', clientId, function (err, accessToken) {
            assert.isOk(err, 'getting a authorization code must not work');
            done();
        });
    });

    it('must be possible to get an access token via authorization code code', function (done) {
        getAuthorizationCode('12345', oauth2Api, clientId, function (err, authCode) {
            assert.isNotOk(err);
            assert.isOk(authCode, 'no code received');
            getAccessToken(authCode, clientId, clientSecret, oauth2Api, function (err, accessToken) {
                assert.isNotOk(err, 'getAccessToken returned an error');
                assert.isOk(accessToken, 'did not receive an access token');
                done();
            })
        });
    });
});
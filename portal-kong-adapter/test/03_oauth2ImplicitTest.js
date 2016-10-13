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

var oauth2Api = 'mobile';

var adapterQueue = 'kong-adapter';

var __server = null;
var __reqHandler = null;

function hookServer(serverListening) {
    if (__server)
        throw new Error('server is already hooked, release it first!');
    __server = http.createServer(function (req, res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Sample response' }));

        if (__reqHandler) {
            __reqHandler(req);
        }
    });
    __server.listen(INTERNAL_API_PORT, serverListening);
}

function useReqHandler(reqHandler) {
    __reqHandler = reqHandler;
}

function closeServer(callback) {
    if (__server) {
        __server.close(function () {
            __server = null;
            callback();
        });
    } else {
        callback(new Error('No server currently listening.'));
    }
}

function getAccessToken(email, custom_id, api_id, client_id, scope, callback) {
    if (typeof (scope) === 'function' && !callback)
        callback = scope;
    var registerUrl = adapterUrl + 'oauth2/register';
    var headers = {
        'X-Internal-Id': 'ABCDEF',
        'X-More-Headers': '123456'
    };
    var reqBody = {
        email: email,
        custom_id: custom_id,
        api_id: api_id,
        client_id: client_id,
        headers: headers,
    };
    if (scope)
        reqBody.scope = scope;
    //console.log(registerUrl);
    request.post({
        url: registerUrl,
        json: true,
        body: reqBody
    }, function (err, res, body) {
        // We expect something like this back:
        // https://good.uri#access_token=239239827389729837298372983&expires_in=3600&token_type=bearer
        if (err)
            return callback(err);
        //assert.isNotOk(err);
        if (200 !== res.statusCode)
            return callback(new Error('/oauth2/register did not return 200: ' + res.statusCode));
        //assert.equal(200, res.statusCode);
        var jsonBody = utils.getJson(body);
        //console.log('getAccessToken(), jsonBody:');
        //console.log(jsonBody);
        if (!jsonBody.redirect_uri)
            return callback(new Error('/oauth2/register did not return a redirect_uri'));
        try {
            var redirectUriString = jsonBody.redirect_uri;
            var redirectUri = URL.parse(redirectUriString);
            //assert.isOk(redirectUri.hash, 'redirect_uri must have a hash (fragment)');
            //assert.isOk(redirectUri.hash.startsWith('#'), 'redirect_uri has must start with #');
            var fragmentString = redirectUri.hash.substring(1); // Strip #
            var queryParams = qs.parse(fragmentString);
            //assert.isOk(queryParams.access_token, 'access_token must be present');
            //assert.isOk(queryParams.expires_in, 'expires_in must be present');
            //assert.isOk(queryParams.token_type, 'token_type must be present');
            //assert.equal('bearer', queryParams.token_type, 'token_type must be equal "bearer"');
            callback(null, queryParams.access_token);
        } catch (ex) {
            return callback(ex);
        }
    });
}

describe('With oauth2-implicit APIs,', function () {

    var provisionKey = null;

    var badAppId = 'bad_app';
    var appId = 'good_app';

    before(function (done) {
        async.series([
            callback => utils.createApplication(appId, { name: 'Good App', redirectUri: 'https://good.uri' }, devUserId, callback),
            callback => utils.createApplication(badAppId, { name: 'Bad App' }, devUserId, callback)
        ], function (err, results) {
            assert.isNotOk(err, 'creating applications failed.');
            done();
        });
    });

    after(function (done) {
        async.series([
            callback => utils.deleteApplication(appId, devUserId, callback),
            callback => utils.deleteApplication(badAppId, devUserId, callback)
        ], function (err, results) {
            assert.isNotOk(err, 'deleting applications failed.');
            done();
        });
    });

    it('the API must have an oauth2 plugin and a provision_key', function (done) {
        async.series({
            kongApi: callback => utils.kongGet('apis/' + oauth2Api, callback),
            kongPlugins: callback => utils.kongGet('apis/' + oauth2Api + '/plugins', callback)
        }, function (err, results) {
            assert.isNotOk(err, 'some action went wrong: ' + err);
            var plugins = results.kongPlugins.body;
            //console.log(JSON.stringify(plugins, null, 2));
            assert.equal(2, plugins.total, 'api needs two plugins (oauth2 and correlation-id)');
            var oauthPlugin = utils.findWithName(plugins.data, 'oauth2');
            assert.isOk(oauthPlugin, 'oauth2 plugin must be present');
            provisionKey = oauthPlugin.config.provision_key;
            //console.log(oauthPlugin);
            assert.isOk(provisionKey, 'must get a provision_key back');
            done();
        });
    });

    describe('with an application with redirect URI,', function (done) {

        // This will be updated each time.
        var clientId = null;

        beforeEach(function (done) {
            // Reset before each test
            clientId = null;
            // If we don't have this, we needn't start.
            assert.isOk(provisionKey);
            // Add a subscription to play with
            utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function (err, subsInfo) {
                assert.isNotOk(err);
                clientId = subsInfo.clientId;
                assert.isOk(clientId);
                done();
            });
        });

        afterEach(function (done) {
            if (clientId) {
                utils.deleteSubscription(appId, devUserId, oauth2Api, done);
            } else {
                done();
            }
        });

        it('should be possible to get an access token', function (done) {
            var registerUrl = adapterUrl + 'oauth2/register';
            //console.log(registerUrl);
            request.post({
                url: registerUrl,
                json: true,
                body: {
                    email: 'test@test.com',
                    custom_id: '12345',
                    api_id: oauth2Api,
                    client_id: clientId
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body);
                //console.log(jsonBody);
                assert.isOk(jsonBody.redirect_uri);
                done();
            });
        });

        it('should not be possible to get an access token without subscription', function (done) {
            var registerUrl = adapterUrl + 'oauth2/register';
            //console.log(registerUrl);
            request.post({
                url: registerUrl,
                json: true,
                body: {
                    email: 'test@test.com',
                    custom_id: '12345',
                    api_id: oauth2Api,
                    client_id: 'invalidclientid'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                //console.log(res);
                //console.log(body);
                assert.equal(404, res.statusCode);
                done();
            });
        });

        it('should be possible to get an access token twice with the same user', function (done) {
            getAccessToken('test@test.com', '12345', oauth2Api, clientId, function (err, accessToken) {
                assert.isNotOk(err, 'getAccessToken returned an error: ' + err);
                assert.isOk(accessToken);
                getAccessToken('test@test.com', '12345', oauth2Api, clientId, function (err, accessToken) {
                    assert.isNotOk(err, 'getAccessToken returned an error: ' + err);
                    assert.isOk(accessToken);
                    done();
                });
            });
        });

        //it('should not be possible to get an access token for a client credentials API');
    });

    describe('with a bad application (without redirect URI)', function () {
        it('should not be possible to add a subscription', function (done) {
            request.post({
                url: apiUrl + 'applications/' + badAppId + '/subscriptions',
                headers: { 'X-UserId': devUserId },
                json: true,
                body: {
                    application: badAppId,
                    api: oauth2Api,
                    plan: 'basic',
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(400, res.statusCode);
                var jsonBody = utils.getJson(body);
                assert.equal(jsonBody.message, 'Application does not have a redirectUri');
                done();
            });
        });
    });

    describe('when accessing the API,', function () {
        // We implement our own API backend here.
        before(function (done) {
            hookServer(done);
        });

        after(function (done) {
            closeServer(done);
        });

        // This will be updated each time.
        var clientId = null;

        beforeEach(function (done) {
            // Reset before each test
            clientId = null;
            // If we don't have this, we needn't start.
            assert.isOk(provisionKey);
            // Add a subscription to play with
            utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function (err, subsInfo) {
                assert.isNotOk(err);
                clientId = subsInfo.clientId;
                assert.isOk(clientId);
                done();
            });
        });

        afterEach(function (done) {
            // Remove reqHandler after each test
            __reqHandler = null;
            if (clientId) {
                utils.deleteSubscription(appId, devUserId, oauth2Api, done);
            } else {
                done();
            }
        });

        it('should be possible to access the internal API', function (done) {
            request.get({
                url: internalApiUrl
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.message);
                done();
            });
        });

        it('should not be possible to access the API without an access token', function (done) {
            request.get({
                url: gatewayUrl + 'mobile/'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(401, res.statusCode, 'Kong must reject calls without token');
                done();
            });
        });

        it('it should be possible to access the API with an access token', function (done) {
            getAccessToken('test5@test.com', '123456', oauth2Api, clientId, function (err, accessToken) {
                assert.isNotOk(err, 'getAccessToken returned an error: ' + err);
                assert.isOk(accessToken);
                request.get({
                    url: gatewayUrl + 'mobile/',
                    headers: { 'Authorization': 'Bearer ' + accessToken }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    done();
                });
            });
        });

        it('Kong should pass in its standard OAuth2 headers', function (done) {
            getAccessToken('test2@test.com', '12346', oauth2Api, clientId, function (err, accessToken) {
                assert.isNotOk(err, 'getAccessToken returned an error: ' + err);
                //console.log('Access Token: ' + accessToken);
                // This is called from the embedded server, before the call returns
                var headers = null;
                useReqHandler(function (req) {
                    //console.log(req.headers);
                    headers = req.headers;
                });
                request.get({
                    url: gatewayUrl + 'mobile/',
                    headers: { 'Authorization': 'Bearer ' + accessToken }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    assert.isOk(headers, 'headers must have been collected');
                    assert.isOk(headers['x-consumer-custom-id'], 'x-consumer-custom-id must be present');
                    assert.equal('12346', headers['x-consumer-custom-id'], 'x-consumer-custom-id must match');
                    assert.isOk(headers['x-consumer-username'], 'x-consumer-username must be present');
                    assert.equal('test2@test.com$mobile', headers['x-consumer-username'], 'x-consumer-username must match');
                    assert.isOk(headers['x-authenticated-userid']);
                    assert.equal('12346', headers['x-authenticated-userid'], 'x-authenticated-userid must match');
                    assert.isOk(headers['correlation-id'], 'must have a correlation id');
                    done();
                });
            });
        });

        it('Kong should return the desired additional headers', function (done) {
            getAccessToken('test3@test.com', '12347', oauth2Api, clientId, function (err, accessToken) {
                assert.isNotOk(err, 'getAccessToken returned an error: ' + err);
                //console.log('Access Token: ' + accessToken);
                // This is called from the embedded server, before the call returns
                var headers = null;
                useReqHandler(function (req) {
                    headers = req.headers;
                });
                request.get({
                    url: gatewayUrl + 'mobile/',
                    headers: { 'Authorization': 'Bearer ' + accessToken }
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    // 'X-Internal-Id': 'ABCDEF',
                    // 'X-More-Headers': '123456'
                    assert.isOk(headers, 'headers must have been collected');
                    assert.isOk(headers['x-internal-id'], 'x-internal-id must be present');
                    assert.equal(headers['x-internal-id'], 'ABCDEF', 'x-internal-id must match input');
                    assert.isOk(headers['x-more-headers'], 'x-more-headers must be present');
                    assert.equal(headers['x-more-headers'], '123456', 'x-more-headers must match input');
                    done();
                });
            });
        });

        it('Kong should have been configured with correct plugins for consumer', function (done) {
            getAccessToken('test4@test.com', '12348', oauth2Api, clientId, function (err, accessToken) {
                assert.isNotOk(err, 'getAccessToken returned an error: ' + err);
                assert.isOk(accessToken);
                // 1. get consumer id from kong for custom_id
                // 2. get plugins for this consumer and API
                // 3. check that they are correct (see also plans.json, this is what goes in there)
                async.waterfall([
                    function (callback) {
                        request.get({
                            url: kongUrl + 'consumers?custom_id=12348'
                        }, function (err, res, body) {
                            assert.isNotOk(err);
                            assert.equal(200, res.statusCode);
                            var consumers = utils.getJson(body);
                            assert.equal(1, consumers.total);
                            var consumerId = consumers.data[0].id;
                            return callback(null, consumerId);
                        });
                    },
                    function (consumerId, callback) {
                        request.get({
                            url: kongUrl + 'apis/' + oauth2Api + '/plugins?consumer_id=' + consumerId
                        }, function (err, res, body) {
                            assert.isNotOk(err, 'getting consumer API plugins failed');
                            assert.equal(200, res.statusCode, 'status code was not 200');
                            var plugins = utils.getJson(body);
                            assert.isOk(plugins.data, 'plugin data was returned');
                            //assert.equal(2, plugins.total, 'plugin count for consumer has to be 2 (rate-limiting and request-transformer)');
                            return callback(null, plugins.data);
                        });
                    }
                ], function (err, consumerPlugins) {
                    assert.isNotOk(err); // This is somewhat superfluous
                    // This was defined in plans.json for basic plan, which is what the clientId
                    // subscription is for.    
                    var rateLimit = utils.findWithName(consumerPlugins, 'rate-limiting');
                    assert.isOk(rateLimit, 'rate-limiting plugin was not found');
                    var reqTransformer = utils.findWithName(consumerPlugins, 'request-transformer');
                    assert.isOk(reqTransformer, 'request-transformer plugin was not found');
                    done();
                });
            });
        });
    });

    describe('when dealing with scopes,', function () {
        // This will be updated each time.
        var mobileClientId = null;
        var partnerClientId = null;

        beforeEach(function (done) {
            // Reset before each test
            mobileClientId = null;
            partnerClientId = null;

            async.parallel({
                mobile: callback => utils.addSubscription(appId, devUserId, 'mobile', 'basic', null, function (err, subsInfo) {
                    assert.isNotOk(err);
                    var clientId = subsInfo.clientId;
                    assert.isOk(clientId);
                    callback(null, clientId);
                }),
                partner: callback => utils.addSubscription(appId, devUserId, 'partner', 'basic', null, function (err, subsInfo) {
                    assert.isNotOk(err);
                    var clientId = subsInfo.clientId;
                    assert.isOk(clientId);
                    callback(null, clientId);
                })
            }, function (err, results) {
                assert.isNotOk(err);
                mobileClientId = results.mobile;
                partnerClientId = results.partner;
                assert.isOk(mobileClientId);
                assert.isOk(partnerClientId);
                done();
            });
        });

        afterEach(function (done) {
            async.parallel([
                function (callback) {
                    if (mobileClientId) {
                        utils.deleteSubscription(appId, devUserId, 'mobile', callback);
                    } else {
                        callback(null);
                    }
                },
                function (callback) {
                    if (partnerClientId) {
                        utils.deleteSubscription(appId, devUserId, 'partner', callback);
                    } else {
                        callback(null);
                    }
                }
            ], function (err, results) {
                assert.isNotOk(err);
                done();
            });
        });

        it('should be impossible to get a token without a scope (if defined so)', function (done) {
            getAccessToken('woo@woo.fake', '23456', 'partner', partnerClientId, null, function (err, accessToken) {
                assert.isOk(err, 'things did not go wrong getting an access token, wtf?');
                assert.isNotOk(accessToken, 'there should be no access token here');
                done();
            });
        });

        it('should be possible to get a token with a sub scope', function (done) {
            getAccessToken('wii@woo.fake', '34567', 'partner', partnerClientId, ['some_scope'], function (err, accessToken) {
                assert.isNotOk(err, 'an access token could not be retrieved');
                assert.isOk(accessToken, 'an access token could not be retrieved');
                done();
            });
        });

        it('should be possible to get a token without a scope (if defined so)', function (done) {
            getAccessToken('wee@woo.fake', '45678', 'mobile', mobileClientId, null, function (err, accessToken) {
                assert.isNotOk(err, 'an access token could not be retrieved');
                assert.isOk(accessToken, 'an access token could not be retrieved');
                done();
            });
        });

        it('should be possible to get a token with full scope as a string', function (done) {
            getAccessToken('wuu@woo.fake', '56789', 'partner', partnerClientId, 'some_scope other_scope', function (err, accessToken) {
                assert.isNotOk(err, 'an access token could not be retrieved');
                assert.isOk(accessToken, 'an access token could not be retrieved');
                done();
            });
        });
    });
});
var assert = require('chai').assert;
var request = require('request');
var utils = require('./testUtils');
var consts = require('./testConsts');

var adapterUrl = consts.KONG_ADAPTER_URL;
var kongUrl = consts.KONG_ADMIN_URL;
var apiUrl = consts.BASE_URL;

var adminUserId = '1'; // See test-config/globals.json
var adminEmail = 'foo@bar.com';
var devUserId = '11'; // Fred Flintstone
var devEmail = 'fred@flintstone.com';

function adminHeaders() {
    return { 'X-UserId': adminUserId };
}

describe('After initialization,', function () {
    describe('portal-api', function () {
        it('should return an empty queue for kong-adapter', function (done) {
            request.get({
                url: apiUrl + 'webhooks/events/kong-adapter',
                headers: adminHeaders()
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body); // Has to be array
                assert.equal(0, jsonBody.length);
                done();
            });
        });
    });

    describe('kong', function () {
        it('should have several API end points', function (done) {
            request.get({
                url: kongUrl + 'apis'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.total > 0);
                done();
            });
        });

        it('should have an API called brilliant', function (done) {
            request.get({
                url: kongUrl + 'apis/brilliant'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should have an API called sample-server (the auth server)', function (done) {
            request.get({
                url: kongUrl + 'apis/sample-server'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should have three plugins for the brilliant API', function (done) {
            request.get({
                url: kongUrl + 'apis/brilliant/plugins'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var plugins = utils.getJson(body);
                assert.equal(3, plugins.total);
                done();
            });
        });

        it('should have a correct configuration of the brilliant plugins (rate-limiting, acl and key-auth)', function (done) {
            request.get({
                url: kongUrl + 'apis/brilliant/plugins'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var plugins = utils.getJson(body);
                var rateLimiting = utils.findWithName(plugins.data, 'rate-limiting');
                assert.isOk(rateLimiting, 'rate-limiting is present');
                assert.isOk(rateLimiting.config.fault_tolerant, 'fault_tolerant is set'); // This is actually also a test of the update of the static config, see oct2016_updatePlugin
                var acl = utils.findWithName(plugins.data, 'acl');
                assert.isOk(acl, 'acl plugin is present');
                var keyAuth = utils.findWithName(plugins.data, 'key-auth');
                assert.isOk(keyAuth, 'key-auth is present');
                done();
            });
        });

        it('should have a correct oauth2 setting for the superduper API', function (done) {
            request.get({
                url: kongUrl + 'apis/superduper/plugins'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode, 'could not retrieve plugins');
                var plugins = utils.getJson(body);
                var oauth2 = utils.findWithName(plugins.data, 'oauth2');
                assert.isOk(oauth2, 'superduper did not have valid oauth2 plugin');
                assert.equal(1800, oauth2.config.token_expiration, 'token_expiration not set to 1800 (see config)');
                done();
            });
        });

        it('should have a correct oauth2 setting for the mobile API', function (done) {
            request.get({
                url: kongUrl + 'apis/mobile/plugins'
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode, 'could not retrieve plugins');
                var plugins = utils.getJson(body);
                var oauth2 = utils.findWithName(plugins.data, 'oauth2');
                assert.isOk(oauth2, 'mobile did not have valid oauth2 plugin');
                assert.equal(3600, oauth2.config.token_expiration, 'token_expiration not set to 1800 (see config)');
                assert.isOk(oauth2.config.scopes, 'api does not have specified scopes');
                assert.equal(5002, oauth2.config.scopes.length, 'scope count does not match'); // Yes, we have 5002 scopes.
                assert.equal(false, oauth2.config.mandatory_scope, 'mandatory_scope does not match');
                done();
            });
        });

        it('should have a correct oauth2 setting for the partner API', function (done) {
            request.get({
                url: kongUrl + 'apis/partner/plugins'
            }, function (err, res, body) {
                assert.isNotOk(err, 'something went wrong when querying kong');
                assert.equal(200, res.statusCode, 'could not retrieve plugins');
                var plugins = utils.getJson(body);
                var oauth2 = utils.findWithName(plugins.data, 'oauth2');
                assert.isOk(oauth2, 'partner did not have valid oauth2 plugin');
                assert.isOk(oauth2.config.scopes, 'api does not have specified scopes');
                assert.equal(2, oauth2.config.scopes.length, 'scope count does not match');
                assert.equal(true, oauth2.config.mandatory_scope, 'mandatory_scope setting not correct');
                done();
            });
        });

        describe('consumers', function () {
            it('should have been inserted (four)', function (done) { // see globals.json
                request.get({
                    url: kongUrl + 'consumers'
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    var consumers = utils.getJson(body);
                    assert.equal(4, consumers.total);
                    done();
                });
            });

            it('should have an oauth2 plugin configured for the portal-api', function (done) {
                request.get({
                    url: kongUrl + 'consumers/' + adminEmail + '/oauth2'
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    var consumerOAuth2 = utils.getJson(body);
                    assert.equal(1, consumerOAuth2.total);
                    assert.isOk(consumerOAuth2.data[0].client_id);
                    assert.isOk(consumerOAuth2.data[0].client_secret);
                    done();
                });
            });

            it('should have an entry to the ACL of the portal-api', function (done) {
                request.get({
                    url: kongUrl + 'consumers/' + adminEmail + '/acls'
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    var acls = utils.getJson(body);
                    assert.isOk(acls.data);
                    assert.equal(1, acls.total, 'consumer has exactly one ACL entry');
                    var portalGroup = acls.data.find(g => g.group === 'portal-api-internal');
                    assert.isOk(portalGroup, 'consumer needs ACL group portal-api-internal');
                    done();
                });
            });
        });
    });
});

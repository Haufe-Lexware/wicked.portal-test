'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow */

var assert = require('chai').assert;
var request = require('request');
var utils = require('./testUtils');
var consts = require('./testConsts');

var baseUrl = consts.BASE_URL;

const READ_AUTH_SERVERS_SCOPE = 'read_auth_servers';
const INVALID_SCOPE = 'invalid_auth_servers';

describe('/auth-server', function () {
    it('should return a 403 if using wrong scope', function (done) {
        request.get({
            url: baseUrl + 'auth-servers',
            headers: utils.onlyScope(INVALID_SCOPE)
        }, function (err, res, body) {
            assert.isNotOk(err);
            utils.assertScopeReject(res, body);
            done();
        });
    });

    it('should return a list of auth servers', function (done) {
        request.get({
            url: baseUrl + 'auth-servers',
            headers: utils.onlyScope(READ_AUTH_SERVERS_SCOPE)
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 200);
            var jsonBody = utils.getJson(body);
            assert.isArray(jsonBody, 'Expected an array of names');
            assert.equal(2, jsonBody.length, 'Expeted 2 auth server configs');
            done();
        });
    });

    describe('/<auth-server-id>', function () {
        it ('should return 403 if using wrong scope', function (done) {
            request.get({
                url: baseUrl + 'auth-servers/sample-server',
                headers: utils.onlyScope(INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should be possible to retrieve a known auth-server', function (done) {
            request.get({
                url: baseUrl + 'auth-servers/sample-server',
                headers: utils.onlyScope(READ_AUTH_SERVERS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                var jsonBody = utils.getJson(body);
                assert.equal(jsonBody.name, 'sample-server');
                done();
            });
        });

        it('should only return very few properties when retrieving as non-admin', function (done) {
            request.get({
                url: baseUrl + 'auth-servers/sample-server',
                headers: utils.onlyScope(READ_AUTH_SERVERS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                var jsonBody = utils.getJson(body);
                assert.equal(jsonBody.name, 'sample-server');
                assert.isOk(jsonBody.authMethods, 'Missing property authMethods');
                assert.isOk(jsonBody.config, 'Missing config property');
                assert.isOk(jsonBody.config.api, 'Missing config.api property');
                assert.isOk(jsonBody.config.api.uris, 'Missing config.api.uris property');
                assert.isNotOk(jsonBody.config.api.upstream_url, 'Property upstream_url is returned, must not be');
                assert.isNotOk(jsonBody.config.plugins, 'Property plugins is returned, must not be');
                done();
            });
        });

        it('should return all properties when retrieving as admin', function (done) {
            request.get({
                url: baseUrl + 'auth-servers/sample-server',
                headers: utils.makeHeaders('1', READ_AUTH_SERVERS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                var jsonBody = utils.getJson(body);
                assert.equal(jsonBody.name, 'sample-server');
                assert.isOk(jsonBody.authMethods, 'Missing property authMethods');
                assert.isOk(jsonBody.config, 'Missing config property');
                assert.isOk(jsonBody.config.api, 'Missing config.api property');
                assert.isOk(jsonBody.config.api.uris, 'Missing config.api.uris property');
                assert.isOk(jsonBody.config.plugins, 'Property plugins is not returned');
                assert.isOk(jsonBody.config.api.upstream_url, 'Property upstream_url is not returned');
                done();
            });
        });
        
        it('should return a 404 if the auth-server could not be found', function (done) {
            request.get({
                url: baseUrl + 'auth-servers/bad-server',
                headers: utils.onlyScope(READ_AUTH_SERVERS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 404);
                done();
            });
        });
    });
});

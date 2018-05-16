'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow */

var assert = require('chai').assert;
var request = require('request');
var utils = require('./testUtils');
var consts = require('./testConsts');

var baseUrl = consts.BASE_URL;

const READ_GROUPS_SCOPE = 'read_groups';

describe('/groups', function () {
    describe('GET', function () {
        it('should return all groups', function (done) {
            request({
                url: baseUrl + 'groups',
                headers: utils.onlyScope(READ_GROUPS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.groups);
                assert.equal(4, jsonBody.groups.length);
                done();
            });
        });

        it('should not care about logged in users', function (done) {
            request({
                url: baseUrl + 'groups',
                headers: utils.makeHeaders('somethinginvalid', READ_GROUPS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return valid _links', function (done) {
            request({
                url: baseUrl + 'groups',
                headers: utils.onlyScope(READ_GROUPS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body);
                assert.isOk(jsonBody._links);
                assert.isOk(jsonBody._links.self);
                assert.equal(jsonBody._links.self.href, '/groups');
                done();
            });
        });
    });
});
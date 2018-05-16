'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow */

var assert = require('chai').assert;
var request = require('request');
var utils = require('./testUtils');
var consts = require('./testConsts');

var baseUrl = consts.BASE_URL;

const READ_PLANS_SCOPE = 'read_plans';
const INVALID_SCOPE = 'invalid_plans';

describe('/plans', function () {
    describe('GET', function () {
        it('should return 403 using wrong scope', function (done) {
            request({
                url: baseUrl + 'plans',
                headers: utils.onlyScope(INVALID_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                utils.assertScopeReject(res, body);
                done();
            });
        });

        it('should return all plans', function (done) {
            request({
                url: baseUrl + 'plans',
                headers: utils.onlyScope(READ_PLANS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.plans);
                assert.equal(8, jsonBody.plans.length);
                done();
            });
        });

        it('should return also the internal health Plan', function (done) {
            request({
                url: baseUrl + 'plans',
                headers: utils.onlyScope(READ_PLANS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.plans);
                var foundHealthPlan = false;
                for (var i = 0; i < jsonBody.plans.length; ++i) {
                    if ("__internal_health" == jsonBody.plans[i].id)
                        foundHealthPlan = true;
                }
                assert.isOk(foundHealthPlan);
                done();
            });
        });

        it('should not care about logged in users', function (done) {
            request({
                url: baseUrl + 'plans',
                headers: utils.makeHeaders('somethinginvalid', READ_PLANS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                done();
            });
        });

        it('should return valid _links', function (done) {
            request({
                url: baseUrl + 'plans',
                headers: utils.onlyScope(READ_PLANS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body);
                assert.isOk(jsonBody._links);
                assert.isOk(jsonBody._links.self);
                assert.equal(jsonBody._links.self.href, '/plans');
                done();
            });
        });
    });
});
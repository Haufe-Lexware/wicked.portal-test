'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow */

var assert = require('chai').assert;
var request = require('request');
var utils = require('./testUtils');
var consts = require('./testConsts');

var baseUrl = consts.BASE_URL;

const READ_SUBS_SCOPE = 'read_subscriptions';
const WRITE_SUBS_SCOPE = 'write_subscriptions';

const READ_APPS_SCOPE = 'read_applications';
const WRITE_APPS_SCOPE = 'write_applications';

const INVALID_SCOPE = 'invalid_applications';
const READ_USERS_SCOPE = 'read_users';

describe('operations on OAuth2 APIs', function () {

    let devUserId, adminUserId, noobUserId;

    // Let's create some users to play with
    before(function (done) {
        utils.createUser('Dev', 'dev', true, function (id) {
            devUserId = id;
            utils.createUser('Admin', 'admin', true, function (id) {
                adminUserId = id;
                utils.createUser('Noob', null, true, function (id) {
                    noobUserId = id;
                    done();
                });
            });
        });
    });

    // And delete them afterwards    
    after(function (done) {
        utils.deleteUser(noobUserId, function () {
            utils.deleteUser(adminUserId, function () {
                utils.deleteUser(devUserId, function () {
                    done();
                });
            });
        });
    });

    var appId = 'myoauth2app';
    var appName = 'My OAuth2 Application';
    var redirectUri = 'https://my.app.com/callback';
    var badAppId = 'badapp';
    var badAppName = 'My Bad App without redirectUri';

    // Let's create two standard applications to play with for each test case
    beforeEach(function (done) {
        utils.createApplication(appId, { name: appName, redirectUri: redirectUri }, devUserId, function () {
            utils.createApplication(badAppId, { name: badAppName }, devUserId, function () {
                done();
            });
        });
    });

    afterEach(function (done) {
        utils.deleteApplication(appId, devUserId, function () {
            utils.deleteApplication(badAppId, devUserId, function () {
                done();
            });
        });
    });

    var oauth2Api = 'mobile'; // this is oauth2 with implicit grant

    var subscriptionClientId = null;

    describe('Adding subscriptions', function () {
        it('an application must return its redirectUri', function (done) {
            request.get({
                url: baseUrl + 'applications/' + appId,
                headers: utils.makeHeaders(devUserId, READ_APPS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 200);
                var jsonBody = utils.getJson(body);
                assert.equal(jsonBody.redirectUri, redirectUri);
                done();
            });
        });

        it('should not be possible to add a subscription for an app with the wrong scope', function (done) {
            request.post({
                url: baseUrl + 'applications/' + appId + '/subscriptions',
                json: true,
                headers: utils.makeHeaders(devUserId, INVALID_SCOPE),
                body: {
                    api: oauth2Api,
                    application: appId,
                    plan: 'basic'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 403);
                done();
            });
        });
        
        it('must be possible to add a subscription for an app with redirectUri', function (done) {
            request.post({
                url: baseUrl + 'applications/' + appId + '/subscriptions',
                json: true,
                headers: utils.makeHeaders(devUserId, WRITE_SUBS_SCOPE),
                body: {
                    api: oauth2Api,
                    application: appId,
                    plan: 'basic'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 201);
                var jsonBody = utils.getJson(body);
                assert.isOk(jsonBody.clientId);
                assert.isOk(jsonBody.clientSecret);
                subscriptionClientId = jsonBody.clientId;
                done();
            });
        });

        it('must remove the clientId from the index after deleting an application', function (done) {
            request.get({
                url: baseUrl + 'subscriptions/' + subscriptionClientId,
                headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 404);
                done();
            });
        });

        it('must be forbidden to add a subscription to an oauth2 implicit grant API for an app without redirectUri', function (done) {
            request.post({
                url: baseUrl + 'applications/' + badAppId + '/subscriptions',
                headers: utils.makeHeaders(devUserId, WRITE_SUBS_SCOPE),
                json: true,
                body: {
                    application: badAppId,
                    api: oauth2Api,
                    plan: 'basic'
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

    describe('Patching applications', function () {
        it('must be possible to change the redirectUri of an app', function (done) {
            request.patch({
                url: baseUrl + 'applications/' + appId,
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: appId,
                    redirectUri: 'https://other.uri'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body);
                assert.equal(jsonBody.redirectUri, 'https://other.uri');
                done();
            });
        });

        it('must be possible to add a redirectUri to an app', function (done) {
            request.patch({
                url: baseUrl + 'applications/' + badAppId,
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: badAppId,
                    redirectUri: 'https://some.uri'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(200, res.statusCode);
                var jsonBody = utils.getJson(body);
                assert.equal(jsonBody.redirectUri, 'https://some.uri');
                done();
            });
        });

        it('must be forbidden to create an app with a http:// redirectUri', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'someid',
                    name: 'Some Name',
                    redirectUri: 'http://insecure.uri'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 400);
                var jsonBody = utils.getJson(body);
                assert.equal(jsonBody.message, 'redirectUri must be a https URI');
                done();
            });
        });

        it('must be forbidden to patch an app to add a http:// redirectUri', function (done) {
            request.patch({
                url: baseUrl + 'applications/' + badAppId,
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: badAppId,
                    redirectUri: 'http://insecure.uri'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 400);
                var jsonBody = utils.getJson(body);
                assert.equal(jsonBody.message, 'redirectUri must be a https URI');
                done();
            });
        });

        it('should still be possible to use http://localhost as redirect URI for testing purposes', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'someid',
                    name: 'Some Name',
                    redirectUri: 'http://localhost:40000/callback'
                }
            }, function (err, res, body) {
                utils.deleteApplication('someid', devUserId, function () {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 201);
                    done();
                });
            });
        });

        it('must be forbidden to create an app with only https:// as redirectUri', function (done) {
            request.post({
                url: baseUrl + 'applications',
                headers: utils.makeHeaders(devUserId, WRITE_APPS_SCOPE),
                json: true,
                body: {
                    id: 'someid',
                    name: 'Some Name',
                    redirectUri: 'https://'
                }
            }, function (err, res, body) {
                assert.isNotOk(err);
                assert.equal(res.statusCode, 400);
                var jsonBody = utils.getJson(body);
                assert.equal(jsonBody.message, 'redirectUri must be a https URI');
                done();
            });
        });
    });

    describe('Getting subscriptions by clientId', function () {
        it('must be possible to retrieve the application and subscription by clientId', function (done) {
            // First add subscription
            utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function (err, subsInfo) {
                assert.isNotOk(err);
                assert.isOk(subsInfo.clientId);
                request.get({
                    url: baseUrl + 'subscriptions/' + subsInfo.clientId,
                    headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 200);
                    var jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.subscription);
                    assert.equal(jsonBody.subscription.api, oauth2Api);
                    assert.equal(jsonBody.subscription.application, appId);
                    assert.equal(jsonBody.subscription.auth, 'oauth2');
                    assert.isOk(jsonBody.application);
                    assert.equal(jsonBody.application.id, appId);
                    done();
                });
            });
        });

        it('should remove the subscription from the index after removing a subscription', function (done) {
            utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function (err, subsInfo) {
                assert.isNotOk(err);
                assert.isOk(subsInfo);
                assert.isOk(subsInfo.clientId);
                var clientId = subsInfo.clientId;
                utils.deleteSubscription(appId, devUserId, oauth2Api, function () {
                    request.get({
                        url: baseUrl + 'subscriptions/' + clientId,
                        headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(res.statusCode, 404);
                        done();
                    });
                });
            });
        });

        it('should not be possible to retrieve an application by clientId as a normal user', function (done) {
            utils.addSubscription(appId, devUserId, oauth2Api, 'basic', null, function (err, subsInfo) {
                assert.isNotOk(err);
                assert.isOk(subsInfo.clientId);
                //console.log('clientId: ' + subsInfo.clientId);
                request.get({
                    url: baseUrl + 'subscriptions/' + subsInfo.clientId,
                    headers: utils.makeHeaders(devUserId, READ_SUBS_SCOPE)
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(res.statusCode, 403);
                    done();
                });
            });
        });

        it('should not return a clientId if plan needs approval', function (done) {
            utils.addSubscription(appId, devUserId, oauth2Api, 'unlimited', null, function (err, subsInfo) {
                assert.isNotOk(err);
                assert.isNotOk(subsInfo.clientId);
                done();
            });
        });

        it('should return a clientId after approval', function (done) {
            utils.addSubscription(appId, devUserId, oauth2Api, 'unlimited', null, function (err, subsInfo) {
                assert.isNotOk(err);
                utils.approveSubscription(appId, oauth2Api, adminUserId, function () {
                    request.get({
                        url: baseUrl + 'applications/' + appId + '/subscriptions/' + oauth2Api,
                        headers: utils.makeHeaders(devUserId, READ_SUBS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(res.statusCode, 200);
                        var jsonBody = utils.getJson(body);
                        assert.isOk(jsonBody.clientId);
                        assert.isOk(jsonBody.clientSecret);
                        done();
                    });
                });
            });
        });

        it('should return a clientId after approval, and this clientId can be used to retrieve the application', function (done) {
            utils.addSubscription(appId, devUserId, oauth2Api, 'unlimited', null, function (err, subsInfo) {
                assert.isNotOk(err);
                utils.approveSubscription(appId, oauth2Api, adminUserId, function () {
                    request.get({
                        url: baseUrl + 'applications/' + appId + '/subscriptions/' + oauth2Api,
                        headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                    }, function (err, res, body) {
                        assert.isNotOk(err);
                        assert.equal(res.statusCode, 200);
                        var jsonBody = utils.getJson(body);
                        assert.isOk(jsonBody.clientId);
                        var clientId = jsonBody.clientId;
                        request.get({
                            url: baseUrl + 'subscriptions/' + clientId,
                            headers: utils.makeHeaders(adminUserId, READ_SUBS_SCOPE)
                        }, function (err, res, body) {
                            assert.isNotOk(err);
                            assert.equal(res.statusCode, 200);
                            var jsonBody = utils.getJson(body);
                            assert.isOk(jsonBody.application);
                            assert.isOk(jsonBody.subscription);
                            assert.equal(jsonBody.application.id, appId);
                            assert.equal(jsonBody.subscription.api, oauth2Api);
                            assert.equal(jsonBody.subscription.application, appId);
                            done();
                        });
                    });
                });
            });
        });
    });
});
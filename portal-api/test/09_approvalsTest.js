var assert = require('chai').assert;
var request = require('request');
var utils = require('./testUtils');
var consts = require('./testConsts');

var baseUrl = consts.BASE_URL;

describe('/approvals', function () {

    var devUserId = '';
    var superDevUserId = '';
    var adminUserId = '';
    var noobUserId = '';
    var approverUserId = '';

    var appId = 'approval-test';
    var superAppId = 'super-approval-test';
    var publicApi = 'superduper';
    var privateApi = 'partner';
    var veryPrivateApi = 'restricted'

    // Let's create some users and an application to play with
    before(function (done) {
        utils.createUser('Dev', 'dev', true, function (id) {
            devUserId = id;
            utils.createUser('SuperDev', 'superdev', true, function (id) {
                superDevUserId = id;
                utils.createUser('Admin', 'admin', true, function (id) {
                    adminUserId = id;
                    utils.createUser('Noob', null, true, function (id) {
                        noobUserId = id;
                        utils.createUser('Approver', ['approver', 'dev'], true, function (id) {
                            approverUserId = id;
                            utils.createApplication(appId, 'My Application', devUserId, function () {
                                utils.createApplication(superAppId, 'My Super Application', superDevUserId, done);
                            });
                        });
                    });
                });
            });
        });
    });

    // And delete them afterwards    
    after(function (done) {
        utils.deleteApplication(appId, devUserId, function () {
            utils.deleteApplication(superAppId, superDevUserId, function () {
                utils.deleteUser(noobUserId, function () {
                    utils.deleteUser(adminUserId, function () {
                        utils.deleteUser(devUserId, function () {
                            utils.deleteUser(superDevUserId, function () {
                                utils.deleteUser(approverUserId, function () {
                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    describe('GET', function () {
        it('should generate an approval request for subscriptions to plans requiring approval', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'unlimited', null, function () {
                request(
                    {
                        url: baseUrl + 'approvals',
                        headers: { 'X-UserId': adminUserId }
                    },
                    function (err, res, body) {
                        utils.deleteSubscription(appId, devUserId, privateApi, function () {
                            assert.isNotOk(err);
                            assert.equal(200, res.statusCode);
                            var jsonBody = utils.getJson(body);
                            assert.equal(1, jsonBody.length);
                            done();
                        });
                    });
            });
        });

        it('should generate an approval request for subscriptions to plans requiring approval, but it mustn\'t be visible to approvers if they do not belong to the right group', function (done) {
            utils.addSubscription(superAppId, superDevUserId, veryPrivateApi, 'restricted_unlimited', null, function () {
                request(
                    {
                        url: baseUrl + 'approvals',
                        headers: { 'X-UserId': approverUserId }
                    },
                    function (err, res, body) {
                        request(
                            {
                                url: baseUrl + 'approvals',
                                headers: { 'X-UserId': adminUserId }
                            },
                            function (adminErr, adminRes, adminBody) {
                                utils.deleteSubscription(superAppId, superDevUserId, veryPrivateApi, function () {
                                    assert.isNotOk(err);
                                    assert.isNotOk(adminErr);
                                    assert.equal(200, res.statusCode);
                                    assert.equal(200, adminRes.statusCode);
                                    var jsonBody = utils.getJson(body);
                                    var adminJsonBody = utils.getJson(adminBody);
                                    assert.equal(0, jsonBody.length);
                                    assert.equal(1, adminJsonBody.length);
                                    done();
                                });
                            }
                        )
                    });
            });
        });

        it('should not generate an approval request for subscriptions to plans not requiring approval', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'basic', null, function () {
                request(
                    {
                        url: baseUrl + 'approvals',
                        headers: { 'X-UserId': adminUserId }
                    },
                    function (err, res, body) {
                        utils.deleteSubscription(appId, devUserId, privateApi, function () {
                            assert.isNotOk(err);
                            assert.equal(200, res.statusCode);
                            var jsonBody = utils.getJson(body);
                            assert.equal(0, jsonBody.length);
                            done();
                        });
                    });
            });
        });

        it('should remove an approval request after approving via patch subscription', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'unlimited', null, function () {
                request.patch(
                    {
                        url: baseUrl + 'applications/' + appId + '/subscriptions/' + privateApi,
                        headers: { 'X-UserId': adminUserId },
                        json: true,
                        body: { approved: true }
                    },
                    function (err, res, body) {
                        request(
                            {
                                url: baseUrl + 'approvals',
                                headers: { 'X-UserId': adminUserId }
                            },
                            function (err, res, body) {
                                utils.deleteSubscription(appId, devUserId, privateApi, function () {
                                    assert.isNotOk(err);
                                    assert.equal(200, res.statusCode);
                                    var jsonBody = utils.getJson(body);
                                    assert.equal(0, jsonBody.length);
                                    done();
                                });
                            });
                    });
            });
        });

        it('should be possible to approve an approval request as non-admin, but having the approval role', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'unlimited', null, function () {
                request.patch(
                    {
                        url: baseUrl + 'applications/' + appId + '/subscriptions/' + privateApi,
                        headers: { 'X-UserId': approverUserId },
                        json: true,
                        body: { approved: true }
                    },
                    function (err, res, body) {
                        request(
                            {
                                url: baseUrl + 'approvals',
                                headers: { 'X-UserId': approverUserId }
                            },
                            function (err, res, body) {
                                utils.deleteSubscription(appId, devUserId, privateApi, function () {
                                    assert.isNotOk(err);
                                    assert.equal(200, res.statusCode);
                                    var jsonBody = utils.getJson(body);
                                    assert.equal(0, jsonBody.length);
                                    done();
                                });
                            });
                    });
            });
        });

        it('should not be possible to approve your own subscription requests', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'unlimited', null, function () {
                request.patch(
                    {
                        url: baseUrl + 'applications/' + appId + '/subscriptions/' + privateApi,
                        headers: { 'X-UserId': devUserId },
                        json: true,
                        body: { approved: true }
                    },
                    function (err, res, body) {
                        utils.deleteSubscription(appId, devUserId, privateApi, function () {
                            assert.isNotOk(err);
                            assert.equal(403, res.statusCode);
                            done();
                        });
                    });
            });
        });

        it('should generate an apikey after approving', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'unlimited', null, function () {
                request.patch(
                    {
                        url: baseUrl + 'applications/' + appId + '/subscriptions/' + privateApi,
                        headers: { 'X-UserId': adminUserId },
                        json: true,
                        body: { approved: true }
                    },
                    function (err, res, body) {
                        request(
                            {
                                url: baseUrl + 'applications/' + appId + '/subscriptions/' + privateApi,
                                headers: { 'X-UserId': devUserId }
                            },
                            function (err, res, body) {
                                utils.deleteSubscription(appId, devUserId, privateApi, function () {
                                    assert.isNotOk(err);
                                    assert.equal(200, res.statusCode);
                                    var jsonBody = utils.getJson(body);
                                    assert.isOk(jsonBody.approved);
                                    assert.isOk(jsonBody.apikey, "After approval, subscription must have an API key");
                                    done();
                                });
                            });
                    });
            });
        });

        it('should remove pending approvals if the subscription is deleted', function (done) {
            utils.addSubscription(appId, devUserId, privateApi, 'unlimited', null, function () {
                utils.deleteSubscription(appId, devUserId, privateApi, function () {
                    request(
                        {
                            url: baseUrl + 'approvals',
                            headers: { 'X-UserId': adminUserId }
                        },
                        function (err, res, body) {
                            assert.isNotOk(err);
                            assert.equal(200, res.statusCode);
                            var jsonBody = utils.getJson(body);
                            assert.equal(0, jsonBody.length);
                            done();
                        });
                });
            });
        });

        it('should remove pending approvals if the application is deleted', function (done) {
            utils.createApplication('second-app', 'Second App', devUserId, function () {
                utils.addSubscription('second-app', devUserId, privateApi, 'unlimited', null, function () {
                    utils.deleteApplication('second-app', devUserId, function () {
                        request(
                            {
                                url: baseUrl + 'approvals',
                                headers: { 'X-UserId': adminUserId }
                            },
                            function (err, res, body) {
                                assert.isNotOk(err);
                                assert.equal(200, res.statusCode);
                                var jsonBody = utils.getJson(body);
                                assert.equal(0, jsonBody.length);
                                done();
                            });
                    });
                });
            });
        });
    });
});
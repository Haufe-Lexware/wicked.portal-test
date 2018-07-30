'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow, URL */

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');
const wicked = require('wicked-sdk');

describe('Authorization Code Grant', function () {

    // let trustedClientId;
    // let trustedClientSecret;
    // let confidentialClientId;
    // let confidentialClientSecret;
    // let publicClientId;
    // let publicClientSecret;

    /*
    ids = {
        users: {
            normal: {
                id: 'kdlaskjdlkajskdasd'
            },
            admin: {
                id: 'dlksjdlksjdlksld'
            }
        },
        trusted: {
            clientId: '...',
            clientSecret: '...'
        },
        confidential: { ... },
        public: { ... }
    }
    */
    let ids;

    before(function (done) {
        this.timeout(5000);
        const now = new Date();
        utils.initAppsAndSubscriptions(function (err, idsAndSecrets) {
            assert.isNotOk(err);
            assert.isOk(idsAndSecrets);
            ids = idsAndSecrets;
            console.log('Before handler took ' + (new Date() - now) + 'ms.');
            done();
        });
    });

    after(function (done) {
        utils.destroyAppsAndSubcriptions(done);
    });

    // Now we have an application to play with
    describe('basic failure cases', function () {
        this.slow(250);

        it('should return a 404 for an invalid URL', function (done) {
            utils.authGet('local/opi/flubbs/authorize', function (err, res, body) {
                assert.equal(res.statusCode, 404);
                utils.assertIsHtml(body);
                done();
            });
        });

        it('should return an HTML error for missing response_type', function (done) {
            utils.authGet('local/api/echo/authorize', function (err, res, body) {
                assert.equal(res.statusCode, 400);
                utils.assertIsHtml(body);
                assert.isTrue(body.message.indexOf('Invalid response_type') >= 0);
                done();
            });
        });

        it('should return an HTML error for invalid response_type', function (done) {
            utils.authGet('local/api/echo/authorize?response_type=hoops', function (err, res, body) {
                assert.equal(res.statusCode, 400);
                utils.assertIsHtml(body);
                assert.isTrue(body.message.indexOf('Invalid response_type') >= 0);
                done();
            });
        });

        it('should return an HTML error for an invalid client_id', function (done) {
            utils.authGet('local/api/echo/authorize?response_type=code&client_id=invalid', function (err, res, body) {
                assert.equal(res.statusCode, 400);
                utils.assertIsHtml(body);
                // console.log(body);
                assert.isTrue(body.message.indexOf('Invalid') >= 0);
                done();
            });
        });

        it('should return an HTML error for a missing redirect_uri', function (done) {
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.clientId}`, function (err, res, body) {
                assert.equal(res.statusCode, 400);
                utils.assertIsHtml(body);
                // console.log(body);
                assert.isTrue(body.message.indexOf('Invalid') >= 0);
                done();
            });
        });
    });

    describe('basic success cases', function () {
        this.slow(2000);
        this.timeout(10000);

        it('should return a login screen for a valid authorize request', function (done) {
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.clientId}&redirect_uri=${consts.REDIRECT_URI}`, function (err, res, body) {
                assert.equal(res.statusCode, 200);
                utils.assertIsHtml(body);
                assert.equal('login', body.template);
                // console.log(body);
                done();
            });
        });

        it('should return an auth code if logged in successfully', function (done) {
            const cookieJar = request.jar();
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.clientId}&redirect_uri=${consts.REDIRECT_URI}`, cookieJar, function (err, res, body) {
                const csrfToken = body.csrfToken;
                assert.isOk(csrfToken);
                utils.authPost(body.loginUrl, {
                    _csrf: csrfToken,
                    username: ids.users.normal.email,
                    password: ids.users.normal.password
                }, cookieJar, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(302, res.statusCode);
                    const redir = res.headers.location;
                    assert.isOk(redir);
                    //console.log(redir);
                    const redirUrl = new URL(redir);
                    assert.isOk(redirUrl.searchParams.get('code'));
                    done();
                });
            });
        });

        it('should also return a token for an auth code (confidential client)', function (done) {
            const cookieJar = request.jar();
            utils.getAuthCode(cookieJar, 'echo', ids.confidential.clientId, consts.REDIRECT_URI, ids.users.normal, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.authPost(`local/api/echo/token`, {
                    grant_type: 'authorization_code',
                    client_id: ids.confidential.clientId,
                    client_secret: ids.confidential.clientSecret,
                    code: code
                }, function (err, res, accessToken) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    assert.isOk(accessToken);
                    assert.isObject(accessToken);
                    assert.isOk(accessToken.access_token);
                    assert.isOk(accessToken.refresh_token);
                    assert.equal('bearer', accessToken.token_type);
                    done();
                });
            });
        });
    });

    describe('misc security failures', function (done) {
        it('should return reject a login if not using a session (cannot resolve CSRF)', function (done) {
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.clientId}&redirect_uri=${consts.REDIRECT_URI}`, function (err, res, body) {
                const csrfToken = body.csrfToken;
                assert.isOk(csrfToken);
                utils.authPost(body.loginUrl, {
                    _csrf: csrfToken,
                    username: ids.users.normal.email,
                    password: ids.users.normal.password
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    // console.log(res);
                    assert.equal(400, res.statusCode);
                    done();
                });
            });
        });
    });
});

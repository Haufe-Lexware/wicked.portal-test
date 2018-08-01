'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow, URL */

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

describe('Authorization Code Grant', function () {

    this.slow(500);

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
                id: 'kdlaskjdlkajskdasd',
                email: ...,
                password: ...
            },
            admin: {
                id: 'dlksjdlksjdlksld'
                ...
            }
        },
        trusted: {
            clientId: '...',
            clientSecret: '...',
            redirectUri: '...'
        },
        confidential: { ... },
        public: { ... },
        withoutUri: { ... }
    }
    */
    let ids;

    before(function (done) {
        this.timeout(10000);
        const now = new Date();
        utils.initAppsAndSubscriptions(function (err, idsAndSecrets) {
            assert.isNotOk(err);
            assert.isOk(idsAndSecrets);
            ids = idsAndSecrets;
            // console.log(JSON.stringify(ids, null, 2));
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
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.echo.clientId}`, function (err, res, body) {
                assert.equal(res.statusCode, 400);
                utils.assertIsHtml(body);
                // console.log(body);
                assert.isTrue(body.message.indexOf('Invalid') >= 0);
                done();
            });
        });

        it('should return an HTML error for a faulty redirect_uri', function (done) {
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.echo.clientId}&redirect_uri=http://bla.com`, function (err, res, body) {
                assert.equal(res.statusCode, 400);
                utils.assertIsHtml(body);
                assert.isTrue(body.message.indexOf('does not match the registered') >= 0);
                done();
            });
        });
    });

    describe('basic success cases', function () {
        this.slow(2000);
        this.timeout(10000);

        it('should return a login screen for a valid authorize request', function (done) {
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.echo.clientId}&redirect_uri=${consts.REDIRECT_URI}`, function (err, res, body) {
                assert.equal(res.statusCode, 200);
                utils.assertIsHtml(body);
                assert.equal('login', body.template);
                // console.log(body);
                done();
            });
        });

        it('should return an auth code if logged in successfully', function (done) {
            const cookieJar = request.jar();
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.echo.clientId}&redirect_uri=${consts.REDIRECT_URI}`, cookieJar, function (err, res, body) {
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
            utils.getAuthCode(cookieJar, 'echo', ids.confidential.echo, ids.users.normal, null /*scope*/, function (err, code) {
                assert.isNotOk(err);
                assert.isOk(code);
                utils.authPost(`local/api/echo/token`, {
                    grant_type: 'authorization_code',
                    client_id: ids.confidential.echo.clientId,
                    client_secret: ids.confidential.echo.clientSecret,
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

        it('should be possible to use a refresh token (confidential client)', function (done) {
            const cookieJar = request.jar();
            utils.getAuthCodeToken(cookieJar, 'echo', ids.confidential.echo, ids.users.normal, null /*scope*/, function (err, accessToken) {
                assert.isNotOk(err);
                assert.isObject(accessToken);
                utils.authPost(`local/api/echo/token`, {
                    grant_type: 'refresh_token',
                    refresh_token: accessToken.refresh_token,
                    client_id: ids.confidential.echo.clientId,
                    client_secret: ids.confidential.echo.clientSecret
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    assert.isObject(body);
                    assert.isNotOk(body.error);
                    assert.isOk(body.access_token);
                    assert.isOk(body.refresh_token);
                    done();
                });
            });
        });

        it('should not be possible to use a refresh token without the client secret (confidential client)', function (done) {
            const cookieJar = request.jar();
            utils.getAuthCodeToken(cookieJar, 'echo', ids.confidential.echo, ids.users.normal, null /*scope*/, function (err, accessToken) {
                assert.isNotOk(err);
                assert.isObject(accessToken);
                utils.authPost(`local/api/echo/token`, {
                    grant_type: 'refresh_token',
                    refresh_token: accessToken.refresh_token,
                    client_id: ids.confidential.echo.clientId
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(401, res.statusCode);
                    assert.isObject(body);
                    assert.equal('unauthorized_client', body.error);
                    done();
                });
            });
        });
    });

    describe('rejection use cases', function () {
        it('should reject creating a token with a differing client_id/secret than the one used for getting the code', function (done) {
            const cookieJar = request.jar();
            utils.getAuthCode(cookieJar, 'echo', ids.confidential.echo, ids.users.normal, null /*scope*/, function (err, code) {
                utils.authPost(`local/api/echo/token`, {
                    grant_type: 'authorization_code',
                    client_id: ids.trusted.echo.clientId,
                    client_secret: ids.trusted.echo.clientSecret,
                    code: code
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode);
                    assert.isObject(body);
                    assert.equal('invalid_request', body.error);
                    done();
                });
            });
        });

        it('should reject attempting to log in with an app without a redirect_uri', function (done) {
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.withoutUri.echo.clientId}&redirect_uri=http://bla.com`, function (err, res, body) {
                assert.equal(res.statusCode, 400);
                utils.assertIsHtml(body);
                assert.isTrue(body.message.indexOf('does not have a registered redirect_uri') >= 0);
                done();
            });
        });

        it('should detect a faulty password (and redisplay login screen)', function (done) {
            this.slow(1200);
            const cookieJar = request.jar();
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.echo.clientId}&redirect_uri=${consts.REDIRECT_URI}`, cookieJar, function (err, res, body) {
                const csrfToken = body.csrfToken;
                assert.isOk(csrfToken);
                const now = new Date().getTime();
                utils.authPost(body.loginUrl, {
                    _csrf: csrfToken,
                    username: ids.users.normal.email,
                    password: 'wrong_password'
                }, cookieJar, function (err, res, body) {
                    assert.isNotOk(err);
                    utils.assertIsHtml(body);
                    assert.isTrue((new Date() - now) > 500, 'operation must take longer than 500ms');
                    assert.equal(body.template, 'login');
                    assert.equal(body.errorMessage, 'Username or password invalid.');
                    assert.equal(body.prefillUsername, ids.users.normal.email);
                    done();
                });
            });
        });
    });

    describe('public clients', function () {
        this.slow(1000);
        this.timeout(10000);
        it('should reject doing the auth code grant with a public client', function (done) {
            const cookieJar = request.jar();
            const client = ids.public.echo;
            utils.getAuthCode(cookieJar, 'echo', client, ids.users.normal, null /*scope*/, function (err, code) {
                utils.authPost(`local/api/echo/token`, {
                    grant_type: 'authorization_code',
                    client_id: client.clientId,
                    client_secret: client.clientSecret,
                    code: code
                }, function (err, res, body) {
                    assert.isNotOk(err);
                    assert.equal(401, res.statusCode);
                    assert.equal('unauthorized_client', body.error);
                    done();
                });
            });
        });
    });

    describe('trusted clients', function () {
        this.slow(1000);
        this.timeout(10000);
        it('should return a token with full scope for a trusted client', function (done) {
            const cookieJar = request.jar();
            const client = ids.trusted.echo;
            const user = ids.users.normal;
            utils.getAuthCodeToken(cookieJar, 'echo', client, user, null /*scope*/, function (err, accessToken) {
                utils.callApi('echo', accessToken.access_token, 'GET', 'foo', null, function (err, res, body) {
                    assert.isNotOk(err);
                    // console.log(body);
                    // Echo API returns everything
                    assert.equal(body.headers['x-authenticated-userid'], user.id);
                    assert.equal(body.headers['x-authenticated-scope'], 'get put post patch delete wicked:dev');
                    done();
                });
            });
        });
    });

    describe('misc security failures', function (done) {
        it('should return reject a login if not using a session (cannot resolve CSRF)', function (done) {
            utils.authGet(`local/api/echo/authorize?response_type=code&client_id=${ids.trusted.echo.clientId}&redirect_uri=${consts.REDIRECT_URI}`, function (err, res, body) {
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

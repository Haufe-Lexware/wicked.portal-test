var assert = require('chai').assert;
var request = require('request');
var utils = require('./testUtils');
var consts = require('./testConsts');

var baseUrl = consts.BASE_URL;

const READ_VERIF_SCOPE = 'read_verifications';
const WRITE_VERIF_SCOPE = 'write_verifications';
const READ_USERS_SCOPE = 'read_users';
const WRITE_USERS_SCOPE = 'write_users';
const INVALID_SCOPE = 'invalid_verifications';

describe('/verifications', function () {
    it('should return a 403 if creating a new email verification with wrong scope', function (done) {
        request.post({
            url: baseUrl + 'verifications',
            headers: utils.makeHeaders('1', INVALID_SCOPE),
            body: {
                type: 'email',
                email: 'unvalidated@user.com',
                userId: '9876543210'
            },
            json: true
        }, function (err, res, body) {
            assert.isNotOk(err);
            utils.assertScopeReject(res, body);
            done();
        });
    });

    it('should be possible to create a new email verification request', function (done) {
        request.post({
            url: baseUrl + 'verifications',
            headers: utils.makeHeaders('1', WRITE_VERIF_SCOPE),
            body: {
                type: 'email',
                email: 'unvalidated@user.com',
                userId: '9876543210'
            },
            json: true
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(204, res.statusCode);
            done();
        });
    });

    it('should, as a normal user, not be possible to retrieve the verifications', function (done) {
        request.get({
            url: baseUrl + 'verifications',
            headers: utils.makeHeaders('9876543210', READ_VERIF_SCOPE)
        }, function (err, res, body) {
            assert.isNotOk(err);
            utils.assertNotScopeReject(res, body);
            done();
        });
    });

    var verifId;

    it('should, as an admin, be possible to retrieve the verifications', function (done) {
        request.get({
            url: baseUrl + 'verifications',
            headers: utils.makeHeaders('1', READ_VERIF_SCOPE)
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(200, res.statusCode);
            var jsonBody = utils.getJson(body);
            assert.equal(1, jsonBody.length);
            verifId = jsonBody[0].id;
            done();
        });
    });

    it('should not be possible to retrieve the verification by id without user', function (done) {
        request.get({
            url: baseUrl + 'verifications/' + verifId,
            headers: utils.onlyScope(READ_VERIF_SCOPE)
        }, function (err, res, body) {
            assert.isNotOk(err);
            utils.assertNotScopeReject(res, body);
            done();
        });
    });

    it('should be possible to patch a user with the validation ID as authorization', function (done) {
        const headers = utils.makeHeaders('1', WRITE_USERS_SCOPE);
        headers['X-VerificationId'] = verifId;
        request.patch({
            url: baseUrl + 'users/9876543210',
            body: {
                validated: true
            },
            json: true,
            headers: headers
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(204, res.statusCode);
            done();
        });
    });

    it('should be possible to patch a user password with the validation ID as authorization', function (done) {
        this.slow(500);
        const headers = utils.makeHeaders('1', WRITE_USERS_SCOPE);
        headers['X-VerificationId'] = verifId;
        request.patch({
            url: baseUrl + 'users/9876543210',
            body: {
                password: 'othersomething'
            },
            json: true,
            headers: headers
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(204, res.statusCode);
            done();
        });
    });

    it('should render a validated user after that', function (done) {
        request.get({
            url: baseUrl + 'users/9876543210',
            headers: utils.makeHeaders('9876543210', READ_USERS_SCOPE)
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(200, res.statusCode);
            var jsonBody = utils.getJson(body);
            assert.equal(true, jsonBody.validated);
            done();
        });
    });

    it('should not be possible to delete a verification with a wrong scope', function (done) {
        request.delete({
            url: baseUrl + 'verifications/' + verifId,
            headers: utils.makeHeaders('1', INVALID_SCOPE)
        }, function (err, res, body) {
            assert.isNotOk(err);
            utils.assertScopeReject(res, body);
            done();
        });
    });

    it('should be possible to delete a verification', function (done) {
        request.delete({
            url: baseUrl + 'verifications/' + verifId,
            headers: utils.makeHeaders('1', WRITE_VERIF_SCOPE)
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(204, res.statusCode);
            done();
        });
    });

    it('should return a 404 for GET if the verification ID is invalid, e.g. already deleted', function (done) {
        request.get({
            url: baseUrl + 'verifications/' + verifId,
            headers: utils.makeHeaders('1', READ_VERIF_SCOPE)
        }, function (err, res, body) {
            assert.isNotOk(err);
            assert.equal(404, res.statusCode);
            done();
        });
    });
});
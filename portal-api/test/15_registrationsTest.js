'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow */

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL + 'registrations/';
const poolId = 'wicked';

const READ_SCOPE = 'read_registrations';
const WRITE_SCOPE = 'write_registrations';

describe('/registrations', () => {

    var devUserId = '';
    var adminUserId = '';
    var noobUserId = '';

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

    function putRegistration(poolId, userId, name, namespace, callback) {
        if (!callback && typeof (namespace) === 'function')
            callback = namespace;
        request.put({
            url: baseUrl + `pools/${poolId}/users/${userId}`,
            headers: utils.makeHeaders(userId, WRITE_SCOPE),
            body: {
                id: userId,
                name: name,
                namespace: namespace
            },
            json: true
        }, (err, res, body) => {
            assert.isNotOk(err);
            assert.equal(res.statusCode, 204);
            callback();
        });
    }

    function deleteRegistration(poolId, userId, accept404, callback) {
        if (typeof (accept404) === 'function' && !callback) {
            callback = accept404;
            accept404 = false;
        }
        request.delete({
            url: baseUrl + `pools/${poolId}/users/${userId}`,
            headers: utils.makeHeaders(userId, WRITE_SCOPE),
        }, (err, res, body) => {
            assert.isNotOk(err);
            if (!accept404) {
                assert.equal(res.statusCode, 204, 'Status not equal 204');
            } else {
                assert.isTrue(res.statusCode === 204 || res.statusCode === 404, 'Status not equal to 204 or 404');
            }
            callback();
        });
    }

    function addSomeRegistrations(done) {
        putRegistration(poolId, adminUserId, 'Admin User', 'ns1', (err) => {
            assert.isNotOk(err);
            putRegistration(poolId, devUserId, 'Dan Developer', 'ns1', (err) => {
                assert.isNotOk(err);
                putRegistration(poolId, noobUserId, 'Norah Noob', 'ns2', (err) => {
                    assert.isNotOk(err);
                    done();
                });
            });
        });
    }

    function deleteSomeRegistrations(done) {
        deleteRegistration(poolId, adminUserId, (err) => {
            deleteRegistration(poolId, devUserId, (err2) => {
                deleteRegistration(poolId, noobUserId, (err3) => {
                    assert.isNotOk(err);
                    assert.isNotOk(err2);
                    assert.isNotOk(err3);
                    done();
                });
            });
        });
    }

    describe('/pools/{poolId} GET', () => {
        describe('basic usage', () => {

            it('should return an empty list without registrations (admin)', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId,
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'GET registrations returned unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items, 'answer did not contain an "items" property');
                    assert.equal(0, jsonBody.items.length);
                    assert.equal(0, jsonBody.count);
                    done();
                });
            });

            it('should reject calls with a 403 which do not have the right scope', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId,
                    headers: utils.makeHeaders(adminUserId, WRITE_SCOPE) // wrong scope
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'GET registrations returned unexpected status code');
                    done();
                });
            });

            it('should return a 403 for non-admins', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'GET registrations returned unexpected status code');
                    done();
                });
            });

            it('should return a 400 for an invalid pool ID', (done) => {
                request.get({
                    url: baseUrl + 'pools/ìnvälid',
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode, 'GET registrations returned unexpected status code');
                    done();
                });
            });

            it('should return a 404 for an non-existing pool ID', (done) => {
                request.get({
                    url: baseUrl + 'pools/non-existing',
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(404, res.statusCode, 'GET registrations returned unexpected status code');
                    done();
                });
            });
        }); // basic usage

        describe('basic usage (2)', () => {

            before(addSomeRegistrations);
            after(deleteSomeRegistrations);

            it('should return a list of registrations', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId + '?no_cache=1',
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'GET registrations returned unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items, 'answer did not contain an "items" property');
                    assert.equal(3, jsonBody.items.length);
                    assert.equal(3, jsonBody.count);
                    assert.isTrue(jsonBody.hasOwnProperty('count_cached'));
                    done();
                });
            });

            it('should return a filtered list of registrations (name_filter)', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId + '?name_filter=Developer',
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'GET registrations returned unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items, 'answer did not contain an "items" property');
                    assert.equal(1, jsonBody.items.length);
                    assert.equal('Dan Developer', jsonBody.items[0].name, 'Name did not match');
                    done();
                });
            });

            it('should return a filtered list of registrations (namespace filter)', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId + '?namespace=ns1',
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'GET registrations returned unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items, 'answer did not contain an "items" property');
                    assert.equal(2, jsonBody.items.length);
                    done();
                });
            });

            it('should return a filtered list of registrations (namespace+name filter)', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId + '?namespace=ns1&name_filter=Developer',
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'GET registrations returned unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items, 'answer did not contain an "items" property');
                    assert.equal(1, jsonBody.items.length);
                    assert.equal('Dan Developer', jsonBody.items[0].name, 'Name did not match');
                    done();
                });
            });

            it('should return an empty filtered list of registrations (namespace+name filter, no match)', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId + '?namespace=ns2&name_filter=Developer',
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'GET registrations returned unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items, 'answer did not contain an "items" property');
                    assert.equal(0, jsonBody.items.length);
                    done();
                });
            });

            it('should return a 400 when filtering for faulty namespace', (done) => {
                request.get({
                    url: baseUrl + 'pools/' + poolId + '?namespace=öäü',
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode, 'GET registrations returned unexpected status code');
                    done();
                });
            });
        });
    }); // {poolId} GET

    describe('/{poolId}/users/{userId}', () => {
        before(addSomeRegistrations);
        after(deleteSomeRegistrations);

        describe('GET', () => {
            it('should be possible to get a single registration', (done) => {
                request.get({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.equal(devUserId, jsonBody.userId, 'User id mismatch');
                    done();
                });
            });

            it('should answer with 404 if there is no such registration', (done) => {
                // woo and user both exist, but no registration
                request.get({
                    url: baseUrl + `pools/woo/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(404, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should reject calls with the wrong scope', (done) => {
                request.get({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should not be possible to get a single registration as a different user', (done) => {
                request.get({
                    url: baseUrl + `pools/${poolId}/users/${noobUserId}`,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should be possible to get a single registration as a different user, if admin', (done) => {
                request.get({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.equal(devUserId, jsonBody.userId, 'User id mismatch');
                    done();
                });
            });
        });

        describe('PUT', () => {
            const newDevName = 'Daniel Developer';
            const newNamespace = 'ns3';
            it('should be possible to upsert a single registration', (done) => {
                request.put({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE),
                    body: {
                        id: devUserId,
                        name: newDevName,
                        namespace: 'ns3'
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should reject calls with a 403 which have the wrong scope', (done) => {
                request.put({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE),
                    body: {
                        id: devUserId,
                        name: 'Does Not Matter'
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            // Sue me, this is checking a side effect
            it('should have updated the information in the registration', (done) => {
                request.get({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.equal(devUserId, jsonBody.userId, 'User id mismatch');
                    assert.equal(jsonBody.name, newDevName);
                    assert.equal(jsonBody.namespace, newNamespace);
                    done();
                });
            });

            // Sue me some more
            it('should return the updated registration in the new namespace', (done) => {
                request.get({
                    url: baseUrl + `pools/${poolId}?namespace=${newNamespace}`,
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.items, 'property items not found');
                    assert.equal(1, jsonBody.items.length);
                    assert.equal(newDevName, jsonBody.items[0].name, 'Name mismatch after upsert!');
                    done();
                });
            });

            it('should not be possible to upsert a single registration as a different user', (done) => {
                request.get({
                    url: baseUrl + `pools/${poolId}/users/${noobUserId}`,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should be possible to update a single registration as a different user, if admin', (done) => {
                request.put({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(adminUserId, WRITE_SCOPE),
                    body: {
                        id: devUserId,
                        name: 'Dan Developer',
                        namespace: 'ns2'
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should not be possible to create a registration for non-existing user (even if admin)', (done) => {
                request.put({
                    url: baseUrl + `pools/${poolId}/users/bad-user-id`,
                    headers: utils.makeHeaders(adminUserId, WRITE_SCOPE),
                    body: {
                        id: 'bad-user-id',
                        name: 'Not Existing',
                        namespace: 'ns1'
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(404, res.statusCode, 'Unexpected status code');
                    done();
                });
            });


            it('should be possible to have two registrations for a single user', (done) => {
                request.put({
                    url: baseUrl + `pools/woo/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE),
                    body: {
                        id: devUserId,
                        name: 'Daniel Developer',
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should be possibe to retrieve both registrations', (done) => {
                request.get({
                    url: baseUrl + `users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode);
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.pools, 'items property is missing');
                    assert.isOk(jsonBody.pools[poolId], `Registration for ${poolId} not found`);
                    assert.isOk(jsonBody.pools.woo, 'registration for pool hello not found.');
                    // Delete it to clean up again
                    deleteRegistration('woo', devUserId, () => {
                        done();
                    });
                });
            });
        }); // PUT

        describe('PUT (with validation)', () => {
            it('should reject registrations without required fields', (done) => {
                request.put({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE),
                    body: {
                        id: devUserId,
                        namespace: 'ns3'
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should reject registrations with a too long name', (done) => {
                request.put({
                    url: baseUrl + `pools/${poolId}/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE),
                    body: {
                        id: devUserId,
                        name: utils.generateCrap(260),
                        namespace: 'ns3'
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should filter out excess properties', (done) => {
                request.put({
                    url: baseUrl + `pools/woo/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE),
                    body: {
                        id: devUserId,
                        name: 'Hello World',
                        namespace: 'ns3',
                        company: 'This is okay',
                        excess_crap: 'Arghjaghr'
                    },
                    json: true
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode, 'Unexpected status code');
                    request.get({
                        url: baseUrl + `pools/woo/users/${devUserId}`,
                        headers: utils.makeHeaders(devUserId, READ_SCOPE),
                    }, (err, res, body) => {
                        assert.isNotOk(err);
                        assert.equal(200, res.statusCode, 'Unexpected status code');
                        const jsonBody = utils.getJson(body);
                        assert.isNotOk(jsonBody.excess_crap);
                        assert.equal('This is okay', jsonBody.company, 'Defined field missing');
                        done();
                    });
                });
            });
        });

        describe('DELETE', () => {
            beforeEach((done) => {
                putRegistration('woo', devUserId, 'Dan Developer', null, done);
            });

            afterEach((done) => {
                const accept404 = true;
                deleteRegistration('woo', devUserId, accept404, done);
            });

            it('should return a 404 if user is not found', (done) => {
                request.delete({
                    url: baseUrl + `pools/woo/users/bad-user-id`,
                    headers: utils.makeHeaders(adminUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(404, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should return a 400 if pool ID contains invalid characters', (done) => {
                request.delete({
                    url: baseUrl + `pools/pööl/users/${adminUserId}`,
                    headers: utils.makeHeaders(adminUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(400, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should be possible to delete a registration as yourself', (done) => {
                request.delete({
                    url: baseUrl + `pools/woo/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should reject calls with the wrong scope', (done) => {
                request.delete({
                    url: baseUrl + `pools/woo/users/${devUserId}`,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should not be possible to delete a registration as somebody else', (done) => {
                request.delete({
                    url: baseUrl + `pools/woo/users/${devUserId}`,
                    headers: utils.makeHeaders(noobUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should be possible to delete a registration as an admin', (done) => {
                request.delete({
                    url: baseUrl + `pools/woo/users/${devUserId}`,
                    headers: utils.makeHeaders(adminUserId, WRITE_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(204, res.statusCode, 'Unexpected status code');
                    done();
                });
            });
        });
    });

    describe('/users/{userId}', () => {
        describe('GET', () => {
            it('should return an empty pools object if no registrations were made', (done) => {
                request.get({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders(devUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.pools);
                    assert.equal(0, Object.keys(jsonBody.pools).length, 'pools is not an empty object');
                    done();
                });
            });

            it('should return a single registration', (done) => {
                putRegistration(poolId, devUserId, 'Daniel Developer', null, () => {
                    request.get({
                        url: baseUrl + 'users/' + devUserId,
                        headers: utils.makeHeaders(devUserId, READ_SCOPE)
                    }, (err, res, body) => {
                        deleteRegistration(poolId, devUserId, () => {
                            assert.isNotOk(err);
                            assert.equal(200, res.statusCode, 'Unexpected status code');
                            const jsonBody = utils.getJson(body);
                            assert.isOk(jsonBody.pools);
                            assert.isOk(jsonBody.pools[poolId], 'pool registration not found');
                            done();
                        });
                    });
                });
            });

            it('should return 403 if accessing with other user', (done) => {
                request.get({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders(noobUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(403, res.statusCode, 'Unexpected status code');
                    done();
                });
            });

            it('should return something if accessing as an admin', (done) => {
                request.get({
                    url: baseUrl + 'users/' + devUserId,
                    headers: utils.makeHeaders(adminUserId, READ_SCOPE)
                }, (err, res, body) => {
                    assert.isNotOk(err);
                    assert.equal(200, res.statusCode, 'Unexpected status code');
                    const jsonBody = utils.getJson(body);
                    assert.isOk(jsonBody.pools);
                    assert.equal(0, Object.keys(jsonBody.pools).length, 'pools is not an empty object');
                    done();
                });
            });
        });
    });
});
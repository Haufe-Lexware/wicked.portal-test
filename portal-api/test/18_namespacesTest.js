'use strict';

/* global it, describe, before, beforeEach, after, afterEach, slow */

const assert = require('chai').assert;
const request = require('request');
const utils = require('./testUtils');
const consts = require('./testConsts');

const baseUrl = consts.BASE_URL + 'templates/';

const READ_SCOPE = 'read_namespaces';
const WRITE_SCOPE = 'write_namespaces';
const INVALID_SCOPE = 'invalid_templates';

describe('/pools/:poolId/namespaces', () => {

    it('should fail because there are no tests yet', (done) => {
        assert.isTrue(false, 'not implemented yet.');
    });

});

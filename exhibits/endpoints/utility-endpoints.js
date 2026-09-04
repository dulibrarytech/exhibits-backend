'use strict';

const { api_base } = require('../../libs/endpoints_config');

const BASE = api_base('/exhibits');
const RECYCLE_BASE = api_base('/recycle');

const ENDPOINTS = {
    reorder_records: {
        post: {
            description: 'reorders items in exhibit',
            endpoint: `${BASE}/:exhibit_id/items/reorder`,
            params: 'token or api_key',
            body: 'item array of objects'
        }
    },
    token_verify: {
        get: {
            description: 'Verifies token',
            endpoint: `${BASE}/verify`,
            header: 'token'
        }
    },
    recycled_records: {
        get: {
            description: 'Retrieves all records flagged as deleted',
            endpoint: RECYCLE_BASE,
            params: 'token or api_key'
        },
        put: {
            description: 'Restores trashed record',
            endpoint: `${RECYCLE_BASE}/:exhibit_id/:uuid/:type`,
            params: 'token or api_key'
        },
        delete: {
            description: 'Permanently deletes a record',
            endpoint: `${RECYCLE_BASE}/:exhibit_id/:uuid/:type`,
            params: 'token or api_key'
        }
    },
    /* Emptying the bin is a second DELETE on a different URL, so it gets its
     * own resource rather than a non-method key on recycled_records. */
    recycled_records_all: {
        delete: {
            description: 'Permanently deletes all recycled records (empty bin)',
            endpoint: `${RECYCLE_BASE}/all`,
            params: 'token or api_key'
        }
    }
};

/*
 * DEPRECATED aliases — see exhibit-endpoints.js for the rationale.
 *
 *   token_verify.endpoint        → token_verify.get.endpoint
 *       public/app/utils/auth.module.js (784, 790)
 *   recycled_records.empty       → recycled_records_all.delete
 *       no client reader (public/app/recycle.module.js hardcodes its paths);
 *       kept for one release so an out-of-tree caller cannot break silently
 */
ENDPOINTS.token_verify.endpoint = ENDPOINTS.token_verify.get.endpoint;
ENDPOINTS.recycled_records.empty = ENDPOINTS.recycled_records_all.delete;

module.exports = ENDPOINTS;

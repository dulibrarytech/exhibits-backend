'use strict';

const { api_base } = require('../../libs/endpoints_config');

const BASE = api_base('/exhibits');

const ENDPOINTS = {

    /* Every item of every type in one exhibit. Its own resource because
     * `item_records.get` is the by-id read. */
    item_records_list: {
        get: {
            description: 'Gets all exhibit items',
            endpoint: `${BASE}/:exhibit_id/items`,
            params: 'token or api_key'
        }
    },
    item_records: {
        get: {
            description: 'Retrieves item record by id',
            endpoint: `${BASE}/:exhibit_id/items/:item_id`,
            params: 'token or api_key, gets all records by exhibit via uuid param'
        },
        post: {
            description: 'Creates item record',
            endpoint: `${BASE}/:exhibit_id/items`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, record data'
        },
        put: {
            description: 'Updates item record',
            endpoint: `${BASE}/:exhibit_id/items/:item_id`,
            params: 'token or api_key',
            body: 'record data'
        },
        delete: {
            description: 'Deletes item record',
            endpoint: `${BASE}/:exhibit_id/items/:item_id`,
            params: 'token or api_key, uuid'
        }
    },
    item_publish: {
        post: {
            description: 'Publishes item',
            endpoint: `${BASE}/:exhibit_id/publish/:item_id/item`
        }
    },
    item_suppress: {
        post: {
            description: 'Suppresses item',
            endpoint: `${BASE}/:exhibit_id/suppress/:item_id/item`
        }
    }
};

/*
 * DEPRECATED aliases — see exhibit-endpoints.js for the rationale.
 *
 *   item_records.endpoint            → item_records_list.get.endpoint
 *       public/app/items.module.js (127, 132)
 *   item_records.item_publish        → item_publish
 *       public/app/items.module.js (495, 501)
 *   item_records.item_suppress       → item_suppress
 *       public/app/items.module.js (594, 600)
 */
ENDPOINTS.item_records.endpoint = ENDPOINTS.item_records_list.get.endpoint;
ENDPOINTS.item_records.item_publish = ENDPOINTS.item_publish;
ENDPOINTS.item_records.item_suppress = ENDPOINTS.item_suppress;

module.exports = ENDPOINTS;

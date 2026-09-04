'use strict';

const { api_base } = require('../../libs/endpoints_config');

const BASE = api_base('/exhibits');

const ENDPOINTS = {
    grid_records: {
        get: {
            description: 'Retrieves grid record by exhibit id and grid id',
            endpoint: `${BASE}/:exhibit_id/grids/:grid_id`,
            params: 'token or api_key, exhibit_id, grid_id'
        },
        post: {
            description: 'Creates grid record',
            endpoint: `${BASE}/:exhibit_id/grids`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, record data'
        },
        put: {
            description: 'Updates grid record',
            endpoint: `${BASE}/:exhibit_id/grids/:grid_id`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, grid_id, record data'
        }
    },
    grid_item_records: {
        get: {
            description: 'Retrieves all grid item records by exhibit id and grid id',
            endpoint: `${BASE}/:exhibit_id/grids/:grid_id/items`,
            params: 'token or api_key, gets all records by exhibit via uuid param'
        },
        post: {
            description: 'Creates grid item record',
            endpoint: `${BASE}/:exhibit_id/grids/:grid_id/items`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, grid_id, record data'
        },
        put: {
            description: 'Updates grid item record',
            endpoint: `${BASE}/:exhibit_id/grids/:grid_id/items/:item_id`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, grid_id, item_id, record data'
        },
        delete: {
            description: 'Deletes grid item record',
            endpoint: `${BASE}/:exhibit_id/grids/:grid_id/items/:item_id`,
            params: 'token or api_key, uuid'
        }
    },
    grid_item_record: {
        get: {
            description: 'Retrieves one grid item record by exhibit id and grid id',
            endpoint: `${BASE}/:exhibit_id/grids/:grid_id/items/:item_id`,
            params: 'token or api_key, is_member_of_exhibit, grid_id, item_id'
        }
    },
    grid_item_publish: {
        post: {
            description: 'Publishes grid item',
            endpoint: `${BASE}/:exhibit_id/publish/:grid_id/item/:grid_item_id`
        }
    },
    grid_item_suppress: {
        post: {
            description: 'Suppresses grid item',
            endpoint: `${BASE}/:exhibit_id/suppress/:grid_id/item/:grid_item_id`
        }
    }
};

/*
 * DEPRECATED aliases — see exhibit-endpoints.js for the rationale.
 *
 *   grid_item_records.grid_item_publish   → grid_item_publish
 *       public/app/grid-items/items.grid.module.js (331)
 *   grid_item_records.grid_item_suppress  → grid_item_suppress
 *       public/app/grid-items/items.grid.module.js (391)
 */
ENDPOINTS.grid_item_records.grid_item_publish = ENDPOINTS.grid_item_publish;
ENDPOINTS.grid_item_records.grid_item_suppress = ENDPOINTS.grid_item_suppress;

module.exports = ENDPOINTS;

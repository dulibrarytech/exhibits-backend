'use strict';

const { api_base } = require('../../libs/endpoints_config');

const BASE = api_base('/exhibits');

module.exports = {
    heading_records: {
        get: {
            description: 'Retrieves heading record by exhibit',
            endpoint: `${BASE}/:exhibit_id/headings/:heading_id`,
            params: 'token or api_key, gets all records by exhibit'
        },
        post: {
            description: 'Creates heading record',
            endpoint: `${BASE}/:exhibit_id/headings`,
            params: 'token or api_key',
            body: 'record data'
        },
        put: {
            description: 'Updates heading record',
            endpoint: `${BASE}/:exhibit_id/headings/:heading_id`,
            params: 'token or api_key',
            body: 'record data'
        },
        delete: {
            description: 'Deletes heading record',
            endpoint: `${BASE}/:exhibit_id/headings/:heading_id`,
            params: 'token or api_key'
        }
    }
};

'use strict';

const { APP_PATH, PREFIX, VERSION, ENDPOINT } = require('./endpoints_config');

module.exports = {
    heading_records: {
        get: {
            description: 'Retrieves all heading record by exhibit',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/headings/:heading_id`,
            params: 'token or api_key, gets all records by exhibit'
        },
        post: {
            description: 'Creates heading record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/headings`,
            params: 'token or api_key',
            body: 'record data'
        },
        put: {
            description: 'Updates heading record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/headings/:heading_id`,
            params: 'token or api_key',
            body: 'record data'
        },
        delete: {
            description: 'Deletes heading record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/headings/:heading_id`,
            params: 'token or api_key'
        }
    }
};

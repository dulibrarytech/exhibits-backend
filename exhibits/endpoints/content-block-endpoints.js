'use strict';

const { APP_PATH, PREFIX, VERSION, ENDPOINT } = require('./endpoints_config');

module.exports = {
    content_block_records: {
        get: {
            description: 'Retrieves all content block record by exhibit',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/content-blocks/:content_block_id`,
            params: 'token or api_key, gets all records by exhibit'
        },
        post: {
            description: 'Creates content block record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/content-blocks`,
            params: 'token or api_key',
            body: 'record data'
        },
        put: {
            description: 'Updates content block record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/content-blocks/:content_block_id`,
            params: 'token or api_key',
            body: 'record data'
        },
        delete: {
            description: 'Deletes content block record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/content-blocks/:content_block_id`,
            params: 'token or api_key'
        }
    }
};

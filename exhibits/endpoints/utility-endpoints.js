'use strict';

const { APP_PATH, PREFIX, VERSION, ENDPOINT } = require('./endpoints_config');

module.exports = {
    reorder_exhibits_records: {
        post: {
            description: 'reorders exhibits',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/reorder`,
            params: 'token or api_key',
            body: 'item array of objects'
        }
    },
    reorder_records: {
        post: {
            description: 'reorders items in exhibit',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items/reorder`,
            params: 'token or api_key',
            body: 'item array of objects'
        }
    },
    token_verify: {
        description: 'Verifies token',
        endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/verify`,
        header: 'token'
    },
    recycled_records: {
        get: {
            description: 'Retrieves all records flagged as deleted',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}/recycle`,
            params: 'token or api_key'
        },
        delete: {
            description: 'Permanently deletes a record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}/recycle/:exhibit_id/:uuid/:type`,
            params: 'token or api_key'
        },
        post: {
            description: 'Permanently deletes all trash records',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}/recycle/:exhibit_id/:uuid/:type`,
            params: 'token or api_key'
        },
        put: {
            description: 'Restores trashed record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}/recycle/:exhibit_id/:uuid/:type`,
            params: 'token or api_key'
        }
    }
};

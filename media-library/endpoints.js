'use strict';

const { APP_PATH, PREFIX, VERSION, ENDPOINT } = require('./endpoints_config');

module.exports = {
    media_records: {
        endpoint: {
            description: 'Uploads media',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/media/library/upload`,
            params: 'token or api_key',
        },
        get: {
            description: 'Retrieves all media records',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/media/library`,
            params: 'token or api_key, gets all media records'
        },
        post: {
            description: 'Creates media record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/media/library`,
            params: 'token or api_key',
            body: 'media data'
        },
        put: {
            description: 'Updates media record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/media/library`,
            params: 'token or api_key',
            body: 'media data'
        },
        delete: {
            description: 'Deletes media record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/media/library`,
            params: 'token or api_key, uuid'
        }
    }
};

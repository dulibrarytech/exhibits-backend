'use strict';

const { APP_PATH, PREFIX, VERSION, ENDPOINT } = require('./endpoints_config');

module.exports = {
    item_records: {
        description: 'Gets all exhibit items',
        endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items`,
        get: {
            description: 'Retrieves all item records by exhibit',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items/:item_id`,
            params: 'token or api_key, gets all records by exhibit via uuid param'
        },
        post: {
            description: 'Creates item record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, record data'
        },
        put: {
            description: 'Updates item record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items/:item_id`,
            params: 'token or api_key',
            body: 'record data'
        },
        delete: {
            description: 'Deletes item record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items/:item_id`,
            params: 'token or api_key, uuid'
        },
        item_publish: {
            post: {
                description: 'Publishes item',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/publish/:item_id/item`
            }
        },
        item_suppress: {
            post: {
                description: 'Suppresses item',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/suppress/:item_id/item`
            }
        }
    }
};

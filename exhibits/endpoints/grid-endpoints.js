'use strict';

const { APP_PATH, PREFIX, VERSION, ENDPOINT } = require('./endpoints_config');

module.exports = {
    grid_records: {
        get: {
            description: 'Retrieves all grid records by exhibit id and grid id',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id`,
            params: 'token or api_key, exhibit_id, grid_id'
        },
        post: {
            description: 'Creates grid record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, record data'
        },
        put: {
            description: 'Updates grid record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, grid_id, record data'
        }
    },
    grid_item_records: {
        get: {
            description: 'Retrieves all grid item records by exhibit id and grid id',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id/items`,
            params: 'token or api_key, gets all records by exhibit via uuid param'
        },
        post: {
            description: 'Creates grid item record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id/items`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, grid_id, record data'
        },
        put: {
            description: 'Creates grid item record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id/items/:item_id`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, grid_id, item_id, record data'
        },
        delete: {
            description: 'Deletes grid item record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id/items/:item_id`,
            params: 'token or api_key, uuid'
        },
        grid_item_publish: {
            post: {
                description: 'Publishes grid item',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/publish/:grid_id/item/:grid_item_id`
            }
        },
        grid_item_suppress: {
            post: {
                description: 'Suppresses grid item',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/suppress/:grid_id/item/:grid_item_id`
            }
        }
    },
    grid_item_record: {
        get: {
            description: 'Retrieves all grid item record by exhibit id and grid id',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id/items/:item_id`,
            params: 'token or api_key, is_member_of_exhibit, grid_id, item_id'
        }
    },
    grid_item_media: {
        delete: {
            description: 'Deletes grid item media',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id/items/:item_id/media/:media`
        }
    }
};

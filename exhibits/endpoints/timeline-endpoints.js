'use strict';

const { APP_PATH, PREFIX, VERSION, ENDPOINT } = require('./endpoints_config');

module.exports = {
    timeline_records: {
        get: {
            description: 'Retrieves all timelines records by exhibit id and timeline id',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id`,
            params: 'token or api_key, exhibit_id, timeline_id'
        },
        post: {
            description: 'Creates timeline record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, record data'
        },
        put: {
            description: 'Updates timeline record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, timeline_id, record data'
        },
        delete: {
            description: 'Deletes timeline record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id`,
            params: 'token or api_key'
        }
    },
    timeline_item_records: {
        get: {
            description: 'Retrieves all timeline item records by exhibit id and timeline id',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id/items`,
            params: 'token or api_key, gets all records by exhibit via uuid param'
        },
        post: {
            description: 'Creates timeline item record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id/items`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, grid_id, record data'
        },
        put: {
            description: 'Creates timelines item record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id/items/:item_id`,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, grid_id, item_id, record data'
        },
        delete: {
            description: 'Deletes timeline item record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id/items/:item_id`,
            params: 'token or api_key, uuid'
        },
        timeline_item_publish: {
            post: {
                description: 'Publishes timeline item',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/publish/:timeline_id/item/:timeline_item_id`
            }
        },
        timeline_item_suppress: {
            post: {
                description: 'Suppresses timeline item',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/suppress/:timeline_id/item/:timeline_item_id`
            }
        }
    },
    timeline_item_record: {
        get: {
            description: 'Retrieves all timeline item record by exhibit id and timeline id',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id/items/:item_id`,
            params: 'token or api_key, is_member_of_exhibit, timeline_id, item_id'
        }
    },
    timeline_item_media: {
        delete: {
            description: 'Deletes timeline item media',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id/items/:item_id/media/:media`
        }
    }
};

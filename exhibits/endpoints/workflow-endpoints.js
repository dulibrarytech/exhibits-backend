'use strict';

const { APP_PATH, PREFIX, VERSION, ENDPOINT } = require('./endpoints_config');

module.exports = {
    exhibit_publish: {
        post: {
            description: 'Publishes exhibit',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/publish`
        }
    },
    exhibit_suppress: {
        post: {
            description: 'Suppresses exhibit',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/suppress`
        }
    },
    exhibit_unlock_record: {
        post: {
            description: 'Unlock exhibit record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/unlock`
        }
    },
    heading_unlock_record: {
        post: {
            description: 'Unlock heading record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/headings/:heading_id/unlock`
        }
    },
    item_unlock_record: {
        post: {
            description: 'Unlock standard item record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items/:item_id/unlock`
        }
    },
    grid_item_unlock_record: {
        post: {
            description: 'Unlock grid item record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/grids/:grid_id/items/:item_id/unlock`
        }
    },
    timeline_item_unlock_record: {
        post: {
            description: 'Unlock timeline item record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/timelines/:timeline_id/items/:item_id`
        }
    }
};

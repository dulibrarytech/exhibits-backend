'use strict';

const { APP_PATH, PREFIX, VERSION, ENDPOINT } = require('./endpoints_config');

module.exports = {
    exhibit_media: {
        get: {
            description: 'Gets exhibit media',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/media/:media`
        },
        delete: {
            description: 'Deletes exhibit media',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/media/:media`
        }
    },
    item_media: {
        get: {
            description: 'Gets item media',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/media/items/:media`,
        },
        delete: {
            description: 'Deletes item media',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/media/items/:item_id/:media`
        }
    },
    media: {
        get: {
            description: 'Gets media - hero and thumbnail images before they are part of an exhibit',
            endpoint: `${APP_PATH}/media`
        },
        delete: {
            description: 'Deletes media - hero and thumbnail images before they are part of an exhibit',
            endpoint: `${APP_PATH}/media`
        }
    }
};

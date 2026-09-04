'use strict';

const { APP_PATH, api_base } = require('../../libs/endpoints_config');

const BASE = api_base('/exhibits');

module.exports = {
    exhibit_media: {
        get: {
            description: 'Gets exhibit media',
            endpoint: `${BASE}/:exhibit_id/media/:media`
        },
        delete: {
            description: 'Deletes exhibit media',
            endpoint: `${BASE}/:exhibit_id/media/:media`
        }
    },
    item_media: {
        get: {
            description: 'Gets item media',
            endpoint: `${BASE}/:exhibit_id/media/items/:media`
        },
        delete: {
            description: 'Deletes item media',
            endpoint: `${BASE}/:exhibit_id/media/items/:item_id/:media`
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

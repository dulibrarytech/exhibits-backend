'use strict';

const { APP_PATH, PREFIX, VERSION, ENDPOINT } = require('./endpoints_config');

module.exports = {
    exhibit_records: {
        description: 'Gets all exhibit records',
        endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}`,
        endpoints: {
            get: {
                description: 'Retrieves exhibit record by id',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id`,
                params: 'token or api_key, gets all records by exhibit via uuid param - ?type=details,edit,index,title'
            },
            post: {
                description: 'Creates exhibit record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}`,
                params: 'token or api_key',
                body: 'is_member_of_exhibit, record data'
            },
            put: {
                description: 'Updates exhibit record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id`,
                params: 'token or api_key, uuid',
                body: 'record data'
            },
            delete: {
                description: 'Deletes exhibit record',
                endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id`,
                params: 'token or api_key, uuid, delete_reason'
            }
        }
    },
    exhibit_preview: {
        get: {
            description: 'Previews exhibit',
            endpoint: `${APP_PATH}/preview`,
            params: 'token'
        }
    },
    exhibit_shared: {
        get: {
            description: 'Shares exhibit preview',
            endpoint: `${APP_PATH}/shared`,
            params: 'token'
        }
    },
    exhibit_media_library: {
        get: {
            description: 'Gets media library bindings for an exhibit',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/media-library`
        },
        post: {
            description: 'Binds a media library asset to an exhibit',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/media-library`,
            body: 'media_uuid, media_role (hero_image | thumbnail)'
        },
        delete: {
            description: 'Removes a media library binding from an exhibit',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/media-library/:media_role`
        }
    }
};

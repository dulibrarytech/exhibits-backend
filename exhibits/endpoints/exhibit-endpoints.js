'use strict';

const { APP_PATH, api_base } = require('../../libs/endpoints_config');

const BASE = api_base('/exhibits');

const ENDPOINTS = {

    /* Collection of exhibits. Its own resource because `exhibit_records.get`
     * is the by-id read, matching heading/item/grid/timeline_records.get. */
    exhibit_records_list: {
        get: {
            description: 'Gets all exhibit records',
            endpoint: BASE,
            params: 'token or api_key'
        }
    },
    exhibit_records: {
        get: {
            description: 'Retrieves exhibit record by id',
            endpoint: `${BASE}/:exhibit_id`,
            params: 'token or api_key, gets all records by exhibit via uuid param - ?type=details,edit,index,title'
        },
        post: {
            description: 'Creates exhibit record',
            endpoint: BASE,
            params: 'token or api_key',
            body: 'is_member_of_exhibit, record data'
        },
        put: {
            description: 'Updates exhibit record',
            endpoint: `${BASE}/:exhibit_id`,
            params: 'token or api_key, uuid',
            body: 'record data'
        },
        delete: {
            description: 'Deletes exhibit record',
            endpoint: `${BASE}/:exhibit_id`,
            params: 'token or api_key, uuid, delete_reason'
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
            endpoint: `${BASE}/:exhibit_id/media-library`
        },
        post: {
            description: 'Binds a media library asset to an exhibit',
            endpoint: `${BASE}/:exhibit_id/media-library`,
            body: 'media_uuid, media_role (hero_image | thumbnail)'
        },
        delete: {
            description: 'Removes a media library binding from an exhibit',
            endpoint: `${BASE}/:exhibit_id/media-library/:media_role`
        }
    }
};

/*
 * DEPRECATED aliases. References to the canonical nodes above — never copies —
 * so every URL still has exactly one definition. They exist only because the
 * listed client modules are owned elsewhere and still read the old paths.
 * Delete an entry once its reader has moved to the canonical path.
 *
 *   exhibit_records.endpoint            → exhibit_records_list.get.endpoint
 *       public/app/exhibits/exhibits.module.js (33, 39)
 *       public/app/exhibits/exhibits.add.form.module.js (148, 169)
 *       public/app/media-library/media.library.module.js (753)
 *   exhibit_records.endpoints.get       → exhibit_records.get
 *       public/app/exhibits/exhibits.module.js (882)
 *       public/app/exhibits/exhibits.common.form.module.js (307)
 *       public/app/utils/helper.module.js (1028)
 *   exhibit_records.endpoints.put       → exhibit_records.put
 *       public/app/exhibits/exhibits.edit.form.module.js (177)
 *       public/app/exhibits/exhibits.styles.form.module.js (229)
 *   exhibit_records.endpoints.delete    → exhibit_records.delete
 *       public/app/exhibits/exhibits.module.js (952)
 *   exhibit_records.endpoints.post      → exhibit_records.post
 *       no client reader; kept so the alias block stays a complete mirror
 */
ENDPOINTS.exhibit_records.endpoint = ENDPOINTS.exhibit_records_list.get.endpoint;
ENDPOINTS.exhibit_records.endpoints = {
    get: ENDPOINTS.exhibit_records.get,
    post: ENDPOINTS.exhibit_records.post,
    put: ENDPOINTS.exhibit_records.put,
    delete: ENDPOINTS.exhibit_records.delete
};

module.exports = ENDPOINTS;

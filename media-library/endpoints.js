/**
 * Copyright 2026 University of Denver
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const APP_PATH = '/exhibits-dashboard';
const PREFIX = '/api/';
const VERSION = 'v1';
const ENDPOINT = '/media/library';
const ENDPOINTS = {
    media_records: {
        get: {
            description: 'Retrieves all media records',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}`,
            params: 'token or api_key, gets all media records'
        },
        post: {
            description: 'Creates media record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}`,
            params: 'token or api_key',
            body: 'media data'
        },
        put: {
            description: 'Updates media record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/record/:media_id`,
            params: 'token or api_key, media_id',
            body: 'media data'
        },
        delete: {
            description: 'Deletes media record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/record/:media_id`,
            params: 'token or api_key, media_id'
        }
    },
    media_record: {
        get: {
            description: 'Retrieves a single media record by UUID',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/record/:media_id`,
            params: 'token or api_key, media_id (UUID)'
        }
    },
    media_file: {
        get: {
            description: 'Retrieves media file by filename',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/file/:filename`,
            params: 'token or api_key, filename'
        }
    },
    repo_media_search: {
        get: {
            description: 'Searches digital repository records',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/repo/search`,
            params: 'token or api_key, search term'
        }
    },
    repo_thumbnail: {
        get: {
            description: 'Gets digital repository thumbnail',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/repo/thumbnail`,
            params: 'token or api_key, uuid'
        }
    },
    repo_subjects: {
        get: {
            description: 'Gets digital repository subjects grouped by type',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/repo/subjects`,
            params: 'token or api_key, optional type query parameter (topical, geographic, genre_form)'
        }
    },
    repo_resource_types: {
        get: {
            description: 'Gets digital repository resource types',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/repo/resource-types`,
            params: 'token or api_key, optional type query parameter'
        }
    },
    kaltura_media: {
        get: {
            description: 'Gets Kaltura media metadata by entry ID',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/kaltura/:entry_id`,
            params: 'token or api_key, entry_id (path parameter)'
        }
    },
    kaltura_config: {
        get: {
            description: 'Gets Kaltura player configuration (partner_id, uiconf_id)',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/kaltura/config/player`,
            params: 'token or api_key'
        }
    },
};

module.exports = () => {
    return ENDPOINTS;
};

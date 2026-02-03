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
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:media_id`,
            params: 'token or api_key, media_id',
            body: 'media data'
        },
        delete: {
            description: 'Deletes media record',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:media_id`,
            params: 'token or api_key, media_id'
        }
    },
    media_record: {
        get: {
            description: 'Retrieves a single media record by UUID',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/:media_id`,
            params: 'token or api_key, media_id (UUID)'
        }
    },
    media_file: {
        get: {
            description: 'Retrieves media file by filename',
            endpoint: `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}/file/:filename`,
            params: 'token or api_key, filename'
        }
    }
};

module.exports = () => {
    return ENDPOINTS;
};

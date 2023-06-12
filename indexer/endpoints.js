/**

 Copyright 2023 University of Denver

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 */

'use strict';

const PREFIX = '/api/';
const VERSION = 'v1';
const ENDPOINT = '/indexer';
const ENDPOINTS = {
    indexer: {
        index_records: {
            description: 'Indexes all exhibit, heading, and item active records',
            endpoint: `${PREFIX}${VERSION}${ENDPOINT}`,
            endpoints: {
                post: {
                    description: 'indexes exhibit index record',
                    endpoint: `${PREFIX}${VERSION}${ENDPOINT}/:uuid`,
                    params: 'token or api_key, ?type=exhibit,heading,item'
                },
                delete: {
                    description: 'Deletes exhibit indexed record',
                    endpoint: `${PREFIX}${VERSION}${ENDPOINT}/:uuid`,
                    params: 'token or api_key'
                }
            }
        },
        index_utils: {
            post: {
                description: 'Creates search index',
                endpoint: `${PREFIX}${VERSION}${ENDPOINT}/manage`,
                params: 'token or api_key'
            },
            get: {
                description: 'Retrieves search index information',
                endpoint: `${PREFIX}${VERSION}${ENDPOINT}/manage`,
                params: 'token or api_key'
            }
        }
    }
};

module.exports = () => {
    return ENDPOINTS;
};

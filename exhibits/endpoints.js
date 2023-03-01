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
const ENDPOINT = '/exhibits';
const ENDPOINTS = {
    exhibits: {
        exhibit_records: {
            endpoint: `${PREFIX}${VERSION}${ENDPOINT}`,
            description: 'exhibit records',
            get: {
                description: 'Retrieves exhibit records',
                params: 'token or api_key, gets all records by exhibit via uuid param'
            },
            post: {
                description: 'Creates exhibit record',
                params: 'token or api_key',
                body: 'is_member_of_exhibit, record data'
            },
            put: {
                description: 'Updates exhibit record',
                params: 'token or api_key',
                body: 'record data'
            },
            delete: {
                description: 'Deletes exhibit record',
                params: 'token or api_key, uuid, delete_reason'
            }
        }
    }
};

module.exports = () => {
    return ENDPOINTS;
};

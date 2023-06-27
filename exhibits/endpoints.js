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
            description: 'Gets all exhibit records',
            endpoint: `${PREFIX}${VERSION}${ENDPOINT}`,
            endpoints: {
                get: {
                    description: 'Retrieves exhibit record by id',
                    endpoint: `${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id`,
                    params: 'token or api_key, gets all records by exhibit via uuid param'
                },
                post: {
                    description: 'Creates exhibit record',
                    endpoint: `${PREFIX}${VERSION}${ENDPOINT}`,
                    params: 'token or api_key',
                    body: 'is_member_of_exhibit, record data'
                },
                put: {
                    description: 'Updates exhibit record',
                    endpoint: `${PREFIX}${VERSION}${ENDPOINT}`,
                    params: 'token or api_key, uuid',
                    body: 'record data'
                },
                delete: {
                    description: 'Deletes exhibit record',
                    endpoint: `${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id`,
                    params: 'token or api_key, uuid, delete_reason'
                }
            }
        },
        item_records: {
            description: 'Gets all exhibit items',
            endpoint: `${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items`,
            get: {
                description: 'Retrieves all item records by exhibit',
                endpoint: `${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items/:item_id`,
                params: 'token or api_key, gets all records by exhibit via uuid param'
            },
            post: {
                description: 'Creates item record',
                endpoint: `${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items`,
                params: 'token or api_key',
                body: 'is_member_of_exhibit, record data'
            },
            put: {
                description: 'Updates item record',
                endpoint: `${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items/:item_id`,
                params: 'token or api_key',
                body: 'record data'
            },
            delete: {
                description: 'Deletes item record',
                endpoint: `${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/items/:item_id`,
                params: 'token or api_key, uuid'
            }
        },
        heading_records: {
            get: {
                description: 'Retrieves all heading record by exhibit',
                endpoint: `${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/headings/:heading_id`,
                params: 'token or api_key, gets all records by exhibit'
            },
            post: {
                description: 'Creates heading record',
                endpoint: `${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/headings`,
                params: 'token or api_key',
                body: 'record data'
            },
            put: {
                description: 'Updates heading record',
                endpoint: `${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/headings/:heading_id`,
                params: 'token or api_key',
                body: 'record data'
            },
            delete: {
                description: 'Deletes heading record',
                endpoint: `${PREFIX}${VERSION}${ENDPOINT}/:exhibit_id/headings/:heading_id`,
                params: 'token or api_key'
            }
        },
        trashed_records: {
            get: {
                description: 'Retrieves all records flagged as deleted',
                endpoint: `${PREFIX}${VERSION}/trash`,
                params: 'token or api_key'
            },
            delete: {
                description: 'Permanently deletes a record',
                endpoint: `${PREFIX}${VERSION}/trash/:exhibit_id/:uuid/:type`,
                params: 'token or api_key'
            },
            post: {
                description: 'Permanently deletes all trash records',
                endpoint: `${PREFIX}${VERSION}/trash/:exhibit_id/:uuid/:type`,
                params: 'token or api_key'
            },
            put: {
                description: 'Restores trashed record',
                endpoint: `${PREFIX}${VERSION}/trash/:exhibit_id/:uuid/:type`,
                params: 'token or api_key'
            }
        }
    }
};

module.exports = () => {
    return ENDPOINTS;
};

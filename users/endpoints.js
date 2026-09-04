/**

 Copyright 2022 University of Denver

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

const { api_base } = require('../libs/endpoints_config');

const BASE = api_base('/users');

const ENDPOINTS = {
    users: {
        user_records: {
            get: {
                description: 'Gets all user records',
                endpoint: BASE,
                params: 'token or api_key'
            },
            post: {
                description: 'Creates user record',
                endpoint: BASE,
                params: 'token or api_key',
                body: 'du_id, email, first_name, last_name'
            },
            put: {
                description: 'Updates user record',
                endpoint: `${BASE}/:user_id`,
                params: 'token or api_key',
                body: 'id, du_id, email, first_name, last_name'
            },
            delete: {
                description: 'Deletes user record',
                endpoint: `${BASE}/:user_id`,
                params: 'id, token or api_key'
            }
        },
        user_record: {
            get: {
                description: 'Gets single user record',
                endpoint: `${BASE}/:user_id`,
                params: 'id, token or api_key'
            }
        },
        user_status: {
            put: {
                description: 'Activates or deactivates a user',
                endpoint: `${BASE}/status/:id/:is_active`,
                params: 'id, token, is_active'
            }
        }
    }
};

/*
 * DEPRECATED aliases. References to the canonical nodes above — never copies.
 * They exist only because public/app/user.module.js is owned elsewhere and
 * still reads the old paths. Delete an entry once its reader has moved.
 *
 *   users.endpoint                      → user_records.get.endpoint
 *       public/app/user.module.js (35, 765, 771)
 *   users.get_user.endpoint             → user_record.get.endpoint
 *       public/app/user.module.js (61)
 *   users.update_user.put               → user_records.put
 *       public/app/user.module.js (704)
 *   users.delete_user.delete            → user_records.delete
 *       public/app/user.module.js (900, 906)
 *   users.user_status.endpoint          → user_status.put.endpoint
 *       public/app/user.module.js (1066)
 *
 * `get_users` and `create_user` are gone outright: they carried no `endpoint`
 * key at all, so nothing could ever have resolved a URL through them.
 */
ENDPOINTS.users.endpoint = ENDPOINTS.users.user_records.get.endpoint;
ENDPOINTS.users.get_user = { endpoint: ENDPOINTS.users.user_record.get.endpoint };
ENDPOINTS.users.update_user = { put: ENDPOINTS.users.user_records.put };
ENDPOINTS.users.delete_user = { delete: ENDPOINTS.users.user_records.delete };
ENDPOINTS.users.user_status.endpoint = ENDPOINTS.users.user_status.put.endpoint;

module.exports = () => {
    return ENDPOINTS;
};

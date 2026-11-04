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

const HELPER = require("../libs/helper");
const HELPER_TASK = new HELPER();
const TABLE_ENV = {
    exhibit_records: 'EXHIBIT_RECORDS',
    item_records: 'ITEM_RECORDS',
    heading_records: 'HEADING_RECORDS',
    content_block_records: 'CONTENT_BLOCK_RECORDS',
    grid_item_records: 'GRID_ITEM_RECORDS',
    grid_records: 'GRID_RECORDS',
    timeline_records: 'TIMELINE_RECORDS',
    timeline_item_records: 'TIMELINE_ITEM_RECORDS',
    user_records: 'USER_RECORDS',
    roles_records: 'ROLES_RECORDS',
    users_roles: 'USERS_ROLES',
    media_library_records: 'MEDIA_LIBRARY_RECORDS',
    exhibit_media_records: 'EXHIBIT_MEDIA_RECORDS'
};
const TABLES = {};
const MISSING_TABLE_ENV = [];

for (const [key, env_name] of Object.entries(TABLE_ENV)) {

    if (typeof process.env[env_name] !== 'string' || process.env[env_name].trim() === '') {
        MISSING_TABLE_ENV.push(env_name);
        continue;
    }

    TABLES[key] = process.env[env_name];
}

if (MISSING_TABLE_ENV.length > 0) {
    throw new Error(`Missing table name(s) in .env: ${MISSING_TABLE_ENV.join(', ')}. Add every *_RECORDS key from env-example before starting the app.`);
}
const DB_TABLES_CONFIG = {
    exhibits: HELPER_TASK.check_config(TABLES)
};

module.exports = function () {
    return DB_TABLES_CONFIG;
};

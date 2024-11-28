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
const TABLES = {
    exhibit_records: process.env.EXHIBIT_RECORDS,
    item_records: process.env.ITEM_RECORDS,
    heading_records: process.env.HEADING_RECORDS,
    grid_item_records: process.env.GRID_ITEM_RECORDS,
    grid_records: process.env.GRID_RECORDS,
    timeline_records: process.env.TIMELINE_RECORDS,
    timeline_item_records: process.env.TIMELINE_ITEM_RECORDS,
    user_records: process.env.USER_RECORDS
};
const DB_TABLES_CONFIG = {
    exhibits: HELPER_TASK.check_config(TABLES)
};

module.exports = function () {
    return DB_TABLES_CONFIG;
};

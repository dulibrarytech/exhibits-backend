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

import {it, expect} from 'vitest';

const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const TABLES = DB_TABLES.exhibits;

import LOGGER from "../../libs/log4";
import EXHIBIT_RECORD_TASKS from "../tasks/exhibit_record_tasks";
const HELPER = require('../../libs/helper');
const VALIDATOR = require('../../libs/validate');
const TABLE = 'tbl_exhibits';

it.concurrent('Exhibit - create exhibit (Unit Test)', async function () {

    // let uri = TEST_RECORD.child_records[1].uri;
    // await expect(COLLECTION_TASKS.check_uri(uri)).resolves.toBeTruthy();

    try {

        // exhibit record TODO:
        const data = {

        };

        const HELPER_TASK = new HELPER();
        data.uuid = HELPER_TASK.create_uuid();

        const VALIDATE_TASK = new VALIDATOR(EXHIBITS_CREATE_RECORD_SCHEMA);
        let is_valid = VALIDATE_TASK.validate(data);

        if (is_valid !== true) {

            LOGGER.module().error('ERROR: [/exhibits/model (create_exhibit_record)] ' + is_valid[0].message);

            return {
                status: 400,
                message: is_valid
            };
        }

        if (data.styles.length === 0) {
            data.styles = '{}';
        } else {
            data.styles = VALIDATE_TASK.validator_unescape(data.styles);
        }

        const CREATE_RECORD_TASK = new EXHIBIT_RECORD_TASKS(DB, TABLES.exhibit_records);
        let result = await CREATE_RECORD_TASK.create_exhibit_record(data);
        console.log(result);
        // test result here success = uuid / string

    } catch (error) {
        console.log(error);
    }

}, 10000);

it.concurrent('Exhibit - get exhibits (Unit Test)', async function () {
    // let exhibit_uuid = '';
    // await expect(COLLECTION_TASKS.check_uri(uri)).resolves.toBeTruthy();
}, 10000);

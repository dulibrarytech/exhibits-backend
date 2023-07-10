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
const EXHIBIT_HEADING_TASKS = require('../tasks/exhibit_heading_record_tasks');
const HELPER = require('../../libs/helper');
const VALIDATOR = require('../../libs/validate');
const TABLE = 'tbl_headings_test';
const HEADING_TASKS = new EXHIBIT_HEADING_TASKS(DB, TABLE);

it.concurrent('Exhibit - create heading (Unit Test)', async function () {
    let uri = TEST_RECORD.child_records[1].uri;
    await expect(COLLECTION_TASKS.check_uri(uri)).resolves.toBeTruthy();
}, 10000);

it.concurrent('Exhibit - get headings (Unit Test)', async function () {
    let exhibit_uuid = '';
    await expect(COLLECTION_TASKS.check_uri(uri)).resolves.toBeTruthy();
}, 10000);
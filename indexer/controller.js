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

const MODEL = require('../indexer/model');
const SERVICE = require('../indexer/service');

/**
 * Creates exhibits index
 * @param req
 * @param res
 */
exports.create_index = function (req, res) {
    const result = SERVICE.create_index();
    res.status(result.status).send(result);
};

/**
 * Indexes all active exhibit, heading, and item records
 * @param req
 * @param res
 */
exports.index_all_records = function (req, res) {
    const result = MODEL.index_all_records();
    res.status(result.status).send(result);
};

/**
 * Indexes single record
 * @param req
 * @param res
 * @return {boolean}
 */
exports.index_record = async function (req, res) {

    let uuid = req.params.uuid;
    let type = req.query.type;

    if (uuid === undefined || uuid.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    if (type === undefined || type.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    let result = await MODEL.index_record(uuid, type);
    res.status(result.status).send(result);
};

/**
 * Deletes record from index
 * @param req
 * @param res
 */
exports.delete_record = async function (req, res) {
    let uuid = req.params.uuid;
    let result = await MODEL.delete_record(uuid);
    res.status(result.status).send(result);
};

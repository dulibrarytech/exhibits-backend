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
    SERVICE.create_index((data) => {
        res.status(data.status).send(data);
    });
};

/**
 * Indexes all active exhibit, heading, and item records
 * @param req
 * @param res
 */
exports.index_all_records = (req, res) => {
    MODEL.index_all_records((data) => {
        res.status(data.status).send(data);
    });
};

/**
 * Indexes single record
 * @param req
 * @param res
 * @return {boolean}
 */
exports.index_record = (req, res) => {

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

    MODEL.index_record(uuid, type, (data) => {
        res.status(data.status).send(data);
    });
};

/**
 * Deletes record from index
 * @param req
 * @param res
 */
exports.delete_record = (req, res) => {

    let uuid = req.params.uuid;

    MODEL.delete_record(uuid,(data) => {
        res.status(data.status).send(data);
    });
};

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

exports.create_index = async function (req, res) {

    try {
        const result = await SERVICE.create_index();
        res.status(result.status).send(result);
    } catch (error) {
        res.status(500).send({message: `Unable to create index. ${error.message}`});
    }
};

exports.index_exhibit = async function (req, res) {

    try {
        const uuid = req.params.uuid;
        const result = await MODEL.index_exhibit(uuid);
        res.status(result.status).send(result);
    } catch (error) {
        res.status(500).send({message: `Unable to index exhibit. ${error.message}`});
    }
};

exports.get_indexed_record = async function (req, res) {

    try {
        const uuid = req.params.uuid;
        const response = await MODEL.get_indexed_record(uuid);
        res.status(response.status).send(response.data);
    } catch (error) {
        res.status(500).send({message: `Unable to get indexed record. ${error.message}`});
    }

};

exports.delete_record = async function (req, res) {

    try {
        const uuid = req.params.uuid;
        const result = await MODEL.delete_record(uuid);
        res.status(result.status).send(result);
    } catch (error) {
        res.status(500).send({message: `Unable to delete record. ${error.message}`});
    }
};

exports.index_record = async function (req, res) {

    try {

        const uuid = req.params.uuid;
        const type = req.query.type;

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

    } catch (error) {
        res.status(500).send({message: `Unable to index. ${error.message}`});
    }
};

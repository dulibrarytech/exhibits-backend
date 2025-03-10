/**

 Copyright 2025 University of Denver

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

const RECYCLE_MODEL = require('../exhibits/recycle_model');

exports.get_recycled_records = async function (req, res) {

    try {

        const data = await RECYCLE_MODEL.get_recycled_records();
        res.status(data.status).send(data);

    } catch (error) {
        res.status(500).send({message: `Unable to get recycled records. ${error.message}`});
    }

};

exports.delete_recycled_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const uuid = req.params.uuid;
        const type = req.params.type;

        if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (type === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const result = await TRASH_MODEL.delete_trashed_record(is_member_of_exhibit, uuid, type);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to delete recycled records. ${error.message}`});
    }
};

exports.delete_all_recycled_records = function (req, res) {

    try {

        const result = RECYCLE_MODEL.delete_all_recycled_records();
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to delete all recycled records. ${error.message}`});
    }
};

exports.restore_recycled_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const uuid = req.params.uuid;
        const type = req.params.type;

        if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (type === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const result = await RECYCLE_MODEL.restore_recycled_record(is_member_of_exhibit, uuid, type);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to restore recycled records. ${error.message}`});
    }
};

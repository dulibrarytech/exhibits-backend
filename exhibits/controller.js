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

const MODEL = require('../exhibits/model');
const PATH = require("path");

exports.create_exhibit_record = async function (req, res) {

    const data = req.body;

    if (data === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await MODEL.create_exhibit_record(data);
    res.status(result.status).send(result);
};

exports.get_exhibit_records = async function (req, res) {
    const data = await MODEL.get_exhibit_records();
    res.status(data.status).send(data);
};

exports.get_exhibit_record = async function (req, res) {

    const uuid = req.params.exhibit_id;

    if (uuid === undefined || uuid.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    const data = await MODEL.get_exhibit_record(uuid);
    res.status(data.status).send(data);
};

exports.update_exhibit_record = async function (req, res) {

    const data = req.body;

    if (data === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await MODEL.update_exhibit_record(data);
    res.status(result.status).send(result);
};

exports.delete_exhibit_record = async function (req, res) {

    let uuid = req.params.exhibit_id;

    if (uuid === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await MODEL.delete_exhibit_record(uuid);
    res.status(result.status).send(result);
};

exports.create_item_record = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const data = req.body;

    if (data === undefined || is_member_of_exhibit === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await MODEL.create_item_record(is_member_of_exhibit, data);
    res.status(result.status).send(result);
};

exports.get_item_records = async function (req, res) {
    const is_member_of_exhibit = req.params.exhibit_id;
    const data = await MODEL.get_item_records(is_member_of_exhibit);
    res.status(data.status).send(data);
};

exports.get_item_record = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const uuid = req.params.item_id;

    if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    const data = await MODEL.get_item_record(is_member_of_exhibit, uuid);
    res.status(data.status).send(data);
};

exports.update_item_record = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const uuid = req.params.item_id;
    const data = req.body;

    if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    if (data === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await MODEL.update_item_record(is_member_of_exhibit, uuid, data);
    res.status(result.status).send(result);
};

exports.delete_item_record = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const uuid = req.params.item_id;

    if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await MODEL.delete_item_record(is_member_of_exhibit, uuid);
    res.status(result.status).send(result);
};

exports.create_heading_record = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const data = req.body;

    if (data === undefined || is_member_of_exhibit === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await MODEL.create_heading_record(is_member_of_exhibit, data);
    res.status(result.status).send(result);
};

exports.get_heading_record = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const uuid = req.params.heading_id;

    if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    const data = await MODEL.get_heading_record(is_member_of_exhibit, uuid);
    res.status(data.status).send(data);
};

exports.update_heading_record = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const uuid = req.params.heading_id;
    const data = req.body;

    if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    if (data === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await MODEL.update_heading_record(is_member_of_exhibit, uuid, data);
    res.status(result.status).send(result);
};

exports.delete_heading_record = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const uuid = req.params.heading_id;

    if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await MODEL.delete_heading_record(is_member_of_exhibit, uuid);
    res.status(result.status).send(result);
};

exports.create_grid_record = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const data = req.body;

    if (data === undefined || is_member_of_exhibit === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await MODEL.create_grid_record(is_member_of_exhibit, data);
    res.status(result.status).send(result);
};

exports.get_trashed_records = async function (req, res) {
    const data = await MODEL.get_trashed_records();
    res.status(data.status).send(data);
};

exports.delete_trashed_record = async function (req, res) {

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

    const result = await MODEL.delete_trashed_record(is_member_of_exhibit, uuid, type);
    res.status(result.status).send(result);
};

exports.delete_all_trashed_records = function (req, res) {
    const result = MODEL.delete_all_trashed_records();
    res.status(result.status).send(result);
};

exports.restore_trashed_record = async function (req, res) {

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

    const result = await MODEL.restore_trashed_record(is_member_of_exhibit, uuid, type);
    res.status(result.status).send(result);
};

exports.get_exhibit_media = function () {

    const uuid = req.params.uuid;
    const type = req.params.type;  // type=hero | thumbnail

    // TODO: query record
    MODEL.get_exhibit_media (function (data) {
        if (data.error === true) {
            res.sendFile(PATH.join(__dirname, '../public', data.data));
        } else {
            res.status(data.status).end(data.data, 'binary');
        }
    });
};

exports.get_item_media = function () {

};

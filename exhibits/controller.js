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

exports.create_exhibit_record = (req, res) => {

    const data = req.body;

    if (data === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    MODEL.create_exhibit_record(data, (data) => {
        res.status(data.status).send(data);
    });
};

exports.get_exhibit_records = (req, res) => {
    MODEL.get_exhibit_records((data) => {
        res.status(data.status).send(data);
    });
};

exports.get_exhibit_record = (req, res) => {

    const uuid = req.params.exhibit_id;

    if (uuid === undefined || uuid.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    MODEL.get_exhibit_record(uuid, (data) => {
        res.status(data.status).send(data);
    });
};

exports.update_exhibit_record = (req, res) => {

    const data = req.body;

    if (data === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    MODEL.update_exhibit_record(data, (data) => {
        res.status(data.status).send(data);
    });
};

exports.delete_exhibit_record = (req, res) => {

    let uuid = req.params.exhibit_id;

    if (uuid === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    MODEL.delete_exhibit_record(uuid, (data) => {
        res.status(data.status).send(data);
    });
};

exports.create_item_record = (req, res) => {

    const is_member_of_exhibit = req.params.exhibit_id;
    const data = req.body;

    if (data === undefined || is_member_of_exhibit === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    MODEL.create_item_record(is_member_of_exhibit, data, (data) => {
        res.status(data.status).send(data);
    });
};

exports.get_item_records = (req, res) => {

    const is_member_of_exhibit = req.params.exhibit_id;

    MODEL.get_item_records(is_member_of_exhibit,(data) => {
        res.status(data.status).send(data);
    });
};

exports.get_item_record = (req, res) => {

    const is_member_of_exhibit = req.params.exhibit_id;
    const uuid = req.params.item_id;

    if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    MODEL.get_item_record(is_member_of_exhibit, uuid, (data) => {
        res.status(data.status).send(data);
    });
};

exports.update_item_record = (req, res) => {

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

    MODEL.update_item_record(is_member_of_exhibit, uuid, data, (data) => {
        res.status(data.status).send(data);
    });
};

exports.delete_item_record = (req, res) => {

    const is_member_of_exhibit = req.params.exhibit_id;
    const uuid = req.params.item_id;

    if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    MODEL.delete_item_record(is_member_of_exhibit, uuid, (data) => {
        res.status(data.status).send(data);
    });
};

exports.create_heading_record = (req, res) => {

    const is_member_of_exhibit = req.params.exhibit_id;
    const data = req.body;

    if (data === undefined || is_member_of_exhibit === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    MODEL.create_heading_record(is_member_of_exhibit, data, (data) => {
        res.status(data.status).send(data);
    });
};

exports.get_heading_record = (req, res) => {

    const is_member_of_exhibit = req.params.exhibit_id;
    const uuid = req.params.heading_id;

    if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    MODEL.get_heading_record(is_member_of_exhibit, uuid, (data) => {
        res.status(data.status).send(data);
    });
};

exports.update_heading_record = (req, res) => {

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

    MODEL.update_heading_record(is_member_of_exhibit, uuid, data,(data) => {
        res.status(data.status).send(data);
    });
};

exports.delete_heading_record = (req, res) => {

    const is_member_of_exhibit = req.params.exhibit_id;
    const uuid = req.params.heading_id;

    if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    MODEL.delete_heading_record(is_member_of_exhibit, uuid, (data) => {
        res.status(data.status).send(data);
    });
};

exports.get_trashed_records = (req, res) => {
    MODEL.get_trashed_records((data) => {
        res.status(data.status).send(data);
    });
};

exports.delete_trashed_record = (req, res) => {

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

    MODEL.delete_trashed_record(is_member_of_exhibit, uuid, type, (data) => {
        res.status(data.status).send(data);
    });
};

exports.delete_all_trashed_records = (req, res) => {
    MODEL.delete_all_trashed_records((data) => {
        res.status(data.status).send(data);
    });
};

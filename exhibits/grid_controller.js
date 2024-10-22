/**

 Copyright 2024 University of Denver

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

const GRIDS_MODEL = require('../exhibits/grid_model');
const ITEMS_MODEL = require("./items_model");
const FS = require("fs");
const HEADINGS_MODEL = require("./headings_model");

exports.create_grid_record = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const data = req.body;

    if (data === undefined || is_member_of_exhibit === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await GRIDS_MODEL.create_grid_record(is_member_of_exhibit, data);
    res.status(result.status).send(result);
};

exports.update_grid_record = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const grid_id = req.params.grid_id;
    const data = req.body;

    if (data === undefined || is_member_of_exhibit === undefined || grid_id === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await GRIDS_MODEL.update_grid_record(is_member_of_exhibit, grid_id, data);
    res.status(result.status).send(result);
};

exports.get_grid_record = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const grid_id = req.params.grid_id;

    if (is_member_of_exhibit === undefined || grid_id === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await GRIDS_MODEL.get_grid_record(is_member_of_exhibit, grid_id);
    res.status(result.status).send(result);
};

exports.create_grid_item_record = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const grid_id = req.params.grid_id;
    const data = req.body;

    if (is_member_of_exhibit === undefined || grid_id === undefined || data === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await GRIDS_MODEL.create_grid_item_record(is_member_of_exhibit, grid_id, data);
    res.status(result.status).send(result);
};

exports.get_grid_item_records = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const is_member_of_grid = req.params.grid_id;

    if (is_member_of_exhibit === undefined || is_member_of_grid === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await GRIDS_MODEL.get_grid_item_records(is_member_of_exhibit, is_member_of_grid);
    res.status(result.status).send(result);
};

exports.get_grid_item_record = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const is_member_of_grid = req.params.grid_id;
    const item_id = req.params.item_id;

    if (is_member_of_exhibit === undefined || is_member_of_grid === undefined || item_id === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await GRIDS_MODEL.get_grid_item_record(is_member_of_exhibit, is_member_of_grid, item_id);
    res.status(result.status).send(result);
};

exports.update_grid_item_record = async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const grid_id = req.params.grid_id;
    const item_id = req.params.item_id;
    const data = req.body;

    if (data === undefined || is_member_of_exhibit === undefined || grid_id === undefined || item_id === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await GRIDS_MODEL.update_grid_item_record(is_member_of_exhibit, grid_id, item_id, data);
    res.status(result.status).send(result);
};

exports.delete_grid_item_media = function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const media = req.params.media;

        if (media !== undefined && media.length !== 0) {

            (async function () {
                await GRIDS_MODEL.delete_media_value(item_id, media);
            })();

            FS.unlinkSync(`./storage/${exhibit_id}/${media}`);
            res.status(204).send('Media deleted');

        } else {
            res.status(200).send('Unable to delete media file');
        }

    } catch(error) {
        res.status(404).send({message: `Unable to delete exhibit media file. ${error.message}`});
    }

    return false;
};

// TODO
exports.publish_grid_item_record = async function (req, res) {

    const exhibit_id = req.params.exhibit_id;
    const grid_id = req.params.grid_id;
    // const type = req.query.type;
    let result;

    if (exhibit_id === undefined || exhibit_id.length === 0 && grid_id === undefined || grid_id.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    if (type === 'item') {
        result = await ITEMS_MODEL.publish_item_record(exhibit_id, item_id);
    } else if (type === 'heading') {
        result = await HEADINGS_MODEL.publish_heading_record(exhibit_id, item_id);
    } else if (type === 'grid') {
        result = await GRIDS_MODEL.publish_grid_record(exhibit_id, item_id);
    } else {

        res.status(204).send({
            message: 'Unable to publish item'
        });

        return false;
    }

    if (result.status === true) {
        res.status(200).send({
            message: 'Item published.'
        });
    } else if (result.status === false) {
        res.status(204).send({
            message: 'Unable to publish item'
        });
    }
};

exports.suppress_grid_item_record = async function (req, res) {

    const exhibit_id = req.params.exhibit_id;
    const grid_id = req.params.grid_id;
    const grid_item_id = req.params.grid_item_id;
    const type = req.query.type;
    let result;

    if (exhibit_id === undefined || exhibit_id.length === 0 && grid_id === undefined || grid_id.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    result = await GRIDS_MODEL.suppress_grid_item_record(exhibit_id, grid_id, grid_item_id);

    if (result === true) {
        res.status(200).send({
            message: 'Item grid suppressed.'
        });
    } else if (result === false) {
        res.status(204).send({
            message: 'Unable to suppress grid item'
        });
    }
};

/*

exports.get_trashed_records = async function (req, res) {
    const data = await TRASH_MODEL.get_trashed_records();
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

    const result = await TRASH_MODEL.delete_trashed_record(is_member_of_exhibit, uuid, type);
    res.status(result.status).send(result);
};

exports.delete_all_trashed_records = function (req, res) {
    const result = TRASH_MODEL.delete_all_trashed_records();
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

    const result = await TRASH_MODEL.restore_trashed_record(is_member_of_exhibit, uuid, type);
    res.status(result.status).send(result);
};

exports.get_exhibit_media = function (req, res) {

    const uuid = req.params.exhibit_id;
    const media = req.params.media;

    try {
        res.status(200).sendFile(PATH.join(__dirname, `../storage/${uuid}`, media));
    } catch(error) {
        console.log(error.message);
        res.status(404).send({message: `Exhibit media not found. ${error.message}`});
    }

    return false;
};

exports.get_item_media = function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const media = req.params.media;

    try {
        res.status(200).sendFile(PATH.join(__dirname, `../storage/${is_member_of_exhibit}`, media));
    } catch(error) {
        console.log(error.message);
        res.status(404).send({message: `Exhibit media not found. ${error.message}`});
    }

    return false;
};
*/

/*
exports.build_exhibit_preview = async function (req, res) {

    const uuid = req.query.uuid;

    if (uuid === undefined || uuid.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await EXHIBITS_MODEL.build_exhibit_preview(uuid);

    if (result.status === true) {
        console.log(WEBSERVICES_CONFIG.exhibit_preview_url + uuid + '?key=' + WEBSERVICES_CONFIG.exhibit_preview_api_key);
        setTimeout(() => {
            res.redirect(WEBSERVICES_CONFIG.exhibit_preview_url + uuid + '?key=' + WEBSERVICES_CONFIG.exhibit_preview_api_key);
        }, 1000);
    }
};
*/

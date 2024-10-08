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

const WEBSERVICES_CONFIG = require('../config/webservices_config')();
const EXHIBITS_MODEL = require('../exhibits/exhibits_model');
const TRASH_MODEL = require('../exhibits/trash_model');
const PATH = require('path');
const FS = require('fs');

exports.create_exhibit_record = async function (req, res) {

    const data = req.body;

    if (data === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await EXHIBITS_MODEL.create_exhibit_record(data);
    res.status(result.status).send(result);
};

exports.get_exhibit_records = async function (req, res) {
    const data = await EXHIBITS_MODEL.get_exhibit_records();
    res.status(data.status).send(data);
};

exports.get_exhibit_record = async function (req, res) {

    const uuid = req.params.exhibit_id;

    if (uuid === undefined || uuid.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    const data = await EXHIBITS_MODEL.get_exhibit_record(uuid);
    res.status(data.status).send(data);
};

exports.update_exhibit_record = async function (req, res) {

    const uuid = req.params.exhibit_id;
    const data = req.body;

    if (uuid === undefined || data === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await EXHIBITS_MODEL.update_exhibit_record(uuid, data);
    res.status(result.status).send(result);
};

exports.delete_exhibit_record = async function (req, res) {

    let uuid = req.params.exhibit_id;

    if (uuid === undefined) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await EXHIBITS_MODEL.delete_exhibit_record(uuid);
    res.status(result.status).send(result);
};

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

    try {

        const uuid = req.params.exhibit_id;
        const media = req.params.media;

        res.status(200).sendFile(PATH.join(__dirname, `../storage/${uuid}`, media));

    } catch(error) {
        res.status(404).send({message: `Exhibit media not found. ${error.message}`});
    }

    return false;
};

exports.get_media = function (req, res) {

    try {

        const media = req.query.media;

        if (media !== undefined && media.length !== 0) {
            res.status(200).sendFile(PATH.join(__dirname, `../storage/`, media));
        } else {
            res.status(404).send('Unable to get media file');
        }

    } catch(error) {
        res.status(200).send({message: `Unable to get media file. ${error.message}`});
    }

    return false;
};

exports.delete_media = function (req, res) {

    try {

        const media = req.query.media;

        if (media !== undefined && media.length !== 0) {
            FS.unlinkSync(`./storage/${media}`);
            res.status(204).send('Media deleted');
        } else {
            res.status(200).send('Unable to delete media file');
        }

    } catch(error) {
        res.status(200).send({message: `Unable to delete media file. ${error.message}`});
    }

    return false;
};

exports.delete_exhibit_media = function (req, res) {

    try {

        const uuid = req.params.exhibit_id;
        const media = req.params.media;

        if (media !== undefined && media.length !== 0) {

            (async function () {
                await EXHIBITS_MODEL.delete_media_value(uuid, media);
            })();

            FS.unlinkSync(`./storage/${uuid}/${media}`);
            res.status(204).send('Media deleted');

        } else {
            res.status(200).send('Unable to delete media file');
        }

    } catch(error) {
        res.status(404).send({message: `Unable to delete exhibit media file. ${error.message}`});
    }

    return false;
};

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

exports.publish_exhibit = async function (req, res) {

    const uuid = req.params.exhibit_id;

    if (uuid === undefined || uuid.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await EXHIBITS_MODEL.publish_exhibit(uuid);

    if (result.status === 'no_items') {
        res.status(204).send({
            message: 'Exhibit must have at least one item to published.'
        });
    }

    if (result.status === true) {
        res.status(200).send({
            message: 'Exhibit published.'
        });
    } else if (result.status === false) {
        res.status(400).send({
            message: 'Unable to publish exhibit'
        });
    }
}

exports.suppress_exhibit = async function (req, res) {

    const uuid = req.params.exhibit_id;

    if (uuid === undefined || uuid.length === 0) {
        res.status(400).send('Bad request.');
        return false;
    }

    const result = await EXHIBITS_MODEL.suppress_exhibit(uuid);

    if (result.status === true) {
        res.status(200).send({
            message: 'Exhibit suppressed.'
        });
    } else {
        res.status(400).send({
            message: 'Unable to suppress exhibit'
        });
    }
}

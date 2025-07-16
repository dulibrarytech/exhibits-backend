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
const STORAGE_CONFIG = require('../config/storage_config')();
const EXHIBITS_MODEL = require('../exhibits/exhibits_model');
const FS = require('fs');

exports.create_exhibit_record = async function (req, res) {

    try {

        const data = req.body;

        if (data === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const result = await EXHIBITS_MODEL.create_exhibit_record(data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to create exhibit record. ${error.message}`});
    }
};

exports.get_exhibit_records = async function (req, res) {

    try {

        const data = await EXHIBITS_MODEL.get_exhibit_records();
        res.status(data.status).send(data);

    } catch (error) {
        res.status(500).send({message: `Unable to get exhibit records. ${error.message}`});
    }
};

exports.get_exhibit_record = async function (req, res) {

    try {

        const uuid = req.params.exhibit_id;
        let uid = req.query.uid;

        if (uid === undefined) {
            const data = await EXHIBITS_MODEL.get_exhibit_title(uuid);
            res.status(data.status).send(data);
            return false;
        }

        if (uuid === undefined || uuid.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        const data = await EXHIBITS_MODEL.get_exhibit_record(uid, uuid);
        res.status(data.status).send(data);

    } catch (error) {
        res.status(500).send({message: `Unable to get exhibit record. ${error.message}`});
    }
};

exports.update_exhibit_record = async function (req, res) {

    try {

        const uuid = req.params.exhibit_id;
        const data = req.body;

        if (uuid === undefined || data === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const result = await EXHIBITS_MODEL.update_exhibit_record(uuid, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to update exhibit record. ${error.message}`});
    }
};

exports.delete_exhibit_record = async function (req, res) {

    try {

        let uuid = req.params.exhibit_id;

        if (uuid === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const result = await EXHIBITS_MODEL.delete_exhibit_record(uuid);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to delete exhibit record. ${error.message}`});
    }
};

exports.get_exhibit_media = function (req, res) {

    try {

        const uuid = req.params.exhibit_id;
        const media = req.params.media;
        res.status(200).sendFile(`${STORAGE_CONFIG.storage_path}/${uuid}/${media}`);

    } catch(error) {
        res.status(404).send({message: `Exhibit media not found. ${error.message}`});
    }

    return false;
};

exports.get_media = function (req, res) {

    try {

        const media = req.query.media;

        if (media !== undefined && media.length !== 0) {
            res.status(200).sendFile(`${STORAGE_CONFIG.storage_path}/${media}`);
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
            FS.unlinkSync(`${STORAGE_CONFIG.storage_path}/${media}`);
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

            FS.unlinkSync(`${STORAGE_CONFIG.storage_path}/${uuid}/${media}`);
            res.status(204).send('Media deleted');

        } else {
            res.status(200).send('Unable to delete media file');
        }

    } catch(error) {
        res.status(404).send({message: `Unable to delete exhibit media file. ${error.message}`});
    }
};

exports.build_exhibit_preview = async function (req, res) {

    try {

        const uuid = req.query.uuid;

        if (uuid === undefined || uuid.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        const response = await EXHIBITS_MODEL.check_preview(uuid);

        if (response === true) {

            console.log('Tearing down old preview');

            const result = await EXHIBITS_MODEL.delete_exhibit_preview(uuid);

            if (result.status === false) {

                res.status(200).send({message: `Unable to unset exhibit preview.`});
                return false;
            }
        }

        setTimeout(async () => {

            console.log('Building new preview');

            const result = await EXHIBITS_MODEL.build_exhibit_preview(uuid);

            if (result.status === true) {

                const preview_url = `${WEBSERVICES_CONFIG.exhibit_preview_url}${uuid}?key=${WEBSERVICES_CONFIG.exhibit_preview_api_key}`;

                setTimeout(() => {
                    res.render('preview', {
                        preview_url: preview_url
                    });
                }, 2000);
            }

        }, 2000);

    } catch (error) {
        res.status(500).send({message: `Unable to build exhibit preview. ${error.message}`});
    }
};

exports.publish_exhibit = async function (req, res) {

    try {

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

    } catch (error) {
        res.status(500).send({message: `Unable to publish exhibit. ${error.message}`});
    }
}

exports.suppress_exhibit = async function (req, res) {

    try {

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

    } catch (error) {
        res.status(500).send({message: `Unable to suppress exhibit. ${error.message}`});
    }
}

exports.verify = function (req, res) {
    res.status(200).send({
        message: 'Token Verified'
    });
};

exports.reorder_exhibit_items = async function (req, res) {

    try {

        const updated_order = req.body;

        if (updated_order.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        let is_reordered = await EXHIBITS_MODEL.reorder_exhibits(updated_order);

        if (is_reordered === false) {

            res.status(204).send({
                message: 'Unable to reorder exhibit items.'
            });

        } else {

            res.status(201).send({
                message: 'Exhibits reordered.'
            });
        }

    } catch (error) {
        res.status(500).send({message: `Unable to reorder exhibits. ${error.message}`});
    }
};

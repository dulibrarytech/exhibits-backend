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

const FS = require('fs');
const WEBSERVICES_CONFIG = require('../config/webservices_config')();
const STORAGE_CONFIG = require('../config/storage_config')();
const EXHIBITS_MODEL = require('../exhibits/exhibits_model');
const AUTHORIZE = require('../auth/authorize');
const LOGGER = require('../libs/log4');

/**
 * Creates a new exhibit record
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.create_exhibit_record = async (req, res) => {

    try {

        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Request body is required'
            });
        }

        // Check authorization with cleaner options object
        const authOptions = {
            req,
            permissions: ['add_exhibit'],
            record_type: 'exhibit',
            parent_id: null,
            child_id: null
        };

        const isAuthorized = await AUTHORIZE.check_permission(authOptions);

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized request'
            });
        }

        // Create exhibit record
        const result = await EXHIBITS_MODEL.create_exhibit_record(req.body);

        // Validate result structure before using
        if (!result || typeof result.status !== 'number') {
            throw new Error('Invalid response from model');
        }

        return res.status(result.status).json(result);

    } catch (error) {
        // Log detailed error internally
        LOGGER.module().error('ERROR: [/exhibits/controller (create_exhibit_record)]', {
            error: error.message,
            stack: error.stack,
            userId: req.user?.id // Log user context if available
        });

        // Send generic error to client (avoid exposing internal details)
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: 'Unable to create exhibit record'
            });
        }
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

        const type = req.query.type;
        const uuid = req.params.exhibit_id;

        if (uuid === undefined || uuid.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (type === undefined) {
            const data = await EXHIBITS_MODEL.get_exhibit_record(uuid);
            res.status(data.status).send(data);
            return false;
        }

        if (type === 'edit') {

            const uid = req.query.uid;

            if (uid === undefined || uid.length === 0) {
                res.status(400).send('Bad request.');
                return false;
            }

            const data = await EXHIBITS_MODEL.get_exhibit_edit_record(uid, uuid);
            res.status(data.status).send(data);
            return false;
        }

    } catch (error) {
        res.status(500).send({message: `Unable to get exhibit record. ${error.message}`});
    }
};

/**
 * Updates an existing exhibit record
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.update_exhibit_record = async (req, res) => {

    try {

        const { exhibit_id: uuid } = req.params;

        // Validate UUID format (basic check - adjust regex as needed)
        if (!uuid || typeof uuid !== 'string' || uuid.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid exhibit ID is required'
            });
        }

        // Validate request body exists and contains data
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Request body with update data is required'
            });
        }

        // Check authorization
        const authOptions = {
            req,
            permissions: ['update_exhibit', 'update_any_exhibit'],
            record_type: 'exhibit',
            parent_id: uuid,
            child_id: null
        };

        const isAuthorized = await AUTHORIZE.check_permission(authOptions);

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized request'
            });
        }

        // Update exhibit record
        const result = await EXHIBITS_MODEL.update_exhibit_record(uuid, req.body);

        // Validate result structure
        if (!result || typeof result.status !== 'number') {
            throw new Error('Invalid response from model');
        }

        return res.status(result.status).json(result);

    } catch (error) {
        // Log detailed error internally
        LOGGER.module().error('ERROR: [/exhibits/controller (update_exhibit_record)]', {
            error: error.message,
            stack: error.stack,
            exhibitId: req.params.exhibit_id,
            userId: req.user?.id
        });

        // Send generic error to client
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: 'Unable to update exhibit record'
            });
        }
    }
};

exports.delete_exhibit_record = async function (req, res) {

    try {

        let uuid = req.params.exhibit_id;

        if (uuid === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const permissions = ['delete_exhibit', 'delete_any_exhibit'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'exhibit';
        options.parent_id = uuid;
        options.child_id = null;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

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

        const permissions = ['publish_exhibit', 'publish_any_exhibit'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'exhibit';
        options.parent_id = uuid;
        options.child_id = null;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

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

        const permissions = ['suppress_exhibit', 'suppress_any_exhibit'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'exhibit';
        options.parent_id = uuid;
        options.child_id = null;


        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const result = await EXHIBITS_MODEL.suppress_exhibit(uuid);

        if (result.status === true) {
            res.status(200).send({
                message: 'Exhibit suppressed.'
            });
        } else {
            res.status(200).send({
                message: 'Unable to suppress exhibit'
            });
        }

    } catch (error) {
        res.status(500).send({message: `Unable to suppress exhibit. ${error.message}`});
    }
}

exports.unlock_exhibit_record = async function (req, res) {

    try {

        const uuid = req.params.exhibit_id;
        const uid = req.query.uid;

        if (uuid === undefined || uuid.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (uid === undefined || uid.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        // TODO: permission check
        // TODO: add permissions for all to unlock
        const permissions = ['update_exhibit', 'update_any_exhibit'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'exhibit';
        options.parent_id = uuid;
        options.child_id = null;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const result = await EXHIBITS_MODEL.unlock_exhibit_record(uid, uuid);

        if (result === true) {
            res.status(200).send({
                message: 'Exhibit record unlocked.'
            });
        } else {
            res.status(400).send({
                message: 'Unable to unlock exhibit record'
            });
        }

    } catch (error) {
        res.status(500).send({message: `Unable to unlock exhibit record. ${error.message}`});
    }
};

exports.verify = function (req, res) {
    res.status(200).send({
        message: 'Token Verified'
    });
};

// TODO: deprecate - we no longer reorder exhibits
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

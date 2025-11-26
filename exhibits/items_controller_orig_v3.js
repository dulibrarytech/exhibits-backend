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
const PATH = require('path');
const STORAGE_CONFIG = require('../config/storage_config')();
const ITEMS_MODEL = require('../exhibits/items_model');
const HEADINGS_MODEL = require('../exhibits/headings_model');
const GRIDS_MODEL = require('../exhibits/grid_model');
const TIMELINES_MODEL = require('../exhibits/timelines_model');
const EXHIBITS_MODEL = require('./exhibits_model');
const LOGGER = require('../libs/log4');
const AUTHORIZE = require('../auth/authorize');

exports.create_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const data = req.body;

        // Validate required inputs with comprehensive checks
        if (!exhibit_id || typeof exhibit_id !== 'string' || exhibit_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid exhibit ID.'
            });
            return;
        }

        if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
            res.status(400).send({
                message: 'Bad request. Missing or invalid item data.'
            });
            return;
        }

        // Use object literal for efficiency
        const auth_options = {
            req,
            permissions: ['add_item', 'add_item_to_any_exhibit'],
            record_type: 'item',
            parent_id: exhibit_id,
            child_id: null
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (is_authorized !== true) {
            res.status(403).send({
                message: 'Unauthorized request'
            });
            return;
        }

        const result = await ITEMS_MODEL.create_item_record(exhibit_id, data);
        res.status(result.status).send(result);

    } catch (error) {
        // Do not expose internal error details to client
        res.status(500).send({
            message: 'Unable to create item record.'
        });
    }
};

exports.get_item_records = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;

        // Validate required path parameter
        if (!exhibit_id || typeof exhibit_id !== 'string' || exhibit_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid exhibit ID.'
            });
            return;
        }

        const data = await ITEMS_MODEL.get_item_records(exhibit_id);
        res.status(data.status).send(data);

    } catch (error) {
        LOGGER.module().error('ERROR: Unable to get item records for exhibit ' + req.params.exhibit_id + ': ' + error.message);
        res.status(500).send({
            message: 'Unable to get item records.'
        });
    }
};

exports.get_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const type = req.query.type;

        // Validate required path parameters
        if (!exhibit_id || typeof exhibit_id !== 'string' || exhibit_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid exhibit ID.'
            });
            return;
        }

        if (!item_id || typeof item_id !== 'string' || item_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid item ID.'
            });
            return;
        }

        // Default: return standard item record
        if (type === undefined || type === null) {
            const data = await ITEMS_MODEL.get_item_record(exhibit_id, item_id);
            res.status(data.status).send(data);
            return;
        }

        // Edit mode: requires additional uid parameter
        if (type === 'edit') {
            const uid = req.query.uid;

            if (!uid || typeof uid !== 'string' || uid.trim() === '') {
                res.status(400).send({
                    message: 'Bad request. Missing or invalid user ID for edit mode.'
                });
                return;
            }

            const data = await ITEMS_MODEL.get_item_edit_record(uid, exhibit_id, item_id);
            res.status(data.status).send(data);
            return;
        }

        // Reject unrecognized type values
        res.status(400).send({
            message: 'Bad request. Invalid type parameter.'
        });

    } catch (error) {
        res.status(500).send({
            message: 'Unable to get item record.'
        });
    }
};

exports.update_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const data = req.body;

        // Validate required path parameters
        if (!exhibit_id || typeof exhibit_id !== 'string' || exhibit_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid exhibit ID.'
            });
            return;
        }

        if (!item_id || typeof item_id !== 'string' || item_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid item ID.'
            });
            return;
        }

        // Validate request body
        if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
            res.status(400).send({
                message: 'Bad request. Missing or invalid item data.'
            });
            return;
        }

        // Check authorization
        const auth_options = {
            req,
            permissions: ['update_item', 'update_any_item'],
            record_type: 'item',
            parent_id: exhibit_id,
            child_id: item_id
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (is_authorized !== true) {
            res.status(403).send({
                message: 'Unauthorized request'
            });
            return;
        }

        const result = await ITEMS_MODEL.update_item_record(exhibit_id, item_id, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({
            message: 'Unable to update item record.'
        });
    }
};

exports.delete_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const record_type = req.query.type;

        // Validate required path parameters
        if (!exhibit_id || typeof exhibit_id !== 'string' || exhibit_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid exhibit ID.'
            });
            return;
        }

        if (!item_id || typeof item_id !== 'string' || item_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid item ID.'
            });
            return;
        }

        // Validate record type if provided
        const valid_record_types = ['item', 'grid', 'media'];

        if (record_type !== undefined && (typeof record_type !== 'string' || !valid_record_types.includes(record_type))) {
            res.status(400).send({
                message: 'Bad request. Invalid record type.'
            });
            return;
        }

        // Check authorization
        const auth_options = {
            req,
            permissions: ['delete_item', 'delete_any_item'],
            record_type: record_type || 'item',
            parent_id: exhibit_id,
            child_id: item_id
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (is_authorized !== true) {
            res.status(403).send({
                message: 'Unauthorized request'
            });
            return;
        }

        const result = await ITEMS_MODEL.delete_item_record(exhibit_id, item_id, record_type);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({
            message: 'Unable to delete item record.'
        });
    }
};

exports.delete_item_media = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const media = req.params.media;
        const type = req.query.type;

        // Validate required path parameters
        if (!exhibit_id || typeof exhibit_id !== 'string' || exhibit_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid exhibit ID.'
            });
            return;
        }

        if (!item_id || typeof item_id !== 'string' || item_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid item ID.'
            });
            return;
        }

        if (!media || typeof media !== 'string' || media.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid media filename.'
            });
            return;
        }

        // Prevent path traversal attacks
        const safe_exhibit_id = PATH.basename(exhibit_id);
        const safe_media = PATH.basename(media);

        if (safe_exhibit_id !== exhibit_id || safe_media !== media) {
            res.status(400).send({
                message: 'Bad request. Invalid path characters.'
            });
            return;
        }

        // Build and verify file path is within storage directory
        const file_path = PATH.join(STORAGE_CONFIG.storage_path, safe_exhibit_id, safe_media);
        const resolved_path = PATH.resolve(file_path);
        const storage_root = PATH.resolve(STORAGE_CONFIG.storage_path);

        if (!resolved_path.startsWith(storage_root + PATH.sep)) {
            res.status(400).send({
                message: 'Bad request. Invalid file path.'
            });
            return;
        }

        // Delete database record first, then file
        await ITEMS_MODEL.delete_media_value(item_id, media, type);
        await FS.promises.unlink(resolved_path);

        res.status(204).send();

    } catch (error) {
        // Handle file not found gracefully
        if (error.code === 'ENOENT') {
            res.status(404).send({
                message: 'Media file not found.'
            });
            return;
        }

        res.status(500).send({
            message: 'Unable to delete item media file.'
        });
    }
};

exports.publish_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const type = req.query.type;

        // Validate required path parameters
        if (!exhibit_id || typeof exhibit_id !== 'string' || exhibit_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid exhibit ID.'
            });
            return;
        }

        if (!item_id || typeof item_id !== 'string' || item_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid item ID.'
            });
            return;
        }

        // Define publish handlers map
        const publish_handlers = {
            item: ITEMS_MODEL.publish_item_record,
            heading: HEADINGS_MODEL.publish_heading_record,
            grid: GRIDS_MODEL.publish_grid_record,
            timeline: TIMELINES_MODEL.publish_timeline_record
        };

        // Validate type parameter against whitelist
        if (!type || typeof type !== 'string' || !Object.hasOwn(publish_handlers, type)) {
            res.status(400).send({
                message: 'Bad request. Missing or invalid type parameter.'
            });
            return;
        }

        // Check authorization
        const auth_options = {
            req,
            permissions: ['publish_item', 'publish_any_item'],
            record_type: type,
            parent_id: exhibit_id,
            child_id: item_id
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (is_authorized !== true) {
            res.status(403).send({
                message: 'Unauthorized request'
            });
            return;
        }

        // Execute the appropriate publish handler
        const result = await publish_handlers[type](exhibit_id, item_id);
        console.log('RESULT ', result);
        if (result.status === true) {
            res.status(200).send({
                message: 'Item published.'
            });
        } else {
            res.status(422).send({
                message: result.message
            });
        }

    } catch (error) {
        res.status(500).send({
            message: 'Unable to publish item record.'
        });
    }
};

exports.suppress_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const type = req.query.type;

        // Validate required path parameters
        if (!exhibit_id || typeof exhibit_id !== 'string' || exhibit_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid exhibit ID.'
            });
            return;
        }

        if (!item_id || typeof item_id !== 'string' || item_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid item ID.'
            });
            return;
        }

        // Define suppress handlers map
        const suppress_handlers = {
            item: ITEMS_MODEL.suppress_item_record,
            heading: HEADINGS_MODEL.suppress_heading_record,
            grid: GRIDS_MODEL.suppress_grid_record,
            timeline: TIMELINES_MODEL.suppress_timeline_record
        };

        // Validate type parameter against whitelist
        if (!type || typeof type !== 'string' || !Object.hasOwn(suppress_handlers, type)) {
            res.status(400).send({
                message: 'Bad request. Missing or invalid type parameter.'
            });
            return;
        }

        // Check authorization
        const auth_options = {
            req,
            permissions: ['suppress_item', 'suppress_any_item'],
            record_type: type,
            parent_id: exhibit_id,
            child_id: item_id
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (is_authorized !== true) {
            res.status(403).send({
                message: 'Unauthorized request'
            });
            return;
        }

        // Execute the appropriate suppress handler
        const result = await suppress_handlers[type](exhibit_id, item_id);

        if (result.status === true) {
            res.status(200).send({
                message: 'Item suppressed.'
            });
        } else {
            res.status(422).send({
                message: 'Unable to suppress item.'
            });
        }

    } catch (error) {
        res.status(500).send({
            message: 'Unable to suppress item record.'
        });
    }
};

exports.get_repo_item_record = async function (req, res) {

    try {

        const uuid = req.params.uuid;

        // Validate required path parameter
        if (!uuid || typeof uuid !== 'string' || uuid.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid UUID.'
            });
            return;
        }

        // Fetch item record and thumbnail in parallel
        const [response, thumbnail] = await Promise.all([
            ITEMS_MODEL.get_repo_item_record(uuid),
            ITEMS_MODEL.get_repo_tn(uuid)
        ]);

        // Validate response structure
        if (!response || typeof response !== 'object' || !response.data) {
            res.status(404).send({
                message: 'Repo item not found.'
            });
            return;
        }

        // Replace thumbnail in response data
        response.data.thumbnail = thumbnail;

        if (response.status === 200) {
            res.status(200).send({
                message: 'Repo item metadata retrieved.',
                data: response.data
            });
        } else {
            res.status(404).send({
                message: 'Unable to get repo item metadata.'
            });
        }

    } catch (error) {
        res.status(500).send({
            message: 'Unable to get repo item record.'
        });
    }
};

exports.get_kaltura_item_record = async function (req, res) {

    try {

        const entry_id = req.params.entry_id;

        // Validate required path parameter
        if (!entry_id || typeof entry_id !== 'string' || entry_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid entry ID.'
            });
            return;
        }

        // Kaltura media type mapping (video and audio only)
        // https://developer.kaltura.com/api-docs/service/media/action/get
        const media_type_map = {
            1: 'video',
            5: 'audio'
        };

        // Promisify the callback-based model method
        const response = await new Promise((resolve, reject) => {
            ITEMS_MODEL.get_kaltura_item_record(entry_id, (result) => {
                if (result && result.objectType === 'KalturaAPIException') {
                    reject(new Error(result.message || 'Kaltura API error'));
                    return;
                }
                resolve(result);
            });
        });

        // Validate response has required media type
        if (!response || response.mediaType === undefined) {
            res.status(404).send({
                message: 'Unable to get Kaltura item metadata.'
            });
            return;
        }

        // Look up item type from media type (video and audio only)
        const item_type = media_type_map[response.mediaType];

        if (!item_type) {
            res.status(422).send({
                message: 'Unsupported media type. Only video and audio are supported.'
            });
            return;
        }

        res.status(200).send({
            message: 'Kaltura item metadata retrieved.',
            data: {
                entry_id: response.id,
                item_type: item_type,
                title: response.name || '',
                description: response.description || '',
                thumbnail: response.thumbnailUrl || ''
            }
        });

    } catch (error) {
        res.status(500).send({
            message: 'Unable to get Kaltura item record.'
        });
    }
};

exports.reorder_items = async function (req, res) {
    console.log('Reordering items...');
    try {

        const exhibit_id = req.params.exhibit_id;
        const updated_order = req.body;

        // Validate required path parameter
        if (!exhibit_id || typeof exhibit_id !== 'string' || exhibit_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid exhibit ID.'
            });
            return;
        }

        // Validate request body is a non-empty array
        if (!Array.isArray(updated_order) || updated_order.length === 0) {
            res.status(400).send({
                message: 'Bad request. Missing or invalid order data.'
            });
            return;
        }

        // Define reorder handlers
        const reorder_handlers = {
            item: (item) => ITEMS_MODEL.reorder_items(exhibit_id, item),
            grid: (item) => GRIDS_MODEL.reorder_grids(exhibit_id, item),
            heading: (item) => HEADINGS_MODEL.reorder_headings(exhibit_id, item),
            timeline: (item) => TIMELINES_MODEL.reorder_timelines(exhibit_id, item),
            griditem: (item) => {
                const { grid_id, ...item_data } = item;
                return GRIDS_MODEL.reorder_grid_items(grid_id, item_data);
            }
        };

        const valid_types = Object.keys(reorder_handlers);
        console.log('VALID TYPES ', valid_types);
        console.log('UPDATED ORDER ', updated_order);
        // Validate all items before processing
        for (const item of updated_order) {

            console.log('ITEM ', item);
            console.log('ITEM TYPE ', item.type);

            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                res.status(400).send({
                    message: 'Bad request. Invalid item in order data.'
                });
                return;
            }

            if (!item.type || typeof item.type !== 'string' || !valid_types.includes(item.type)) {
                res.status(400).send({
                    message: 'Bad request. Missing or invalid item type.'
                });
                return;
            }

            if (item.type === 'griditem' && (!item.grid_id || typeof item.grid_id !== 'string' || item.grid_id.trim() === '')) {
                res.status(400).send({
                    message: 'Bad request. Missing or invalid grid ID for grid item.'
                });
                return;
            }
        }

        // Process reorder operations
        let error_count = 0;

        for (const item of updated_order) {
            const handler = reorder_handlers[item.type];
            const is_reordered = await handler(item);

            if (!is_reordered) {
                error_count++;
            }
        }

        if (error_count > 0) {
            res.status(422).send({
                message: 'Unable to reorder some exhibit items.'
            });
            return;
        }

        // Handle republishing if exhibit is published
        const exhibit_data = await EXHIBITS_MODEL.get_exhibit_record(exhibit_id);

        if (exhibit_data.data && exhibit_data.data.is_published === 1) {
            const suppress_result = await EXHIBITS_MODEL.suppress_exhibit(exhibit_id);

            if (suppress_result.status === true) {

                setTimeout(async () => {
                    try {
                        const publish_result = await EXHIBITS_MODEL.publish_exhibit(exhibit_id);

                        if (publish_result.status === true) {
                            LOGGER.module().info('INFO: [/items/controller (reorder_items)] Exhibit re-published successfully.');
                        } else {
                            LOGGER.module().error('ERROR: [/items/controller (reorder_items)] Failed to re-publish exhibit.');
                        }
                    } catch (publish_error) {
                        LOGGER.module().error('ERROR: [/items/controller (reorder_items)] Re-publish exception: ' + publish_error.message);
                    }
                }, 5000);
            }
        }

        res.status(201).send({
            message: 'Exhibit items reordered.'
        });

    } catch (error) {
        console.error('ERROR ', error);
        res.status(500).send({
            message: 'Unable to reorder items.'
        });
    }
};

exports.unlock_item_record = async function (req, res) {
    try {
        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const uid = req.query.uid;
        const force = req.query.force;

        // Validate required path parameters
        if (!exhibit_id || typeof exhibit_id !== 'string' || exhibit_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid exhibit ID.'
            });
            return;
        }

        if (!item_id || typeof item_id !== 'string' || item_id.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid item ID.'
            });
            return;
        }

        // Validate required query parameter
        if (!uid || typeof uid !== 'string' || uid.trim() === '') {
            res.status(400).send({
                message: 'Bad request. Missing or invalid user ID.'
            });
            return;
        }

        // Build unlock options
        const unlock_options = {
            force: force === 'true'
        };

        const result = await ITEMS_MODEL.unlock_item_record(uid, item_id, unlock_options);

        if (result && typeof result === 'object') {
            res.status(200).send({
                message: 'Item record unlocked.'
            });
        } else {
            res.status(422).send({
                message: 'Unable to unlock item record.'
            });
        }

    } catch (error) {
        res.status(500).send({
            message: 'Unable to unlock item record.'
        });
    }
};

exports.get_item_subjects = async function (req, res) {

    try {

        const subjects = await ITEMS_MODEL.get_item_subjects();

        if (!subjects) {
            res.status(404).send({
                message: 'No item subjects found.'
            });
            return;
        }

        res.status(200).send({
            message: 'Item subjects retrieved.',
            data: subjects
        });

    } catch (error) {
        res.status(500).send({
            message: 'Unable to get item subjects.'
        });
    }
};

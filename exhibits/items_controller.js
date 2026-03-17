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
const {
    validate_param,
    validate_body,
    check_authorization,
    handle_error
} = require('../exhibits/items_helper');

exports.create_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const data = req.body;

        if (!validate_param(res, exhibit_id, 'exhibit ID')) return;
        if (!validate_body(res, data, 'item data')) return;

        const is_authorized = await check_authorization(
            req, res,
            ['add_item', 'add_item_to_any_exhibit'],
            'item', exhibit_id, null
        );
        if (!is_authorized) return;

        const result = await ITEMS_MODEL.create_item_record(exhibit_id, data);
        res.status(result.status).send(result);

    } catch (error) {
        handle_error(res, 'create_item_record', error,
            'Unable to create item record.',
            'for exhibit ' + req.params.exhibit_id);
    }
};

exports.get_item_records = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;

        if (!validate_param(res, exhibit_id, 'exhibit ID')) return;

        const data = await ITEMS_MODEL.get_item_records(exhibit_id);
        res.status(data.status).send(data);

    } catch (error) {
        handle_error(res, 'get_item_records', error,
            'Unable to get item records.',
            'for exhibit ' + req.params.exhibit_id);
    }
};

exports.get_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const type = req.query.type;

        if (!validate_param(res, exhibit_id, 'exhibit ID')) return;
        if (!validate_param(res, item_id, 'item ID')) return;

        // Default: return standard item record
        if (type === undefined || type === null) {
            const data = await ITEMS_MODEL.get_item_record(exhibit_id, item_id);
            res.status(data.status).send(data);
            return;
        }

        // Edit mode: requires additional uid parameter
        if (type === 'edit') {
            const uid = req.query.uid;

            if (!validate_param(res, uid, 'user ID for edit mode')) return;

            const data = await ITEMS_MODEL.get_item_edit_record(uid, exhibit_id, item_id);
            res.status(data.status).send(data);
            return;
        }

        // Reject unrecognized type values
        res.status(400).send({
            message: 'Bad request. Invalid type parameter.'
        });

    } catch (error) {
        handle_error(res, 'get_item_record', error,
            'Unable to get item record.',
            req.params.item_id + ' for exhibit ' + req.params.exhibit_id);
    }
};

exports.update_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const data = req.body;

        if (!validate_param(res, exhibit_id, 'exhibit ID')) return;
        if (!validate_param(res, item_id, 'item ID')) return;
        if (!validate_body(res, data, 'item data')) return;

        const is_authorized = await check_authorization(
            req, res,
            ['update_item', 'update_any_item'],
            'item', exhibit_id, item_id
        );
        if (!is_authorized) return;

        const result = await ITEMS_MODEL.update_item_record(exhibit_id, item_id, data);
        res.status(result.status).send(result);

    } catch (error) {
        handle_error(res, 'update_item_record', error,
            'Unable to update item record.',
            req.params.item_id + ' for exhibit ' + req.params.exhibit_id);
    }
};

exports.delete_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const record_type = req.query.type;

        if (!validate_param(res, exhibit_id, 'exhibit ID')) return;
        if (!validate_param(res, item_id, 'item ID')) return;

        // Validate record type if provided
        /* TODO: determine record types
        const valid_record_types = ['item', 'grid', 'heading'];

        if (record_type !== undefined && (typeof record_type !== 'string' || !valid_record_types.includes(record_type))) {
            res.status(400).send({
                message: 'Bad request. Invalid record type.'
            });
            return;
        }

         */

        const is_authorized = await check_authorization(
            req, res,
            ['delete_item', 'delete_any_item'],
            record_type || 'item', exhibit_id, item_id
        );
        if (!is_authorized) return;

        const result = await ITEMS_MODEL.delete_item_record(exhibit_id, item_id, record_type);
        res.status(result.status).send(result);

    } catch (error) {
        handle_error(res, 'delete_item_record', error,
            'Unable to delete item record.',
            req.params.item_id + ' for exhibit ' + req.params.exhibit_id);
    }
};

exports.delete_item_media = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const media = req.params.media;
        const type = req.query.type;

        if (!validate_param(res, exhibit_id, 'exhibit ID')) return;
        if (!validate_param(res, item_id, 'item ID')) return;
        if (!validate_param(res, media, 'media filename')) return;

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
            LOGGER.module().warn('WARN: [/items/controller (delete_item_media)] Media file not found: ' + req.params.media + ' for item ' + req.params.item_id);
            res.status(404).send({
                message: 'Media file not found.'
            });
            return;
        }

        handle_error(res, 'delete_item_media', error,
            'Unable to delete item media file.',
            req.params.media + ' for item ' + req.params.item_id);
    }
};

exports.publish_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const type = req.query.type;

        if (!validate_param(res, exhibit_id, 'exhibit ID')) return;
        if (!validate_param(res, item_id, 'item ID')) return;

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

        const is_authorized = await check_authorization(
            req, res,
            ['publish_item', 'publish_any_item'],
            type, exhibit_id, item_id
        );
        if (!is_authorized) return;

        // Execute the appropriate publish handler
        const result = await publish_handlers[type](exhibit_id, item_id);

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
        handle_error(res, 'publish_item_record', error,
            'Unable to publish item record.',
            req.params.item_id + ' for exhibit ' + req.params.exhibit_id);
    }
};

exports.suppress_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const type = req.query.type;

        if (!validate_param(res, exhibit_id, 'exhibit ID')) return;
        if (!validate_param(res, item_id, 'item ID')) return;

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

        const is_authorized = await check_authorization(
            req, res,
            ['suppress_item', 'suppress_any_item'],
            type, exhibit_id, item_id
        );
        if (!is_authorized) return;

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
        handle_error(res, 'suppress_item_record', error,
            'Unable to suppress item record.',
            req.params.item_id + ' for exhibit ' + req.params.exhibit_id);
    }
};

// TODO: deprecate - moved to media library module
exports.get_repo_item_record = async function (req, res) {

    try {

        const uuid = req.params.uuid;

        if (!validate_param(res, uuid, 'UUID')) return;

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
        handle_error(res, 'get_repo_item_record', error,
            'Unable to get repo item record.',
            req.params.uuid);
    }
};

// TODO: Deprecate - move to media library module
exports.get_kaltura_item_record = async function (req, res) {

    try {

        const entry_id = req.params.entry_id;

        if (!validate_param(res, entry_id, 'entry ID')) return;

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
        handle_error(res, 'get_kaltura_item_record', error,
            'Unable to get Kaltura item record.',
            req.params.entry_id);
    }
};

exports.reorder_items = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const updated_order = req.body;

        if (!validate_param(res, exhibit_id, 'exhibit ID')) return;

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
                const {grid_id, ...item_data} = item;
                return GRIDS_MODEL.reorder_grid_items(grid_id, item_data);
            }
        };

        const valid_types = Object.keys(reorder_handlers);

        // Validate all items before processing
        for (const item of updated_order) {

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

        res.status(200).send({
            message: 'Exhibit items reordered.'
        });

    } catch (error) {
        handle_error(res, 'reorder_items', error,
            'Unable to reorder items.',
            'for exhibit ' + req.params.exhibit_id);
    }
};

exports.unlock_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const uid = req.query.uid;
        const force = req.query.force;

        if (!validate_param(res, exhibit_id, 'exhibit ID')) return;
        if (!validate_param(res, item_id, 'item ID')) return;
        if (!validate_param(res, uid, 'user ID')) return;

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
        handle_error(res, 'unlock_item_record', error,
            'Unable to unlock item record.',
            req.params.item_id + ' for user ' + req.query.uid);
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
        handle_error(res, 'get_item_subjects', error,
            'Unable to get item subjects.');
    }
};

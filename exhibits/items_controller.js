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

const STORAGE_CONFIG = require('../config/storage_config')();
const ITEMS_MODEL = require('../exhibits/items_model');
const HEADINGS_MODEL = require('../exhibits/headings_model');
const GRIDS_MODEL = require('../exhibits/grid_model');
const TIMELINES_MODEL = require('../exhibits/timelines_model');
const FS = require('fs');
const EXHIBITS_MODEL = require("./exhibits_model");
const LOGGER = require("../libs/log4");
const AUTHORIZE = require("../auth/authorize");

exports.create_item_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const data = req.body;

        if (data === undefined || is_member_of_exhibit === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const result = await ITEMS_MODEL.create_item_record(is_member_of_exhibit, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to create item record. ${error.message}`});
    }
};

exports.get_item_records = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const data = await ITEMS_MODEL.get_item_records(is_member_of_exhibit);
        res.status(data.status).send(data);

    } catch (error) {
        res.status(500).send({message: `Unable to get item records. ${error.message}`});
    }
};

exports.get_item_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const uuid = req.params.item_id;
        const type = req.query.type;

        if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (type === undefined) {
            const data = await ITEMS_MODEL.get_item_record(is_member_of_exhibit, uuid);
            res.status(data.status).send(data);
            return false;
        }

        if (type === 'edit') {

            const uid = req.query.uid;

            if (uid === undefined || uid.length === 0) {
                res.status(400).send('Bad request.');
                return false;
            }

            const data = await ITEMS_MODEL.get_item_edit_record(uid, is_member_of_exhibit, uuid);
            res.status(data.status).send(data);
            return false;
        }

    } catch (error) {
        res.status(500).send({message: `Unable to get item record. ${error.message}`});
    }
};

exports.update_item_record = async function (req, res) {

    try {

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

        const result = await ITEMS_MODEL.update_item_record(is_member_of_exhibit, uuid, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to update item record. ${error.message}`});
    }
};

exports.delete_item_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const type = req.query.type;
        let record_type;

        if (item_id === undefined || item_id.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (type === 'heading') {
            record_type = 'heading_item';
        }

        if (type === 'item') {
            record_type = 'standard_item';
        }

        if (type === 'grid') {
            record_type = 'grid';
        }

        if (type === 'grid_item') {
            record_type = 'grid_item';
        }

        if (type === 'timeline') {
            record_type = 'timeline';
        }

        if (type === 'timeline_item') {
            record_type = 'timeline_item';
        }

        const permissions = ['delete_item', 'delete_any_item'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = record_type;
        options.uuid = is_member_of_exhibit;
        console.log(permissions);
        const is_authorized = await AUTHORIZE.check_permission(options);
        console.log(is_authorized);
        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const result = await ITEMS_MODEL.delete_item_record(is_member_of_exhibit, item_id, type);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to delete item record. ${error.message}`});
    }

};

exports.delete_item_media = function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const media = req.params.media;

        if (media !== undefined && media.length !== 0) {

            (async function () {
                await ITEMS_MODEL.delete_media_value(item_id, media);
            })();

            FS.unlinkSync(`${STORAGE_CONFIG.storage_path}/${exhibit_id}/${media}`);
            res.status(204).send('Media deleted');

        } else {
            res.status(200).send('Unable to delete media file');
        }

    } catch(error) {
        res.status(500).send({message: `Unable to delete item media file. ${error.message}`});
    }
};

exports.publish_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const type = req.query.type;
        let result;

        if (exhibit_id === undefined || exhibit_id.length === 0 && item_id === undefined || item_id.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (type === 'item') {
            result = await ITEMS_MODEL.publish_item_record(exhibit_id, item_id);
        } else if (type === 'heading') {
            result = await HEADINGS_MODEL.publish_heading_record(exhibit_id, item_id);
        } else if (type === 'grid') {
            result = await GRIDS_MODEL.publish_grid_record(exhibit_id, item_id);
        } else if (type === 'timeline') {
            result = await TIMELINES_MODEL.publish_timeline_record(exhibit_id, item_id);
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

    } catch (error) {
        res.status(500).send({message: `Unable to publish item record. ${error.message}`});
    }
};

exports.suppress_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const item_id = req.params.item_id;
        const type = req.query.type;
        let result;

        if (exhibit_id === undefined || exhibit_id.length === 0 && item_id === undefined || item_id.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (type === 'item') {
            result = await ITEMS_MODEL.suppress_item_record(exhibit_id, item_id);
        } else if (type === 'heading') {
            result = await HEADINGS_MODEL.suppress_heading_record(exhibit_id, item_id);
        } else if (type === 'grid') {
            result = await GRIDS_MODEL.suppress_grid_record(exhibit_id, item_id);
        } else if (type === 'timeline') {
            result = await TIMELINES_MODEL.suppress_timeline_record(exhibit_id, item_id);
        } else {

            res.status(204).send({
                message: 'Unable to suppress item'
            });

            return false;
        }

        if (result.status === true) {
            res.status(200).send({
                message: 'Item suppressed.'
            });
        } else if (result.status === false) {
            res.status(204).send({
                message: 'Unable to suppress item'
            });
        }

    } catch (error) {
        res.status(500).send({message: `Unable to suppress item record. ${error.message}`});
    }
};

exports.get_repo_item_record = async function (req, res) {

    try {

        const uuid = req.params.uuid;

        if (uuid.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        let response = await ITEMS_MODEL.get_repo_item_record(uuid);
        const tn = await ITEMS_MODEL.get_repo_tn(uuid);
        delete response.data.thumbnail;
        response.data.thumbnail = tn;

        if (response.status === 200) {

            res.status(200).send({
                message: 'Repo item metadata retrieved.',
                data: response.data
            });

        } else {
            res.status(204).send({
                message: 'Unable to get repo item metadata.',
                data: response.data
            });
        }

    } catch (error) {
        res.status(404).send({message: `Unable to get repo item record. ${error.message}`});
    }
};

exports.get_kaltura_item_record = function (req, res) {

    try {

        const entry_id = req.params.entry_id;

        if (entry_id.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        ITEMS_MODEL.get_kaltura_item_record(entry_id, (response) => {

            if (response.mediaType === undefined || response.mediaType.length === 0) {
                res.status(200).send({
                    message: 'Unable to get Kaltura item metadata.',
                    data: {
                        message: response
                    }
                });
                return false;
            }

            // https://developer.kaltura.com/api-docs/service/media/action/get
            // Enum: VIDEO [1], IMAGE [2], AUDIO [5],
            // LIVE_STREAM_FLASH [201], LIVE_STREAM_WINDOWS_MEDIA [202],
            // LIVE_STREAM_REAL_MEDIA [203], LIVE_STREAM_QUICKTIME [204]

            let item_type;
            let title = response.name;
            let description = response.description;
            let thumbnail = response.thumbnailUrl;

            if (response.mediaType === 1) {
                item_type = 'video';
            }

            if (response.mediaType === 5) {
                item_type = 'audio';
            }

            res.status(200).send({
                message: 'Kaltura item metadata retrieved.',
                data: {
                    entry_id: response.id,
                    item_type: item_type,
                    title: title,
                    description: description,
                    thumbnail: thumbnail
                }
            });

            return false;
        });

    } catch (error) {
        res.status(404).send({message: `Unable to get kaltura item record. ${error.message}`});
    }
};

exports.reorder_items = async function (req, res) {

    try {

        const id = req.params.exhibit_id;
        const updated_order = req.body;
        let ordered_errors = [];

        if (id.length === 0 || updated_order.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        for (let i=0;i<updated_order.length;i++) {

            if (updated_order[i].type === 'item') {

                let is_reordered = await ITEMS_MODEL.reorder_items(id, updated_order[i]);

                if (is_reordered === false) {
                    ordered_errors.push('-1');
                }
            }

            if (updated_order[i].type === 'grid') {

                let is_reordered = await GRIDS_MODEL.reorder_grids(id, updated_order[i]);

                if (is_reordered === false) {
                    ordered_errors.push('-1');
                }
            }

            if (updated_order[i].type === 'heading') {

                let is_reordered = await HEADINGS_MODEL.reorder_headings(id, updated_order[i]);

                if (is_reordered === false) {
                    ordered_errors.push('-1');
                }
            }

            if (updated_order[i].type === 'timeline') {

                let is_reordered = await TIMELINES_MODEL.reorder_timelines(id, updated_order[i]);

                if (is_reordered === false) {
                    ordered_errors.push('-1');
                }
            }

            if (updated_order[i].type === 'griditem') {

                let grid_id = updated_order[i].grid_id;
                delete updated_order[i].grid_id;
                let is_reordered = await GRIDS_MODEL.reorder_grid_items(grid_id, updated_order[i]);

                if (is_reordered === false) {
                    ordered_errors.push('-1');
                }
            }
        }

        if (ordered_errors.length === 0) {

            const data = await EXHIBITS_MODEL.get_exhibit_record(id);

            if (data.data[0].is_published === 1) {

                let is_suppressed= await EXHIBITS_MODEL.suppress_exhibit(id);

                if (is_suppressed.status === true) {

                    setTimeout(async () => {

                        const is_published = await EXHIBITS_MODEL.publish_exhibit(id);

                        if (is_published.status === true) {
                            LOGGER.module().info('INFO: [/exhibits/model (update_item_record)] Item re-published successfully.');
                        }

                    }, 5000);
                }
            }

            res.status(201).send({
                message: 'Exhibit items reordered.'
            });

        } else {
            res.status(204).send({
                message: 'Unable to reorder exhibit items.'
            });
        }

    } catch (error) {
        res.status(500).send({message: `Unable to reorder items. ${error.message}`});
    }
};

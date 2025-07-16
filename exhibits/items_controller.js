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

        // TODO: type=edit,index,title
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

        if (item_id === undefined || item_id.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
            res.status(400).send('Bad request.');
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
                message: 'Unable to get repo item metadata retrieved.',
                data: response.data
            });
        }

    } catch (error) {
        res.status(404).send({message: `Unable to get repo item record. ${error.message}`});
    }
};

exports.reorder_items = async function (req, res) {

    try {

        const id = req.params.exhibit_id;
        const updated_order = req.body;

        if (id.length === 0 || updated_order.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        let ordered_errors = [];

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

            if (updated_order[i].type === 'timelineitem') {

                let timeline_id = updated_order[i].timeline_id;
                delete updated_order[i].timeline_id;
                let is_reordered = await TIMELINES_MODEL.reorder_timeline_items(timeline_id, updated_order[i]);

                if (is_reordered === false) {
                    ordered_errors.push('-1');
                }
            }
        }

        if (ordered_errors.length === 0) {

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

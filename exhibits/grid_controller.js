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
const GRIDS_MODEL = require('../exhibits/grid_model');
const AUTHORIZE = require('../auth/authorize');

exports.create_grid_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const data = req.body;

        if (data === undefined || is_member_of_exhibit === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const permissions = ['add_item', 'add_item_to_any_exhibit'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'grid';
        options.parent_id = is_member_of_exhibit;
        options.child_id = null;

        const is_authorized = await AUTHORIZE.check_permission(options);
        console.log('is_authorized ', is_authorized);
        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const result = await GRIDS_MODEL.create_grid_record(is_member_of_exhibit, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to create grid item record. ${error.message}`});
    }
};

exports.update_grid_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const data = req.body;

        if (data === undefined || is_member_of_exhibit === undefined || grid_id === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const permissions = ['update_item', 'update_any_item'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'grid';
        options.parent_id = is_member_of_exhibit;
        options.child_id = grid_id;

        const is_authorized = await AUTHORIZE.check_permission(options);
        console.log('is_authorized ', is_authorized);
        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const result = await GRIDS_MODEL.update_grid_record(is_member_of_exhibit, grid_id, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to update grid item record. ${error.message}`});
    }
};

exports.get_grid_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const grid_id = req.params.grid_id;

        if (is_member_of_exhibit === undefined || grid_id === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const result = await GRIDS_MODEL.get_grid_record(is_member_of_exhibit, grid_id);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to get grid item record. ${error.message}`});
    }
};

exports.create_grid_item_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const data = req.body;

        if (is_member_of_exhibit === undefined || grid_id === undefined || data === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const permissions = ['add_item', 'add_item_to_any_exhibit'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'grid_item';
        options.parent_id = is_member_of_exhibit;
        options.child_id = grid_id;

        const is_authorized = await AUTHORIZE.check_permission(options);
        console.log('is_authorized ', is_authorized);
        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const result = await GRIDS_MODEL.create_grid_item_record(is_member_of_exhibit, grid_id, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to create grid item record. ${error.message}`});
    }
};

exports.get_grid_item_records = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const is_member_of_grid = req.params.grid_id;

        if (is_member_of_exhibit === undefined || is_member_of_grid === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const result = await GRIDS_MODEL.get_grid_item_records(is_member_of_exhibit, is_member_of_grid);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to get grid item records. ${error.message}`});
    }
};

exports.get_grid_item_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const is_member_of_grid = req.params.grid_id;
        const item_id = req.params.item_id;
        const type = req.query.type;

        if (is_member_of_exhibit === undefined || is_member_of_grid === undefined || item_id === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (type === undefined) {
            const result = await GRIDS_MODEL.get_grid_item_record(is_member_of_exhibit, is_member_of_grid, item_id);
            res.status(result.status).send(result);
            return false;
        }

        if (type === 'edit') {

            const uid = req.query.uid;

            if (uid === undefined || uid.length === 0) {
                res.status(400).send('Bad request.');
                return false;
            }

            const result = await GRIDS_MODEL.get_grid_item_edit_record(uid, is_member_of_exhibit, is_member_of_grid, item_id);
            res.status(result.status).send(result);
            return false;
        }

    } catch (error) {
        res.status(500).send({message: `Unable to get grid item. ${error.message}`});
    }
};

exports.update_grid_item_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const item_id = req.params.item_id;
        const data = req.body;

        if (data === undefined || is_member_of_exhibit === undefined || grid_id === undefined || item_id === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const permissions = ['update_item', 'update_any_item'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'grid_item';
        options.parent_id = is_member_of_exhibit;
        options.child_id = item_id;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const result = await GRIDS_MODEL.update_grid_item_record(is_member_of_exhibit, grid_id, item_id, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to update grid item. ${error.message}`});
    }
};

exports.delete_grid_item_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const grid_item_id = req.params.item_id;
        const record_type = req.query.type;

        if (grid_item_id === undefined || grid_item_id.length === 0 && grid_id === undefined || grid_id.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        const permissions = ['delete_item', 'delete_any_item'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = record_type;
        options.parent_id = is_member_of_exhibit;
        options.child_id = grid_item_id;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const result = await GRIDS_MODEL.delete_grid_item_record(is_member_of_exhibit, grid_id, grid_item_id, record_type);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to delete grid item. ${error.message}`});
    }
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
};

exports.publish_grid_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const grid_item_id = req.params.grid_item_id;
        const type = req.query.type;
        let result;

        if (exhibit_id === undefined || exhibit_id.length === 0 && grid_id === undefined || grid_id.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        const permissions = ['publish_item', 'publish_any_item'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'grid_item';
        options.parent_id = exhibit_id;
        options.child_id = grid_item_id;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        result = await GRIDS_MODEL.publish_grid_item_record(exhibit_id, grid_id, grid_item_id);

        if (result.status === true) {

            res.status(200).send({
                message: 'Grid item published.'
            });
        } else if (result.status === false) {
            res.status(204).send({
                message: 'Unable to publish grid item'
            });
        }

    } catch (error) {
        res.status(500).send({message: `Unable to publish grid item record. ${error.message}`});
    }
};

exports.suppress_grid_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const grid_item_id = req.params.grid_item_id;
        const type = req.query.type;
        let result;

        if (exhibit_id === undefined || exhibit_id.length === 0 && grid_id === undefined || grid_id.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        const permissions = ['suppress_item', 'suppress_any_item'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'grid_item';
        options.parent_id = exhibit_id;
        options.child_id = grid_item_id;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        result = await GRIDS_MODEL.suppress_grid_item_record(exhibit_id, grid_id, grid_item_id);

        if (result.status === true) {
            res.status(200).send({
                message: 'Item grid suppressed.'
            });
        } else if (result.status === false) {
            res.status(204).send({
                message: 'Unable to suppress grid item'
            });
        }

    } catch (error) {
        res.status(500).send({message: `Unable to suppress grid item record. ${error.message}`});
    }
};

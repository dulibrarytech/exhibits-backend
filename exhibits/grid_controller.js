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
const LOGGER = require('../libs/log4');
const {
    validate_id,
    validate_body,
    check_authorization,
    validate_model_result,
    handle_error
} = require('../exhibits/grid_helper');

exports.create_grid_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const data = req.body;

        if (!validate_id(res, exhibit_id, 'exhibit_id', 'create_grid_record')) return;
        if (!validate_body(res, data, 'create_grid_record', {exhibit_id})) return;

        const is_authorized = await check_authorization(
            req, res,
            ['add_item', 'add_item_to_any_exhibit'],
            'grid', exhibit_id, null,
            'create_grid_record', {exhibit_id}
        );
        if (!is_authorized) return;

        const result = await GRIDS_MODEL.create_grid_record(exhibit_id, data);

        if (!validate_model_result(res, result, 'create_grid_record', {exhibit_id})) return;

        LOGGER.module().info('create_grid_record: Grid record created successfully', {
            exhibit_id,
            status: result.status
        });

        return res.status(result.status).send(result);

    } catch (error) {
        return handle_error(res, 'create_grid_record', error,
            'Unable to create grid item record',
            {exhibit_id: req.params.exhibit_id});
    }
};

exports.update_grid_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const data = req.body;

        if (!validate_id(res, exhibit_id, 'exhibit_id', 'update_grid_record')) return;
        if (!validate_id(res, grid_id, 'grid_id', 'update_grid_record')) return;
        if (!validate_body(res, data, 'update_grid_record', {exhibit_id, grid_id})) return;

        const is_authorized = await check_authorization(
            req, res,
            ['update_item', 'update_any_item'],
            'grid', exhibit_id, grid_id,
            'update_grid_record', {exhibit_id, grid_id}
        );
        if (!is_authorized) return;

        const result = await GRIDS_MODEL.update_grid_record(exhibit_id, grid_id, data);

        if (!validate_model_result(res, result, 'update_grid_record', {exhibit_id, grid_id})) return;

        LOGGER.module().info('update_grid_record: Grid record updated successfully', {
            exhibit_id,
            grid_id,
            status: result.status
        });

        return res.status(result.status).send(result);

    } catch (error) {
        return handle_error(res, 'update_grid_record', error,
            'Unable to update grid item record',
            {exhibit_id: req.params.exhibit_id, grid_id: req.params.grid_id});
    }
};

exports.get_grid_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;

        if (!validate_id(res, exhibit_id, 'exhibit_id', 'get_grid_record')) return;
        if (!validate_id(res, grid_id, 'grid_id', 'get_grid_record')) return;

        const result = await GRIDS_MODEL.get_grid_record(exhibit_id, grid_id);

        if (!validate_model_result(res, result, 'get_grid_record', {exhibit_id, grid_id})) return;

        LOGGER.module().info('get_grid_record: Grid record retrieved successfully', {
            exhibit_id,
            grid_id,
            status: result.status
        });

        return res.status(result.status).send(result);

    } catch (error) {
        return handle_error(res, 'get_grid_record', error,
            'Unable to get grid record',
            {exhibit_id: req.params.exhibit_id, grid_id: req.params.grid_id});
    }
};

exports.create_grid_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const data = req.body;

        if (!validate_id(res, exhibit_id, 'exhibit_id', 'create_grid_item_record')) return;
        if (!validate_id(res, grid_id, 'grid_id', 'create_grid_item_record')) return;
        if (!validate_body(res, data, 'create_grid_item_record', {exhibit_id, grid_id})) return;

        const is_authorized = await check_authorization(
            req, res,
            ['add_item', 'add_item_to_any_exhibit'],
            'grid_item', exhibit_id, grid_id,
            'create_grid_item_record', {exhibit_id, grid_id}
        );
        if (!is_authorized) return;

        const result = await GRIDS_MODEL.create_grid_item_record(exhibit_id, grid_id, data);

        if (!validate_model_result(res, result, 'create_grid_item_record', {exhibit_id, grid_id})) return;

        LOGGER.module().info('create_grid_item_record: Grid item record created successfully', {
            exhibit_id,
            grid_id,
            status: result.status
        });

        return res.status(result.status).send(result);

    } catch (error) {
        return handle_error(res, 'create_grid_item_record', error,
            'Unable to create grid item record',
            {exhibit_id: req.params.exhibit_id, grid_id: req.params.grid_id});
    }
};

exports.get_grid_item_records = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;

        if (!validate_id(res, exhibit_id, 'exhibit_id', 'get_grid_item_records')) return;
        if (!validate_id(res, grid_id, 'grid_id', 'get_grid_item_records')) return;

        const result = await GRIDS_MODEL.get_grid_item_records(exhibit_id, grid_id);

        if (!validate_model_result(res, result, 'get_grid_item_records', {exhibit_id, grid_id})) return;

        LOGGER.module().info('get_grid_item_records: Grid item records retrieved successfully', {
            exhibit_id,
            grid_id,
            status: result.status,
            record_count: result.data?.length || 0
        });

        return res.status(result.status).send(result);

    } catch (error) {
        return handle_error(res, 'get_grid_item_records', error,
            'Unable to get grid item records',
            {exhibit_id: req.params.exhibit_id, grid_id: req.params.grid_id});
    }
};

exports.get_grid_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const item_id = req.params.item_id;
        const type = req.query.type;

        if (!validate_id(res, exhibit_id, 'exhibit_id', 'get_grid_item_record')) return;
        if (!validate_id(res, grid_id, 'grid_id', 'get_grid_item_record')) return;
        if (!validate_id(res, item_id, 'item_id', 'get_grid_item_record')) return;

        // Handle edit type request
        if (type === 'edit') {
            const uid = req.query.uid;

            if (!uid || uid.length === 0) {
                LOGGER.module().error('get_grid_item_record: Missing uid for edit type', {
                    exhibit_id, grid_id, item_id, type
                });
                return res.status(400).send({
                    message: 'Invalid request: uid is required for edit type'
                });
            }

            if (!validate_id(res, uid, 'uid', 'get_grid_item_record')) return;

            const result = await GRIDS_MODEL.get_grid_item_edit_record(uid, exhibit_id, grid_id, item_id);

            if (!validate_model_result(res, result, 'get_grid_item_record', {exhibit_id, grid_id, item_id, uid})) return;

            LOGGER.module().info('get_grid_item_record: Grid item edit record retrieved successfully', {
                exhibit_id, grid_id, item_id, uid, status: result.status
            });

            return res.status(result.status).send(result);
        }

        // Validate type parameter if provided
        if (type !== undefined && type !== 'edit') {
            LOGGER.module().error('get_grid_item_record: Invalid type parameter', {
                type, exhibit_id, grid_id, item_id
            });
            return res.status(400).send({
                message: 'Invalid type parameter. Allowed values: "edit"'
            });
        }

        // Handle standard request
        const result = await GRIDS_MODEL.get_grid_item_record(exhibit_id, grid_id, item_id);

        if (!validate_model_result(res, result, 'get_grid_item_record', {exhibit_id, grid_id, item_id})) return;

        LOGGER.module().info('get_grid_item_record: Grid item record retrieved successfully', {
            exhibit_id, grid_id, item_id, status: result.status
        });

        return res.status(result.status).send(result);

    } catch (error) {
        return handle_error(res, 'get_grid_item_record', error,
            'Unable to get grid item record',
            {
                exhibit_id: req.params.exhibit_id,
                grid_id: req.params.grid_id,
                item_id: req.params.item_id,
                type: req.query.type,
                uid: req.query.uid
            });
    }
};

exports.update_grid_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const item_id = req.params.item_id;
        const data = req.body;

        if (!validate_id(res, exhibit_id, 'exhibit_id', 'update_grid_item_record')) return;
        if (!validate_id(res, grid_id, 'grid_id', 'update_grid_item_record')) return;
        if (!validate_id(res, item_id, 'item_id', 'update_grid_item_record')) return;
        if (!validate_body(res, data, 'update_grid_item_record', {exhibit_id, grid_id, item_id})) return;

        const is_authorized = await check_authorization(
            req, res,
            ['update_item', 'update_any_item'],
            'grid_item', exhibit_id, item_id,
            'update_grid_item_record', {exhibit_id, grid_id, item_id}
        );
        if (!is_authorized) return;

        const result = await GRIDS_MODEL.update_grid_item_record(exhibit_id, grid_id, item_id, data);

        if (!validate_model_result(res, result, 'update_grid_item_record', {exhibit_id, grid_id, item_id})) return;

        LOGGER.module().info('update_grid_item_record: Grid item record updated successfully', {
            exhibit_id, grid_id, item_id, status: result.status
        });

        return res.status(result.status).send(result);

    } catch (error) {
        return handle_error(res, 'update_grid_item_record', error,
            'Unable to update grid item record',
            {exhibit_id: req.params.exhibit_id, grid_id: req.params.grid_id, item_id: req.params.item_id});
    }
};

exports.delete_grid_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const item_id = req.params.item_id;
        const record_type = req.query.type;

        if (!validate_id(res, exhibit_id, 'exhibit_id', 'delete_grid_item_record')) return;
        if (!validate_id(res, grid_id, 'grid_id', 'delete_grid_item_record')) return;
        if (!validate_id(res, item_id, 'item_id', 'delete_grid_item_record')) return;

        // Validate record_type if provided
        const valid_record_types = ['grid_item', 'grid', 'item'];
        if (record_type && !valid_record_types.includes(record_type)) {
            LOGGER.module().error('delete_grid_item_record: Invalid record_type', {
                record_type, valid_types: valid_record_types
            });
            return res.status(400).send({
                message: `Invalid record_type. Allowed values: ${valid_record_types.join(', ')}`
            });
        }

        const is_authorized = await check_authorization(
            req, res,
            ['delete_item', 'delete_any_item'],
            record_type || 'grid_item', exhibit_id, item_id,
            'delete_grid_item_record', {exhibit_id, grid_id, item_id, record_type}
        );
        if (!is_authorized) return;

        const result = await GRIDS_MODEL.delete_grid_item_record(exhibit_id, grid_id, item_id, record_type);

        if (!validate_model_result(res, result, 'delete_grid_item_record', {exhibit_id, grid_id, item_id, record_type})) return;

        LOGGER.module().info('delete_grid_item_record: Grid item record deleted successfully', {
            exhibit_id, grid_id, item_id, record_type, status: result.status
        });

        return res.status(result.status).send(result);

    } catch (error) {
        return handle_error(res, 'delete_grid_item_record', error,
            'Unable to delete grid item record',
            {
                exhibit_id: req.params.exhibit_id,
                grid_id: req.params.grid_id,
                item_id: req.params.item_id,
                record_type: req.query.type
            });
    }
};

exports.publish_grid_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const grid_item_id = req.params.grid_item_id;

        if (!validate_id(res, exhibit_id, 'exhibit_id', 'publish_grid_item_record')) return;
        if (!validate_id(res, grid_id, 'grid_id', 'publish_grid_item_record')) return;
        if (!validate_id(res, grid_item_id, 'grid_item_id', 'publish_grid_item_record')) return;

        const is_authorized = await check_authorization(
            req, res,
            ['publish_item', 'publish_any_item'],
            'grid_item', exhibit_id, grid_item_id,
            'publish_grid_item_record', {exhibit_id, grid_id, grid_item_id}
        );
        if (!is_authorized) return;

        const result = await GRIDS_MODEL.publish_grid_item_record(exhibit_id, grid_id, grid_item_id);

        if (!result.status) {
            LOGGER.module().error(`publish_grid_item_record: ${result.message}`, {
                exhibit_id, grid_id, grid_item_id, result
            });
            return res.status(500).send({
                message: result.message,
            });
        }

        LOGGER.module().info('publish_grid_item_record: Grid item record published successfully', {
            exhibit_id, grid_id, grid_item_id, status: 200
        });

        return res.status(200).send(result);

    } catch (error) {
        return handle_error(res, 'publish_grid_item_record', error,
            'Unable to publish grid item record',
            {
                exhibit_id: req.params.exhibit_id,
                grid_id: req.params.grid_id,
                grid_item_id: req.params.grid_item_id
            });
    }
};

exports.suppress_grid_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const grid_item_id = req.params.grid_item_id;

        if (!validate_id(res, exhibit_id, 'exhibit_id', 'suppress_grid_item_record')) return;
        if (!validate_id(res, grid_id, 'grid_id', 'suppress_grid_item_record')) return;
        if (!validate_id(res, grid_item_id, 'grid_item_id', 'suppress_grid_item_record')) return;

        const is_authorized = await check_authorization(
            req, res,
            ['suppress_item', 'suppress_any_item'],
            'grid_item', exhibit_id, grid_item_id,
            'suppress_grid_item_record', {exhibit_id, grid_id, grid_item_id}
        );
        if (!is_authorized) return;

        const result = await GRIDS_MODEL.suppress_grid_item_record(exhibit_id, grid_id, grid_item_id);
        console.log('SUPPRESS RESULT ', result);

        if (!result) {
            LOGGER.module().error('suppress_grid_item_record: Invalid response from database model', {
                exhibit_id, grid_id, grid_item_id, result
            });
            return res.status(500).send({
                message: 'Invalid response from database model'
            });
        }

        LOGGER.module().info('suppress_grid_item_record: Grid item record suppressed successfully', {
            exhibit_id, grid_id, grid_item_id, status: 200
        });

        return res.status(200).send(result);

    } catch (error) {
        return handle_error(res, 'suppress_grid_item_record', error,
            'Unable to suppress grid item record',
            {
                exhibit_id: req.params.exhibit_id,
                grid_id: req.params.grid_id,
                grid_item_id: req.params.grid_item_id
            });
    }
};

exports.unlock_grid_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const item_id = req.params.item_id;
        const uid = req.query.uid;
        const force = req.query.force;

        if (!validate_id(res, item_id, 'item_id', 'unlock_grid_item_record')) return;
        if (!validate_id(res, uid, 'uid', 'unlock_grid_item_record')) return;

        // Validate optional IDs if present
        if (exhibit_id && !validate_id(res, exhibit_id, 'exhibit_id', 'unlock_grid_item_record')) return;
        if (grid_id && !validate_id(res, grid_id, 'grid_id', 'unlock_grid_item_record')) return;

        // Validate force parameter
        if (force !== undefined && force !== 'true' && force !== 'false') {
            LOGGER.module().error('unlock_grid_item_record: Invalid force parameter', {force});
            return res.status(400).send({
                message: 'Invalid force parameter. Allowed values: "true" or "false"'
            });
        }

        // Prepare options
        const options = {
            force: force === 'true'
        };

        // TODO: Implement authorization check if needed
        /*
        const is_authorized = await check_authorization(
            req, res,
            ['update_any_item'],
            'grid_item', exhibit_id, item_id,
            'unlock_grid_item_record', {exhibit_id, grid_id, item_id, uid}
        );
        if (!is_authorized) return;
        */

        const result = await GRIDS_MODEL.unlock_grid_item_record(uid, item_id, options);

        if (typeof result === 'object') {
            LOGGER.module().info('unlock_grid_item_record: Grid item record unlocked successfully', {
                exhibit_id, grid_id, item_id, uid, force: options.force
            });
            return res.status(200).send({
                message: 'Grid item record unlocked'
            });
        }

        LOGGER.module().error('unlock_grid_item_record: Failed to unlock grid item record', {
            exhibit_id, grid_id, item_id, uid, force: options.force, result
        });
        return res.status(400).send({
            message: 'Unable to unlock grid item record'
        });

    } catch (error) {
        return handle_error(res, 'unlock_grid_item_record', error,
            'Unable to unlock grid item record',
            {
                exhibit_id: req.params.exhibit_id,
                grid_id: req.params.grid_id,
                item_id: req.params.item_id,
                uid: req.query.uid,
                force: req.query.force
            });
    }
};

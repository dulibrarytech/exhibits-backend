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
const AUTHORIZE = require('../auth/authorize');
const LOGGER = require('../libs/log4');

exports.create_grid_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const data = req.body;

        // Validate required parameters
        if (!exhibit_id || !data || typeof data !== 'object' || Object.keys(data).length === 0) {
            LOGGER.module().error('create_grid_record: Invalid request parameters', {
                exhibit_id,
                has_data: !!data,
                data_type: typeof data
            });
            return res.status(400).send({
                message: 'Invalid request: exhibit_id and data are required'
            });
        }

        // Validate exhibit_id format (prevents injection attacks)
        if (!/^[a-zA-Z0-9_-]+$/.test(exhibit_id)) {
            LOGGER.module().error('create_grid_record: Invalid exhibit_id format', {
                exhibit_id
            });
            return res.status(400).send({
                message: 'Invalid exhibit_id format'
            });
        }

        // Check authorization
        const auth_options = {
            req,
            permissions: ['add_item', 'add_item_to_any_exhibit'],
            record_type: 'grid',
            parent_id: exhibit_id,
            child_id: null
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (!is_authorized) {
            LOGGER.module().error('create_grid_record: Unauthorized attempt', {
                exhibit_id,
                user_id: req.user?.id,
                permissions: auth_options.permissions
            });
            return res.status(403).send({
                message: 'Unauthorized request'
            });
        }

        // Create grid record
        const result = await GRIDS_MODEL.create_grid_record(exhibit_id, data);

        // Validate result from model
        if (!result || typeof result.status !== 'number') {
            LOGGER.module().error('create_grid_record: Invalid response from database model', {
                exhibit_id,
                result
            });
            return res.status(500).send({
                message: 'Invalid response from database model'
            });
        }

        LOGGER.module().info('create_grid_record: Grid record created successfully', {
            exhibit_id,
            status: result.status
        });

        return res.status(result.status).send(result);

    } catch (error) {
        LOGGER.module().error('create_grid_record: Error creating grid record', {
            error: error.message,
            stack: error.stack,
            exhibit_id: req.params.exhibit_id
        });
        return res.status(500).send({
            message: 'Unable to create grid item record',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.update_grid_record = async function (req, res) {
    try {
        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const data = req.body;

        // Validate required parameters
        if (!exhibit_id || !grid_id || !data || typeof data !== 'object' || Object.keys(data).length === 0) {
            LOGGER.module().error('update_grid_record: Invalid request parameters', {
                exhibit_id,
                grid_id,
                has_data: !!data,
                data_type: typeof data
            });
            return res.status(400).send({
                message: 'Invalid request: exhibit_id, grid_id, and data are required'
            });
        }

        // Validate ID formats (prevents injection attacks)
        if (!/^[a-zA-Z0-9_-]+$/.test(exhibit_id)) {
            LOGGER.module().error('update_grid_record: Invalid exhibit_id format', {
                exhibit_id
            });
            return res.status(400).send({
                message: 'Invalid exhibit_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(grid_id)) {
            LOGGER.module().error('update_grid_record: Invalid grid_id format', {
                grid_id
            });
            return res.status(400).send({
                message: 'Invalid grid_id format'
            });
        }

        // Check authorization
        const auth_options = {
            req,
            permissions: ['update_item', 'update_any_item'],
            record_type: 'grid',
            parent_id: exhibit_id,
            child_id: grid_id
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (!is_authorized) {
            LOGGER.module().error('update_grid_record: Unauthorized attempt', {
                exhibit_id,
                grid_id,
                user_id: req.user?.id,
                permissions: auth_options.permissions
            });
            return res.status(403).send({
                message: 'Unauthorized request'
            });
        }

        // Update grid record
        const result = await GRIDS_MODEL.update_grid_record(exhibit_id, grid_id, data);

        // Validate result from model
        if (!result || typeof result.status !== 'number') {
            LOGGER.module().error('update_grid_record: Invalid response from database model', {
                exhibit_id,
                grid_id,
                result
            });
            return res.status(500).send({
                message: 'Invalid response from database model'
            });
        }

        LOGGER.module().info('update_grid_record: Grid record updated successfully', {
            exhibit_id,
            grid_id,
            status: result.status
        });

        return res.status(result.status).send(result);

    } catch (error) {
        LOGGER.module().error('update_grid_record: Error updating grid record', {
            error: error.message,
            stack: error.stack,
            exhibit_id: req.params.exhibit_id,
            grid_id: req.params.grid_id
        });
        return res.status(500).send({
            message: 'Unable to update grid item record',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.get_grid_record = async function (req, res) {
    try {
        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;

        // Validate required parameters
        if (!exhibit_id || !grid_id) {
            LOGGER.module().error('get_grid_record: Invalid request parameters', {
                exhibit_id,
                grid_id
            });
            return res.status(400).send({
                message: 'Invalid request: exhibit_id and grid_id are required'
            });
        }

        // Validate ID formats (prevents injection attacks)
        if (!/^[a-zA-Z0-9_-]+$/.test(exhibit_id)) {
            LOGGER.module().error('get_grid_record: Invalid exhibit_id format', {
                exhibit_id
            });
            return res.status(400).send({
                message: 'Invalid exhibit_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(grid_id)) {
            LOGGER.module().error('get_grid_record: Invalid grid_id format', {
                grid_id
            });
            return res.status(400).send({
                message: 'Invalid grid_id format'
            });
        }

        // Get grid record
        const result = await GRIDS_MODEL.get_grid_record(exhibit_id, grid_id);

        // Validate result from model
        if (!result || typeof result.status !== 'number') {
            LOGGER.module().error('get_grid_record: Invalid response from database model', {
                exhibit_id,
                grid_id,
                result
            });
            return res.status(500).send({
                message: 'Invalid response from database model'
            });
        }

        LOGGER.module().info('get_grid_record: Grid record retrieved successfully', {
            exhibit_id,
            grid_id,
            status: result.status
        });

        return res.status(result.status).send(result);

    } catch (error) {
        LOGGER.module().error('get_grid_record: Error retrieving grid record', {
            error: error.message,
            stack: error.stack,
            exhibit_id: req.params.exhibit_id,
            grid_id: req.params.grid_id
        });
        return res.status(500).send({
            message: 'Unable to get grid record',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.create_grid_item_record = async function (req, res) {
    try {
        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const data = req.body;

        // Validate required parameters
        if (!exhibit_id || !grid_id || !data || typeof data !== 'object' || Object.keys(data).length === 0) {
            LOGGER.module().error('create_grid_item_record: Invalid request parameters', {
                exhibit_id,
                grid_id,
                has_data: !!data,
                data_type: typeof data
            });
            return res.status(400).send({
                message: 'Invalid request: exhibit_id, grid_id, and data are required'
            });
        }

        // Validate ID formats (prevents injection attacks)
        if (!/^[a-zA-Z0-9_-]+$/.test(exhibit_id)) {
            LOGGER.module().error('create_grid_item_record: Invalid exhibit_id format', {
                exhibit_id
            });
            return res.status(400).send({
                message: 'Invalid exhibit_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(grid_id)) {
            LOGGER.module().error('create_grid_item_record: Invalid grid_id format', {
                grid_id
            });
            return res.status(400).send({
                message: 'Invalid grid_id format'
            });
        }

        // Check authorization
        const auth_options = {
            req,
            permissions: ['add_item', 'add_item_to_any_exhibit'],
            record_type: 'grid_item',
            parent_id: exhibit_id,
            child_id: grid_id
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (!is_authorized) {
            LOGGER.module().error('create_grid_item_record: Unauthorized attempt', {
                exhibit_id,
                grid_id,
                user_id: req.user?.id,
                permissions: auth_options.permissions
            });
            return res.status(403).send({
                message: 'Unauthorized request'
            });
        }

        // Create grid item record
        const result = await GRIDS_MODEL.create_grid_item_record(exhibit_id, grid_id, data);

        // Validate result from model
        if (!result || typeof result.status !== 'number') {
            LOGGER.module().error('create_grid_item_record: Invalid response from database model', {
                exhibit_id,
                grid_id,
                result
            });
            return res.status(500).send({
                message: 'Invalid response from database model'
            });
        }

        LOGGER.module().info('create_grid_item_record: Grid item record created successfully', {
            exhibit_id,
            grid_id,
            status: result.status
        });

        return res.status(result.status).send(result);

    } catch (error) {
        LOGGER.module().error('create_grid_item_record: Error creating grid item record', {
            error: error.message,
            stack: error.stack,
            exhibit_id: req.params.exhibit_id,
            grid_id: req.params.grid_id
        });
        return res.status(500).send({
            message: 'Unable to create grid item record',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.get_grid_item_records = async function (req, res) {
    try {
        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;

        // Validate required parameters
        if (!exhibit_id || !grid_id) {
            LOGGER.module().error('get_grid_item_records: Invalid request parameters', {
                exhibit_id,
                grid_id
            });
            return res.status(400).send({
                message: 'Invalid request: exhibit_id and grid_id are required'
            });
        }

        // Validate ID formats (prevents injection attacks)
        if (!/^[a-zA-Z0-9_-]+$/.test(exhibit_id)) {
            LOGGER.module().error('get_grid_item_records: Invalid exhibit_id format', {
                exhibit_id
            });
            return res.status(400).send({
                message: 'Invalid exhibit_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(grid_id)) {
            LOGGER.module().error('get_grid_item_records: Invalid grid_id format', {
                grid_id
            });
            return res.status(400).send({
                message: 'Invalid grid_id format'
            });
        }

        // Get grid item records
        const result = await GRIDS_MODEL.get_grid_item_records(exhibit_id, grid_id);

        // Validate result from model
        if (!result || typeof result.status !== 'number') {
            LOGGER.module().error('get_grid_item_records: Invalid response from database model', {
                exhibit_id,
                grid_id,
                result
            });
            return res.status(500).send({
                message: 'Invalid response from database model'
            });
        }

        LOGGER.module().info('get_grid_item_records: Grid item records retrieved successfully', {
            exhibit_id,
            grid_id,
            status: result.status,
            record_count: result.data?.length || 0
        });

        return res.status(result.status).send(result);

    } catch (error) {
        LOGGER.module().error('get_grid_item_records: Error retrieving grid item records', {
            error: error.message,
            stack: error.stack,
            exhibit_id: req.params.exhibit_id,
            grid_id: req.params.grid_id
        });
        return res.status(500).send({
            message: 'Unable to get grid item records',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.get_grid_item_record = async function (req, res) {
    try {
        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const item_id = req.params.item_id;
        const type = req.query.type;

        // Validate required parameters
        if (!exhibit_id || !grid_id || !item_id) {
            LOGGER.module().error('get_grid_item_record: Invalid request parameters', {
                exhibit_id,
                grid_id,
                item_id
            });
            return res.status(400).send({
                message: 'Invalid request: exhibit_id, grid_id, and item_id are required'
            });
        }

        // Validate ID formats (prevents injection attacks)
        if (!/^[a-zA-Z0-9_-]+$/.test(exhibit_id)) {
            LOGGER.module().error('get_grid_item_record: Invalid exhibit_id format', {
                exhibit_id
            });
            return res.status(400).send({
                message: 'Invalid exhibit_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(grid_id)) {
            LOGGER.module().error('get_grid_item_record: Invalid grid_id format', {
                grid_id
            });
            return res.status(400).send({
                message: 'Invalid grid_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(item_id)) {
            LOGGER.module().error('get_grid_item_record: Invalid item_id format', {
                item_id
            });
            return res.status(400).send({
                message: 'Invalid item_id format'
            });
        }

        // Handle edit type request
        if (type === 'edit') {
            const uid = req.query.uid;

            if (!uid || uid.length === 0) {
                LOGGER.module().error('get_grid_item_record: Missing uid for edit type', {
                    exhibit_id,
                    grid_id,
                    item_id,
                    type
                });
                return res.status(400).send({
                    message: 'Invalid request: uid is required for edit type'
                });
            }

            // Validate uid format
            if (!/^[a-zA-Z0-9_-]+$/.test(uid)) {
                LOGGER.module().error('get_grid_item_record: Invalid uid format', {
                    uid
                });
                return res.status(400).send({
                    message: 'Invalid uid format'
                });
            }

            const result = await GRIDS_MODEL.get_grid_item_edit_record(uid, exhibit_id, grid_id, item_id);

            // Validate result from model
            if (!result || typeof result.status !== 'number') {
                LOGGER.module().error('get_grid_item_record: Invalid response from database model (edit)', {
                    exhibit_id,
                    grid_id,
                    item_id,
                    uid,
                    result
                });
                return res.status(500).send({
                    message: 'Invalid response from database model'
                });
            }

            LOGGER.module().info('get_grid_item_record: Grid item edit record retrieved successfully', {
                exhibit_id,
                grid_id,
                item_id,
                uid,
                status: result.status
            });

            return res.status(result.status).send(result);
        }

        // Validate type parameter if provided
        if (type !== undefined && type !== 'edit') {
            LOGGER.module().error('get_grid_item_record: Invalid type parameter', {
                type,
                exhibit_id,
                grid_id,
                item_id
            });
            return res.status(400).send({
                message: 'Invalid type parameter. Allowed values: "edit"'
            });
        }

        // Handle standard request (no type or invalid type)
        const result = await GRIDS_MODEL.get_grid_item_record(exhibit_id, grid_id, item_id);

        // Validate result from model
        if (!result || typeof result.status !== 'number') {
            LOGGER.module().error('get_grid_item_record: Invalid response from database model', {
                exhibit_id,
                grid_id,
                item_id,
                result
            });
            return res.status(500).send({
                message: 'Invalid response from database model'
            });
        }

        LOGGER.module().info('get_grid_item_record: Grid item record retrieved successfully', {
            exhibit_id,
            grid_id,
            item_id,
            status: result.status
        });

        return res.status(result.status).send(result);

    } catch (error) {
        LOGGER.module().error('get_grid_item_record: Error retrieving grid item record', {
            error: error.message,
            stack: error.stack,
            exhibit_id: req.params.exhibit_id,
            grid_id: req.params.grid_id,
            item_id: req.params.item_id,
            type: req.query.type,
            uid: req.query.uid
        });
        return res.status(500).send({
            message: 'Unable to get grid item record',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.update_grid_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const item_id = req.params.item_id;
        const data = req.body;

        // Validate required parameters
        if (!exhibit_id || !grid_id || !item_id || !data || typeof data !== 'object' || Object.keys(data).length === 0) {
            LOGGER.module().error('update_grid_item_record: Invalid request parameters', {
                exhibit_id,
                grid_id,
                item_id,
                has_data: !!data,
                data_type: typeof data
            });
            return res.status(400).send({
                message: 'Invalid request: exhibit_id, grid_id, item_id, and data are required'
            });
        }

        // Validate ID formats (prevents injection attacks)
        if (!/^[a-zA-Z0-9_-]+$/.test(exhibit_id)) {
            LOGGER.module().error('update_grid_item_record: Invalid exhibit_id format', {
                exhibit_id
            });
            return res.status(400).send({
                message: 'Invalid exhibit_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(grid_id)) {
            LOGGER.module().error('update_grid_item_record: Invalid grid_id format', {
                grid_id
            });
            return res.status(400).send({
                message: 'Invalid grid_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(item_id)) {
            LOGGER.module().error('update_grid_item_record: Invalid item_id format', {
                item_id
            });
            return res.status(400).send({
                message: 'Invalid item_id format'
            });
        }

        // Check authorization
        const auth_options = {
            req,
            permissions: ['update_item', 'update_any_item'],
            record_type: 'grid_item',
            parent_id: exhibit_id,
            child_id: item_id
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (!is_authorized) {
            LOGGER.module().error('update_grid_item_record: Unauthorized attempt', {
                exhibit_id,
                grid_id,
                item_id,
                user_id: req.user?.id,
                permissions: auth_options.permissions
            });
            return res.status(403).send({
                message: 'Unauthorized request'
            });
        }

        // Update grid item record
        const result = await GRIDS_MODEL.update_grid_item_record(exhibit_id, grid_id, item_id, data);

        // Validate result from model
        if (!result || typeof result.status !== 'number') {
            LOGGER.module().error('update_grid_item_record: Invalid response from database model', {
                exhibit_id,
                grid_id,
                item_id,
                result
            });
            return res.status(500).send({
                message: 'Invalid response from database model'
            });
        }

        LOGGER.module().info('update_grid_item_record: Grid item record updated successfully', {
            exhibit_id,
            grid_id,
            item_id,
            status: result.status
        });

        return res.status(result.status).send(result);

    } catch (error) {
        LOGGER.module().error('update_grid_item_record: Error updating grid item record', {
            error: error.message,
            stack: error.stack,
            exhibit_id: req.params.exhibit_id,
            grid_id: req.params.grid_id,
            item_id: req.params.item_id
        });
        return res.status(500).send({
            message: 'Unable to update grid item record',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.delete_grid_item_record = async function (req, res) {

    try {
        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const item_id = req.params.item_id;
        const record_type = req.query.type;

        // Validate required parameters
        if (!exhibit_id || !grid_id || !item_id) {
            LOGGER.module().error('delete_grid_item_record: Invalid request parameters', {
                exhibit_id,
                grid_id,
                item_id,
                record_type
            });
            return res.status(400).send({
                message: 'Invalid request: exhibit_id, grid_id, and item_id are required'
            });
        }

        // Validate ID formats (prevents injection attacks)
        if (!/^[a-zA-Z0-9_-]+$/.test(exhibit_id)) {
            LOGGER.module().error('delete_grid_item_record: Invalid exhibit_id format', {
                exhibit_id
            });
            return res.status(400).send({
                message: 'Invalid exhibit_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(grid_id)) {
            LOGGER.module().error('delete_grid_item_record: Invalid grid_id format', {
                grid_id
            });
            return res.status(400).send({
                message: 'Invalid grid_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(item_id)) {
            LOGGER.module().error('delete_grid_item_record: Invalid item_id format', {
                item_id
            });
            return res.status(400).send({
                message: 'Invalid item_id format'
            });
        }

        // Validate record_type if provided
        const valid_record_types = ['grid_item', 'grid', 'item'];
        if (record_type && !valid_record_types.includes(record_type)) {
            LOGGER.module().error('delete_grid_item_record: Invalid record_type', {
                record_type,
                valid_types: valid_record_types
            });
            return res.status(400).send({
                message: `Invalid record_type. Allowed values: ${valid_record_types.join(', ')}`
            });
        }

        // Check authorization
        const auth_options = {
            req,
            permissions: ['delete_item', 'delete_any_item'],
            record_type: record_type || 'grid_item',
            parent_id: exhibit_id,
            child_id: item_id
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (!is_authorized) {
            LOGGER.module().error('delete_grid_item_record: Unauthorized attempt', {
                exhibit_id,
                grid_id,
                item_id,
                record_type,
                user_id: req.user?.id,
                permissions: auth_options.permissions
            });
            return res.status(403).send({
                message: 'Unauthorized request'
            });
        }

        // Delete grid item record
        const result = await GRIDS_MODEL.delete_grid_item_record(exhibit_id, grid_id, item_id, record_type);

        // Validate result from model
        if (!result || typeof result.status !== 'number') {
            LOGGER.module().error('delete_grid_item_record: Invalid response from database model', {
                exhibit_id,
                grid_id,
                item_id,
                record_type,
                result
            });
            return res.status(500).send({
                message: 'Invalid response from database model'
            });
        }

        LOGGER.module().info('delete_grid_item_record: Grid item record deleted successfully', {
            exhibit_id,
            grid_id,
            item_id,
            record_type,
            status: result.status
        });

        return res.status(result.status).send(result);

    } catch (error) {
        LOGGER.module().error('delete_grid_item_record: Error deleting grid item record', {
            error: error.message,
            stack: error.stack,
            exhibit_id: req.params.exhibit_id,
            grid_id: req.params.grid_id,
            item_id: req.params.item_id,
            record_type: req.query.type
        });
        return res.status(500).send({
            message: 'Unable to delete grid item record',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.publish_grid_item_record = async function (req, res) {

    try {
        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const grid_item_id = req.params.grid_item_id;

        // Validate required parameters
        if (!exhibit_id || !grid_id || !grid_item_id) {
            LOGGER.module().error('publish_grid_item_record: Invalid request parameters', {
                exhibit_id,
                grid_id,
                grid_item_id
            });
            return res.status(400).send({
                message: 'Invalid request: exhibit_id, grid_id, and grid_item_id are required'
            });
        }

        // Validate ID formats (prevents injection attacks)
        if (!/^[a-zA-Z0-9_-]+$/.test(exhibit_id)) {
            LOGGER.module().error('publish_grid_item_record: Invalid exhibit_id format', {
                exhibit_id
            });
            return res.status(400).send({
                message: 'Invalid exhibit_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(grid_id)) {
            LOGGER.module().error('publish_grid_item_record: Invalid grid_id format', {
                grid_id
            });
            return res.status(400).send({
                message: 'Invalid grid_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(grid_item_id)) {
            LOGGER.module().error('publish_grid_item_record: Invalid grid_item_id format', {
                grid_item_id
            });
            return res.status(400).send({
                message: 'Invalid grid_item_id format'
            });
        }

        // Check authorization
        const auth_options = {
            req,
            permissions: ['publish_item', 'publish_any_item'],
            record_type: 'grid_item',
            parent_id: exhibit_id,
            child_id: grid_item_id
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (!is_authorized) {
            LOGGER.module().error('publish_grid_item_record: Unauthorized attempt', {
                exhibit_id,
                grid_id,
                grid_item_id,
                user_id: req.user?.id,
                permissions: auth_options.permissions
            });
            return res.status(403).send({
                message: 'Unauthorized request'
            });
        }

        // Publish grid item record
        const result = await GRIDS_MODEL.publish_grid_item_record(exhibit_id, grid_id, grid_item_id);

        // Validate result from model
        if (!result.status) {
            LOGGER.module().error(`publish_grid_item_record: ${result.message}`, { // Invalid response from database model
                exhibit_id,
                grid_id,
                grid_item_id,
                result
            });
            return res.status(500).send({
                message: result.message,
            });
        }

        LOGGER.module().info('publish_grid_item_record: Grid item record published successfully', {
            exhibit_id,
            grid_id,
            grid_item_id,
            status: 200
        });

        return res.status(200).send(result);

    } catch (error) {
        LOGGER.module().error('publish_grid_item_record: Error publishing grid item record', {
            error: error.message,
            stack: error.stack,
            exhibit_id: req.params.exhibit_id,
            grid_id: req.params.grid_id,
            grid_item_id: req.params.grid_item_id
        });
        return res.status(500).send({
            message: 'Unable to publish grid item record',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.suppress_grid_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const grid_id = req.params.grid_id;
        const grid_item_id = req.params.grid_item_id;

        // Validate required parameters
        if (!exhibit_id || !grid_id || !grid_item_id) {
            LOGGER.module().error('suppress_grid_item_record: Invalid request parameters', {
                exhibit_id,
                grid_id,
                grid_item_id
            });
            return res.status(400).send({
                message: 'Invalid request: exhibit_id, grid_id, and grid_item_id are required'
            });
        }

        // Validate ID formats (prevents injection attacks)
        if (!/^[a-zA-Z0-9_-]+$/.test(exhibit_id)) {
            LOGGER.module().error('suppress_grid_item_record: Invalid exhibit_id format', {
                exhibit_id
            });
            return res.status(400).send({
                message: 'Invalid exhibit_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(grid_id)) {
            LOGGER.module().error('suppress_grid_item_record: Invalid grid_id format', {
                grid_id
            });
            return res.status(400).send({
                message: 'Invalid grid_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(grid_item_id)) {
            LOGGER.module().error('suppress_grid_item_record: Invalid grid_item_id format', {
                grid_item_id
            });
            return res.status(400).send({
                message: 'Invalid grid_item_id format'
            });
        }

        // Check authorization
        const auth_options = {
            req,
            permissions: ['suppress_item', 'suppress_any_item'],
            record_type: 'grid_item',
            parent_id: exhibit_id,
            child_id: grid_item_id
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (!is_authorized) {
            LOGGER.module().error('suppress_grid_item_record: Unauthorized attempt', {
                exhibit_id,
                grid_id,
                grid_item_id,
                user_id: req.user?.id,
                permissions: auth_options.permissions
            });
            return res.status(403).send({
                message: 'Unauthorized request'
            });
        }

        // Suppress grid item record
        const result = await GRIDS_MODEL.suppress_grid_item_record(exhibit_id, grid_id, grid_item_id);
        console.log('SUPPRESS RESULT ', result);

        // Validate result from model
        if (!result) { //  || typeof result.status !== 'number'
            LOGGER.module().error('suppress_grid_item_record: Invalid response from database model', {
                exhibit_id,
                grid_id,
                grid_item_id,
                result
            });
            return res.status(500).send({
                message: 'Invalid response from database model'
            });
        }

        LOGGER.module().info('suppress_grid_item_record: Grid item record suppressed successfully', {
            exhibit_id,
            grid_id,
            grid_item_id,
            status: 200 //result.status
        });

        return res.status(200).send(result); // result.status

    } catch (error) {
        LOGGER.module().error('suppress_grid_item_record: Error suppressing grid item record', {
            error: error.message,
            stack: error.stack,
            exhibit_id: req.params.exhibit_id,
            grid_id: req.params.grid_id,
            grid_item_id: req.params.grid_item_id
        });
        return res.status(500).send({
            message: 'Unable to suppress grid item record',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

        // Validate required parameters
        if (!item_id || !uid) {
            LOGGER.module().error('unlock_grid_item_record: Invalid request parameters', {
                exhibit_id,
                grid_id,
                item_id,
                has_uid: !!uid
            });
            return res.status(400).send({
                message: 'Invalid request: item_id and uid are required'
            });
        }

        // Validate ID formats (prevents injection attacks)
        if (exhibit_id && !/^[a-zA-Z0-9_-]+$/.test(exhibit_id)) {
            LOGGER.module().error('unlock_grid_item_record: Invalid exhibit_id format', {
                exhibit_id
            });
            return res.status(400).send({
                message: 'Invalid exhibit_id format'
            });
        }

        if (grid_id && !/^[a-zA-Z0-9_-]+$/.test(grid_id)) {
            LOGGER.module().error('unlock_grid_item_record: Invalid grid_id format', {
                grid_id
            });
            return res.status(400).send({
                message: 'Invalid grid_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(item_id)) {
            LOGGER.module().error('unlock_grid_item_record: Invalid item_id format', {
                item_id
            });
            return res.status(400).send({
                message: 'Invalid item_id format'
            });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(uid)) {
            LOGGER.module().error('unlock_grid_item_record: Invalid uid format', {
                uid
            });
            return res.status(400).send({
                message: 'Invalid uid format'
            });
        }

        // Validate force parameter
        if (force !== undefined && force !== 'true' && force !== 'false') {
            LOGGER.module().error('unlock_grid_item_record: Invalid force parameter', {
                force
            });
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
        const auth_options = {
            req,
            permissions: ['update_any_item'],
            record_type: 'grid_item',
            parent_id: exhibit_id,
            child_id: item_id
        };

        const is_authorized = await AUTHORIZE.check_permission(auth_options);

        if (!is_authorized) {
            LOGGER.module().error('unlock_grid_item_record: Unauthorized attempt', {
                exhibit_id,
                grid_id,
                item_id,
                uid,
                user_id: req.user?.id,
                permissions: auth_options.permissions
            });
            return res.status(403).send({
                message: 'Unauthorized request'
            });
        }
        */

        // Unlock grid item record
        const result = await GRIDS_MODEL.unlock_grid_item_record(uid, item_id, options);

        // Handle boolean result from model
        if (typeof result === 'object') {
            LOGGER.module().info('unlock_grid_item_record: Grid item record unlocked successfully', {
                exhibit_id,
                grid_id,
                item_id,
                uid,
                force: options.force
            });
            return res.status(200).send({
                message: 'Grid item record unlocked'
            });
        }

        // Handle failure
        LOGGER.module().error('unlock_grid_item_record: Failed to unlock grid item record', {
            exhibit_id,
            grid_id,
            item_id,
            uid,
            force: options.force,
            result
        });
        return res.status(400).send({
            message: 'Unable to unlock grid item record'
        });

    } catch (error) {
        LOGGER.module().error('unlock_grid_item_record: Error unlocking grid item record', {
            error: error.message,
            stack: error.stack,
            exhibit_id: req.params.exhibit_id,
            grid_id: req.params.grid_id,
            item_id: req.params.item_id,
            uid: req.query.uid,
            force: req.query.force
        });
        return res.status(500).send({
            message: 'Unable to unlock grid item record',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

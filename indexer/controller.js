/**

 Copyright 2023 University of Denver

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 Design history and rationale: NOTES/EXHIBITS_BACKEND_CODE_NOTES.md

 */

'use strict';

const MODEL = require('../indexer/model');
const SERVICE = require('../indexer/service');
const LOGGER = require('../libs/log4');
const GATE = require('../auth/permission_gate');
const {is_valid_uuid, is_valid_record_type} = require('../indexer/indexer_helper');
const {send_error, send_ok} = require('../libs/http');

/*
 * The indexer's model and service answer with `{status, message?, data?}` — a
 * shape that predates the shared envelope and carries the HTTP status inside
 * the body. Project it onto `{success, message, data}` here, at the edge, and
 * apply the status to the response instead.
 *
 * `success` is derived from the HTTP status, so a soft failure the service
 * reports as 200 still reads as a success — which is what the management view
 * branches on.
 *
 * `create_index` reports its outcome as a bare string in `data`; every other
 * call carries a structured payload. A string payload is therefore promoted to
 * the message so `data` only ever holds data.
 *
 * @param {Object} res - Express response object
 * @param {Object} result - Service/model envelope `{status, message?, data?}`
 * @param {string} fallback_message - Message when the envelope carries none
 * @returns {Object} The Express response
 */
const send_service_result = (res, result, fallback_message) => {

    const is_string_payload = typeof result.data === 'string';
    const payload = (is_string_payload || result.data === undefined) ? null : result.data;
    const message = result.message || (is_string_payload ? result.data : fallback_message);

    if (result.status >= 400) {
        return send_error(res, result.status, message);
    }

    return send_ok(res, payload, message, result.status);
};

/*
 * Route middleware: requires the `manage_index` permission.
 * Runs after TOKEN.verify (which sets req.decoded), so an unauthenticated
 * caller is already rejected; this gates the destructive index create/rebuild
 * to roles that hold `manage_index` (Administrator only, per the RBAC matrix).
 */
exports.require_manage_index_permission = GATE.require_permission(['manage_index'], {
    context: '/indexer/controller (require_manage_index_permission)'
});

/**
 * Creates a new search index
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.create_index = async (req, res) => {

    try {

        const result = await SERVICE.create_index();

        // Validate result structure
        if (!result || typeof result.status !== 'number') {
            throw new Error('Invalid response from service');
        }

        // On a successful rebuild, repopulate the fresh (empty) index with the
        // currently-published exhibits in the background. Publish state is NOT
        // changed; the index self-heals over the next moments (the management view
        // polls the status endpoint and updates the document count automatically).
        if (result.status === 201) {
            setImmediate(() => {
                MODEL.reindex_published_exhibits().catch((reindex_error) => {
                    LOGGER.module().error('ERROR: [/indexer/controller (create_index reindex)]', {
                        error: reindex_error.message
                    });
                });
            });
        }

        return send_service_result(res, result, 'Index created');

    } catch (error) {
        LOGGER.module().error('ERROR: [/indexer/controller (create_index)]', {
            error: error.message,
            stack: error.stack,
            userId: req.decoded?.sub
        });

        if (!res.headersSent) {
            return send_error(res, 500, 'Unable to create index');
        }
    }
};

/**
 * Returns search index status (existence + document count) for the management view.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.get_index_status = async (req, res) => {

    try {

        const result = await SERVICE.get_index_status();

        // Enrich with the count of currently-published exhibits so the admin can
        // compare it against the indexed document count above.
        if (result && result.data) {
            try {
                result.data.published_exhibits = await MODEL.get_published_exhibit_count();
            } catch (count_error) {
                result.data.published_exhibits = null;
            }
        }

        return send_service_result(res, result, 'Index status retrieved');

    } catch (error) {
        LOGGER.module().error('ERROR: [/indexer/controller (get_index_status)]', {
            error: error.message,
            userId: req.decoded?.sub
        });

        if (!res.headersSent) {
            return send_error(res, 500, 'Unable to retrieve index status');
        }
    }
};

/**
 * Indexes a specific exhibit record
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.index_exhibit = async (req, res) => {

    try {
        const { uuid } = req.params;

        // Validate UUID
        if (!is_valid_uuid(uuid)) {
            return send_error(res, 400, 'Valid exhibit UUID is required', {code: 'INVALID_UUID'});
        }

        const result = await MODEL.index_exhibit(uuid);

        // Validate result structure
        if (!result || typeof result.status !== 'number') {
            throw new Error('Invalid response from model');
        }

        return send_service_result(res, result, 'Exhibit indexed');

    } catch (error) {
        LOGGER.module().error('ERROR: [/indexer/controller (index_exhibit)]', {
            error: error.message,
            stack: error.stack,
            uuid: req.params.uuid,
            userId: req.decoded?.sub
        });

        if (!res.headersSent) {
            return send_error(res, 500, 'Unable to index exhibit');
        }
    }
};

/**
 * Retrieves an indexed record by UUID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.get_indexed_record = async (req, res) => {

    try {
        const { uuid } = req.params;

        // Validate UUID
        if (!is_valid_uuid(uuid)) {
            return send_error(res, 400, 'Valid record UUID is required', {code: 'INVALID_UUID'});
        }

        const response = await MODEL.get_indexed_record(uuid);

        // Validate response structure
        if (!response || typeof response.status !== 'number') {
            throw new Error('Invalid response from model');
        }

        // Check if record was found
        if (response.status === 404) {
            return send_error(res, 404, 'Record not found', {code: 'RECORD_NOT_FOUND'});
        }

        return send_ok(res, response.data === undefined ? null : response.data, response.message || 'Indexed record retrieved', response.status);

    } catch (error) {
        LOGGER.module().error('ERROR: [/indexer/controller (get_indexed_record)]', {
            error: error.message,
            stack: error.stack,
            uuid: req.params.uuid,
            userId: req.decoded?.sub
        });

        if (!res.headersSent) {
            return send_error(res, 500, 'Unable to retrieve indexed record');
        }
    }
};

/**
 * Deletes a record from the index
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.delete_record = async (req, res) => {

    try {
        const { uuid } = req.params;

        // Validate UUID
        if (!is_valid_uuid(uuid)) {
            return send_error(res, 400, 'Valid record UUID is required', {code: 'INVALID_UUID'});
        }

        const result = await MODEL.delete_record(uuid);

        // Validate result structure
        if (!result || typeof result.status !== 'number') {
            throw new Error('Invalid response from model');
        }

        return send_service_result(res, result, 'Record deleted from the index');

    } catch (error) {
        LOGGER.module().error('ERROR: [/indexer/controller (delete_record)]', {
            error: error.message,
            stack: error.stack,
            uuid: req.params.uuid,
            userId: req.decoded?.sub
        });

        if (!res.headersSent) {
            return send_error(res, 500, 'Unable to delete record');
        }
    }
};

/**
 * Indexes a record by UUID and type
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.index_record = async (req, res) => {
    try {
        const { uuid } = req.params;
        const { type } = req.query;

        // Validate UUID
        if (!is_valid_uuid(uuid)) {
            return send_error(res, 400, 'Valid record UUID is required', {code: 'INVALID_UUID'});
        }

        // Validate type parameter
        if (!type || typeof type !== 'string' || type.trim().length === 0) {
            return send_error(res, 400, 'Record type is required', {code: 'MISSING_TYPE'});
        }

        // Validate against allowed types
        if (!is_valid_record_type(type)) {
            return send_error(res, 400, 'Invalid record type', {code: 'INVALID_TYPE'});
        }

        const result = await MODEL.index_record(uuid, type.toLowerCase());

        // Validate result structure
        if (!result || typeof result.status !== 'number') {
            throw new Error('Invalid response from model');
        }

        return send_service_result(res, result, 'Record indexed');

    } catch (error) {
        LOGGER.module().error('ERROR: [/indexer/controller (index_record)]', {
            error: error.message,
            stack: error.stack,
            uuid: req.params.uuid,
            type: req.query.type,
            userId: req.decoded?.sub
        });

        if (!res.headersSent) {
            return send_error(res, 500, 'Unable to index record');
        }
    }
};

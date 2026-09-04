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
const EXHIBITS_MODEL = require('../exhibits/exhibits_model');
const AUTHORIZE = require('../auth/authorize');
const LOGGER = require('../libs/log4');
const { send_error, send_ok } = require('../libs/http');
const {
    validate_string_param,
    has_path_traversal,
    validate_request_body,
    is_valid_model_result,
    validate_status_code,
    send_model_result
} = require('../exhibits/controller_helper');

/*
 * This controller speaks the {success, message, data} envelope, so it uses the
 * shared helper's PURE validators (which return a verdict) rather than the
 * response-sending ones the item-type controllers use.
 *
 * Phase 3 item 19 removed the second failure envelope that used to coexist
 * here, which omitted the `data` key. The split was never principled; it was
 * just what the endpoints happened to return. Every failure is now
 * `send_error` -> {success: false, message, data: null} and every success
 * `send_ok` -> {success: true, message, data}.
 */

const CONTROLLER_LABEL = '/exhibits/controller';

const log_error = (context, message) => LOGGER.module().error(`ERROR: [${CONTROLLER_LABEL} (${context})] ${message}`);
const log_warn = (context, message) => LOGGER.module().warn(`WARNING: [${CONTROLLER_LABEL} (${context})] ${message}`);
const log_info = (context, message) => LOGGER.module().info(`INFO: [${CONTROLLER_LABEL} (${context})] ${message}`);

const actor = (req) => req.decoded?.sub || 'unknown';

/**
 * Forwards a model response whose `status` is the HTTP status to send.
 * @param {Object} res - Express response
 * @param {string} context - Controller function name for logging
 * @param {*} data - Model response
 * @param {Function} [on_success] - Called with the status code before a 2xx send
 * @returns {Object} The response
 * @throws {Error} When the model returned something other than an object
 */
const send_model_response = (res, context, data, on_success) => {

    if (!data || typeof data !== 'object') {
        throw new Error('Invalid response from database');
    }

    const { valid: is_valid_status, status_code } = validate_status_code(data.status);

    if (!is_valid_status) {
        log_error(context, `Invalid status code received: ${data.status}`);
        return send_error(res, 500, 'Internal server error');
    }

    if (typeof on_success === 'function') {
        on_success(status_code);
    }

    return send_model_result(res, {...data, status: status_code});
};

/**
 * Validates a required string parameter, sending the 400 this controller uses
 * @param {Object} res - Express response
 * @param {*} value - Value to validate
 * @param {string} field_name - Human-readable field name
 * @returns {string|null} The sanitized value, or null when a 400 was sent
 */
const sanitize_param = (res, value, field_name) => {

    const check = validate_string_param(value, field_name);

    if (!check.valid) {
        send_error(res, 400, check.error_message);
        return null;
    }

    return check.sanitized;
};

/**
 * Rejects a value carrying path traversal sequences.
 *
 * NOT redundant with the validation above: `validate_string_param` only
 * enforces "non-empty string, at most 255 characters" — it does not check UUID
 * shape — so this is the only gate stopping `../../etc/passwd` reaching a
 * filesystem-backed preview path. Pinned by the traversal specs in
 * test/integration/exhibits_integration.test.js.
 *
 * @param {Object} res - Express response
 * @param {string} context - Controller function name for logging
 * @param {string} value - Sanitized value to check
 * @param {string} label - Label for the log line ('UUID' / 'UID')
 * @param {string} message - 400 message
 * @returns {boolean} True when a 400 was sent
 */
const rejected_for_traversal = (res, context, value, label, message) => {

    if (!has_path_traversal(value)) {
        return false;
    }

    log_warn(context, `Path traversal attempt detected${label ? ' in ' + label : ''}: ${value}`);
    send_error(res, 400, message);
    return true;
};

/**
 * Runs the RBAC check for an exhibit-scoped operation
 * @param {Object} req - Express request
 * @param {Array<string>} permissions - Required permissions
 * @param {string} exhibit_uuid - Exhibit uuid the operation targets
 * @returns {Promise<boolean>} True when authorized
 */
const is_authorized_for_exhibit = async (req, permissions, exhibit_uuid) => {

    return await AUTHORIZE.check_permission({
        req,
        permissions,
        record_type: 'exhibit',
        parent_id: exhibit_uuid,
        child_id: null
    }) === true;
};

/**
 * Creates a new exhibit record
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.create_exhibit_record = async (req, res) => {

    try {

        if (!validate_request_body(req.body)) {
            return send_error(res, 400, 'Request body is required');
        }

        if (!await is_authorized_for_exhibit(req, ['add_exhibit'], null)) {
            return send_error(res, 403, 'Unauthorized request');
        }

        const result = await EXHIBITS_MODEL.create_exhibit_record(req.body);

        if (!is_valid_model_result(result)) {
            throw new Error('Invalid response from model');
        }

        return send_model_result(res, result);

    } catch (error) {

        LOGGER.module().error(`ERROR: [${CONTROLLER_LABEL} (create_exhibit_record)]`, {
            error: error.message,
            stack: error.stack,
            userId: req.decoded?.sub
        });

        if (!res.headersSent) {
            return send_error(res, 500, 'Unable to create exhibit record');
        }
    }
};

exports.get_exhibit_records = async function (req, res) {

    try {

        const data = await EXHIBITS_MODEL.get_exhibit_records();

        return send_model_response(res, 'get_exhibit_records', data);

    } catch (error) {

        log_error('get_exhibit_records', error.message);

        return send_error(res, 500, 'Unable to retrieve exhibit records');
    }
};

exports.get_exhibit_record = async function (req, res) {

    try {

        const type = req.query.type;

        const sanitized_exhibit_uuid = sanitize_param(res, req.params.exhibit_id, 'exhibit ID');
        if (sanitized_exhibit_uuid === null) return;

        let data;

        if (type === 'edit') {

            /* Edit mode locks the record, so it needs the acting user's uid. */
            const sanitized_user_uid = sanitize_param(res, req.query.uid, 'user ID');
            if (sanitized_user_uid === null) return;

            data = await EXHIBITS_MODEL.get_exhibit_edit_record(sanitized_user_uid, sanitized_exhibit_uuid);

        } else if (type === 'details' || type === undefined || type === null || type === '') {

            /* Standard/details request — no record locking. */
            data = await EXHIBITS_MODEL.get_exhibit_record(sanitized_exhibit_uuid);

        } else {
            return send_error(res, 400, 'Invalid request type');
        }

        return send_model_response(res, 'get_exhibit_record', data);

    } catch (error) {

        log_error('get_exhibit_record', error.message);

        return send_error(res, 500, 'Unable to retrieve exhibit record');
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

        /*
         * The raw path parameter, not the trimmed one, is what this handler has
         * always forwarded to the authorization check and the model; only the
         * 400 comes from the validator. Kept verbatim.
         */
        const { exhibit_id: uuid } = req.params;
        const uuid_check = validate_string_param(uuid, 'exhibit ID');

        if (!uuid_check.valid) {
            return send_error(res, 400, uuid_check.error_message);
        }

        if (!validate_request_body(req.body)) {
            return send_error(res, 400, 'Request body with update data is required');
        }

        if (!await is_authorized_for_exhibit(req, ['update_exhibit', 'update_any_exhibit'], uuid)) {
            return send_error(res, 403, 'Unauthorized request');
        }

        const result = await EXHIBITS_MODEL.update_exhibit_record(uuid, req.body);

        if (!is_valid_model_result(result)) {
            throw new Error('Invalid response from model');
        }

        return send_model_result(res, result);

    } catch (error) {

        LOGGER.module().error(`ERROR: [${CONTROLLER_LABEL} (update_exhibit_record)]`, {
            error: error.message,
            stack: error.stack,
            exhibitId: req.params.exhibit_id,
            userId: req.decoded?.sub
        });

        if (!res.headersSent) {
            return send_error(res, 500, 'Unable to update exhibit record');
        }
    }
};

exports.delete_exhibit_record = async function (req, res) {

    try {

        const sanitized_exhibit_uuid = sanitize_param(res, req.params.exhibit_id, 'exhibit ID');
        if (sanitized_exhibit_uuid === null) return;

        if (!await is_authorized_for_exhibit(req, ['delete_exhibit', 'delete_any_exhibit'], sanitized_exhibit_uuid)) {
            log_warn('delete_exhibit_record', `Unauthorized delete attempt for exhibit: ${sanitized_exhibit_uuid} by user: ${actor(req)}`);
            return send_error(res, 403, 'Unauthorized request');
        }

        const result = await EXHIBITS_MODEL.delete_exhibit_record(sanitized_exhibit_uuid);

        return send_model_response(res, 'delete_exhibit_record', result, (status_code) => {
            if (status_code >= 200 && status_code < 300) {
                log_info('delete_exhibit_record', `Successfully deleted exhibit: ${sanitized_exhibit_uuid} by user: ${actor(req)}`);
            }
        });

    } catch (error) {

        log_error('delete_exhibit_record', error.message);

        return send_error(res, 500, 'Unable to delete exhibit record');
    }
};

exports.build_exhibit_preview = async function (req, res) {

    try {

        const sanitized_uuid = sanitize_param(res, req.query.uuid, 'exhibit UUID');
        if (sanitized_uuid === null) return;

        if (rejected_for_traversal(res, 'build_exhibit_preview', sanitized_uuid, '', 'Invalid exhibit UUID format')) return;

        /*
         * TODO: this path has no authorization gate. Minting a SHARE url does
         * (see exhibits/share_controller.js, which checks update_exhibit before
         * it builds), so the gap is a preview built by an authenticated user
         * without edit rights, not an anonymous one.
         */

        const preview_exists = await EXHIBITS_MODEL.check_preview(sanitized_uuid);

        if (preview_exists === true) {

            log_info('build_exhibit_preview', `Deleting existing preview for exhibit: ${sanitized_uuid}`);

            const delete_result = await EXHIBITS_MODEL.delete_exhibit_preview(sanitized_uuid);

            if (!delete_result || delete_result.status === false) {
                log_error('build_exhibit_preview', `Failed to delete existing preview for exhibit: ${sanitized_uuid}`);
                return send_error(res, 500, 'Unable to remove existing preview');
            }

            log_info('build_exhibit_preview', `Successfully deleted existing preview for exhibit: ${sanitized_uuid}`);
        }

        log_info('build_exhibit_preview', `Building new preview for exhibit: ${sanitized_uuid}`);

        const build_result = await EXHIBITS_MODEL.build_exhibit_preview(sanitized_uuid);

        if (!build_result || build_result.status !== true) {
            log_error('build_exhibit_preview', `Failed to build preview for exhibit: ${sanitized_uuid}`);
            return send_error(res, 500, 'Unable to build exhibit preview');
        }

        /* Config guard, unlike the deleted model guards, can genuinely fail:
           these two values come from the environment. */
        if (!WEBSERVICES_CONFIG ||
            !WEBSERVICES_CONFIG.exhibit_preview_url ||
            !WEBSERVICES_CONFIG.exhibit_preview_api_key) {
            log_error('build_exhibit_preview', 'Webservices configuration not properly initialized');
            return send_error(res, 500, 'Internal server error');
        }

        const preview_url = `${WEBSERVICES_CONFIG.exhibit_preview_url}${sanitized_uuid}?key=${WEBSERVICES_CONFIG.exhibit_preview_api_key}`;
        log_info('build_exhibit_preview', `Successfully built preview for exhibit: ${sanitized_uuid} by user: ${actor(req)}`);

        return res.render('preview', {
            preview_url: preview_url,
            exhibit_uuid: sanitized_uuid
        });

    } catch (error) {

        log_error('build_exhibit_preview', error.message);

        return send_error(res, 500, 'Unable to build exhibit preview');
    }
};

/*
 * publish_exhibit and suppress_exhibit were ~90% identical. What actually
 * differs is captured in this table; `refusals` maps a non-boolean model
 * status to the graceful 422 it earns (publish alone has any — the grid
 * minimum-items rule and the empty-exhibit rule both refuse there).
 */
const EXHIBIT_STATE_CHANGES = {

    publish: {
        context: 'publish_exhibit',
        permissions: ['publish_exhibit', 'publish_any_exhibit'],
        model_method: 'publish_exhibit',
        action: 'publish',
        past_tense: 'published',
        timestamp_key: 'published_at',
        success_message: 'Exhibit published successfully',
        failure_message: 'Unable to publish exhibit',
        refusals: {
            no_items: {
                log: 'Publish failed - no items in exhibit',
                message: () => 'Exhibit must have at least one item to be published'
            },
            under_filled_grids: {
                log: 'Publish failed - grids below minimum items',
                message: (result) => result.message
            }
        }
    },

    suppress: {
        context: 'suppress_exhibit',
        permissions: ['suppress_exhibit', 'suppress_any_exhibit'],
        model_method: 'suppress_exhibit',
        action: 'suppress',
        past_tense: 'suppressed',
        timestamp_key: 'suppressed_at',
        success_message: 'Exhibit suppressed successfully',
        failure_message: 'Unable to suppress exhibit',
        refusals: {}
    }
};

/**
 * Builds the publish or suppress handler from the table above
 * @param {Object} config - One EXHIBIT_STATE_CHANGES entry
 * @returns {Function} async (req, res) Express handler
 */
const make_exhibit_state_change_handler = (config) => {

    const { context, permissions, model_method, action, past_tense, timestamp_key, success_message, failure_message, refusals } = config;

    return async function (req, res) {

        try {

            const sanitized_uuid = sanitize_param(res, req.params.exhibit_id, 'exhibit UUID');
            if (sanitized_uuid === null) return;

            if (rejected_for_traversal(res, context, sanitized_uuid, '', 'Invalid exhibit UUID format')) return;

            if (!await is_authorized_for_exhibit(req, permissions, sanitized_uuid)) {
                log_warn(context, `Unauthorized ${action} attempt for exhibit: ${sanitized_uuid} by user: ${actor(req)}`);
                return send_error(res, 403, 'Unauthorized request');
            }

            const result = await EXHIBITS_MODEL[model_method](sanitized_uuid);

            if (!result || typeof result !== 'object') {
                throw new Error('Invalid response from database');
            }

            const refusal = Object.hasOwn(refusals, result.status) ? refusals[result.status] : null;

            if (refusal !== null) {
                log_info(context, `${refusal.log}: ${sanitized_uuid}`);
                return send_error(res, 422, refusal.message(result));
            }

            if (result.status === true) {
                log_info(context, `Successfully ${past_tense} exhibit: ${sanitized_uuid} by user: ${actor(req)}`);
                return send_ok(res, {
                    exhibit_uuid: sanitized_uuid,
                    [timestamp_key]: new Date().toISOString()
                }, success_message);
            }

            log_error(context, `Failed to ${action} exhibit: ${sanitized_uuid}`);
            return send_error(res, 500, failure_message);

        } catch (error) {

            log_error(context, error.message);

            return send_error(res, 500, failure_message);
        }
    };
};

exports.publish_exhibit = make_exhibit_state_change_handler(EXHIBIT_STATE_CHANGES.publish);
exports.suppress_exhibit = make_exhibit_state_change_handler(EXHIBIT_STATE_CHANGES.suppress);

exports.unlock_exhibit_record = async function (req, res) {

    try {

        const force_unlock = req.query.force;

        const sanitized_uuid = sanitize_param(res, req.params.exhibit_id, 'exhibit UUID');
        if (sanitized_uuid === null) return;

        const sanitized_uid = sanitize_param(res, req.query.uid, 'user UID');
        if (sanitized_uid === null) return;

        if (rejected_for_traversal(res, 'unlock_exhibit_record', sanitized_uuid, 'UUID', 'Invalid exhibit UUID format')) return;
        if (rejected_for_traversal(res, 'unlock_exhibit_record', sanitized_uid, 'UID', 'Invalid user UID format')) return;

        let is_force_unlock = false;

        if (force_unlock !== undefined && force_unlock !== null) {

            const force_string = String(force_unlock).toLowerCase().trim();

            if (force_string === 'true' || force_string === '1') {
                is_force_unlock = true;
            } else if (force_string === 'false' || force_string === '0') {
                is_force_unlock = false;
            } else {
                return send_error(res, 400, 'Invalid force parameter. Must be true or false');
            }
        }

        /*
         * TODO: no authorization gate on this path either — see the note below
         * on why the "own lock" guard cannot simply be pointed at req.decoded.
         *
         * NOTE (OWASP A09/H5): this guard is intentionally NOT migrated to
         * req.decoded.sub. It is currently inert — req.user is never populated,
         * so the condition is always false. Beyond that, the comparison is
         * against a NUMERIC user id: locks are stored as `locked_by_user =
         * Number(uid)` (see exhibit_item_record_tasks), and `sanitized_uid` is
         * that numeric id. req.decoded.sub is the du_id STRING (e.g. "jdoe"), so
         * swapping it in here would make `sanitized_uid !== req.decoded.sub`
         * always true and block every non-force unlock. Correctly activating it
         * requires resolving du_id -> numeric user id (a DB lookup) as part of
         * finishing the unlock authorization. The audit lines that DO run use
         * req.decoded.sub.
         */
        if (!is_force_unlock && req.user?.id && sanitized_uid !== req.user.id.toString()) {
            log_warn('unlock_exhibit_record', `User ${req.user.id} attempted to unlock exhibit ${sanitized_uuid} locked by user ${sanitized_uid} without force permission`);
            return send_error(res, 403, 'Cannot unlock another user\'s lock without force permission');
        }

        const result = await EXHIBITS_MODEL.unlock_exhibit_record(sanitized_uid, sanitized_uuid, {
            force: is_force_unlock
        });

        if (!result || typeof result !== 'object') {
            log_error('unlock_exhibit_record', `Invalid response from model for exhibit: ${sanitized_uuid}`);
            return send_error(res, 500, 'Unable to unlock exhibit record');
        }

        if (result.status === false) {

            if (result.error === 'not_locked') {
                return send_error(res, 409, 'Exhibit is not currently locked');
            }

            if (result.error === 'locked_by_other') {
                return send_error(res, 409, 'Exhibit is locked by another user');
            }

            log_error('unlock_exhibit_record', `Failed to unlock exhibit: ${sanitized_uuid}`);
            return send_error(res, 500, 'Unable to unlock exhibit record');
        }

        log_info('unlock_exhibit_record', `Successfully unlocked exhibit: ${sanitized_uuid} by user: ${actor(req)}, force: ${is_force_unlock}`);

        return send_ok(res, {
            exhibit_uuid: sanitized_uuid,
            unlocked_by: actor(req),
            force_unlock: is_force_unlock,
            unlocked_at: new Date().toISOString()
        }, 'Exhibit record unlocked successfully');

    } catch (error) {

        log_error('unlock_exhibit_record', error.message);

        return send_error(res, 500, 'Unable to unlock exhibit record');
    }
};

/* ========================================
   EXHIBIT MEDIA LIBRARY BINDINGS
   ======================================== */

const VALID_MEDIA_ROLES = ['hero_image', 'thumbnail'];
const INVALID_MEDIA_ROLE_MESSAGE = `Invalid media_role. Must be one of: ${VALID_MEDIA_ROLES.join(', ')}`;

/**
 * Binds a media library asset to an exhibit
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.bind_exhibit_media = async (req, res) => {

    try {

        const sanitized_exhibit_uuid = sanitize_param(res, req.params.exhibit_id, 'exhibit ID');
        if (sanitized_exhibit_uuid === null) return;

        if (!validate_request_body(req.body)) {
            return send_error(res, 400, 'Request body is required');
        }

        const { media_uuid, media_role } = req.body;

        if (sanitize_param(res, media_uuid, 'media_uuid') === null) return;

        if (!media_role || !VALID_MEDIA_ROLES.includes(media_role)) {
            return send_error(res, 400, INVALID_MEDIA_ROLE_MESSAGE);
        }

        if (!await is_authorized_for_exhibit(req, ['update_exhibit', 'update_any_exhibit'], sanitized_exhibit_uuid)) {
            return send_error(res, 403, 'Unauthorized request');
        }

        const result = await EXHIBITS_MODEL.bind_exhibit_media(
            sanitized_exhibit_uuid,
            media_uuid.trim(),
            media_role,
            actor(req)
        );

        if (!is_valid_model_result(result)) {
            throw new Error('Invalid response from model');
        }

        return send_model_result(res, result);

    } catch (error) {

        LOGGER.module().error(`ERROR: [${CONTROLLER_LABEL} (bind_exhibit_media)]`, {
            error: error.message,
            stack: error.stack,
            exhibitId: req.params.exhibit_id,
            userId: req.decoded?.sub
        });

        if (!res.headersSent) {
            return send_error(res, 500, 'Unable to bind media to exhibit');
        }
    }
};

/**
 * Gets all media library bindings for an exhibit
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.get_exhibit_media_bindings = async (req, res) => {

    try {

        const sanitized_exhibit_uuid = sanitize_param(res, req.params.exhibit_id, 'exhibit ID');
        if (sanitized_exhibit_uuid === null) return;

        const data = await EXHIBITS_MODEL.get_exhibit_media_bindings(sanitized_exhibit_uuid);

        return send_model_response(res, 'get_exhibit_media_bindings', data);

    } catch (error) {

        log_error('get_exhibit_media_bindings', error.message);

        return send_error(res, 500, 'Unable to retrieve exhibit media bindings');
    }
};

/**
 * Removes (soft-deletes) a media library binding from an exhibit by role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.unbind_exhibit_media = async (req, res) => {

    try {

        const media_role = req.params.media_role;

        const sanitized_exhibit_uuid = sanitize_param(res, req.params.exhibit_id, 'exhibit ID');
        if (sanitized_exhibit_uuid === null) return;

        if (!media_role || !VALID_MEDIA_ROLES.includes(media_role)) {
            return send_error(res, 400, INVALID_MEDIA_ROLE_MESSAGE);
        }

        if (!await is_authorized_for_exhibit(req, ['update_exhibit', 'update_any_exhibit'], sanitized_exhibit_uuid)) {
            return send_error(res, 403, 'Unauthorized request');
        }

        const result = await EXHIBITS_MODEL.unbind_exhibit_media(
            sanitized_exhibit_uuid,
            media_role
        );

        if (!is_valid_model_result(result)) {
            throw new Error('Invalid response from model');
        }

        /* 204 responses must not carry a body */
        if (result.status === 204) {
            return res.status(204).end();
        }

        return send_model_result(res, result);

    } catch (error) {

        LOGGER.module().error(`ERROR: [${CONTROLLER_LABEL} (unbind_exhibit_media)]`, {
            error: error.message,
            stack: error.stack,
            exhibitId: req.params.exhibit_id,
            mediaRole: req.params.media_role
        });

        if (!res.headersSent) {
            return send_error(res, 500, 'Unable to unbind media from exhibit');
        }
    }
};

exports.verify = function (req, res) {
    send_ok(res, null, 'Token Verified');
};

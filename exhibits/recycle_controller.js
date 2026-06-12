/**

 Copyright 2025 University of Denver

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

const RECYCLE_MODEL = require('../exhibits/recycle_model');
const AUTHORIZE = require('../auth/authorize');
const LOGGER = require('../libs/log4');

const VALID_TYPES = ['exhibit', 'heading', 'item', 'grid', 'timeline'];

function has_authorize() {
    return AUTHORIZE && typeof AUTHORIZE.check_permission === 'function';
}

function authz_unavailable(res) {
    return res.status(500).send({ message: 'Authorization service unavailable.' });
}

function deny(res) {
    return res.status(403).send({ message: 'You do not have permission to perform this action.' });
}

/**
 * Map a per-record recycle operation to the SAME permission + ownership rule the
 * app already uses to delete that record type:
 *   exhibit                    -> delete_exhibit / delete_any_exhibit, owned via the exhibit uuid
 *   heading|item|grid|timeline -> delete_item / delete_any_item, owned via the parent exhibit
 * A full grant (both base + _any) bypasses ownership; a base grant falls back to
 * ownership of the parent exhibit (AUTHORIZE.check_permission / check_ownership).
 */
function record_authz_options(type, exhibit_id, uuid) {
    if (type === 'exhibit') {
        return { permissions: ['delete_exhibit', 'delete_any_exhibit'], record_type: 'exhibit', parent_id: uuid };
    }
    return { permissions: ['delete_item', 'delete_any_item'], record_type: type, parent_id: exhibit_id, child_id: uuid };
}

/**
 * GET — list recycled records. Scoped to the caller's own records unless they
 * hold `manage_recycle_bin` (system-wide view of all owners' deleted records).
 */
exports.get_recycled_records = async function (req, res) {

    try {

        if (!has_authorize()) {
            return authz_unavailable(res);
        }

        const can_manage_all = await AUTHORIZE.check_permission({ req, permissions: ['manage_recycle_bin'] }) === true;
        const created_by = can_manage_all ? null : (req.decoded?.sub || null);

        if (!can_manage_all && !created_by) {
            // Authenticated but no scoping identity and not an admin -> nothing to show.
            return res.status(200).send({ status: 200, message: 'Recycled records', data: [] });
        }

        const result = await RECYCLE_MODEL.get_recycled_records(created_by);
        return res.status(result.status).send(result);

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/recycle_controller (get_recycled_records)] ' + error.message);
        return res.status(500).send({ message: `Unable to get recycled records. ${error.message}` });
    }
};

/**
 * PUT — restore a single recycled record. Requires delete permission +
 * ownership for that record type.
 */
exports.restore_recycled_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const uuid = req.params.uuid;
        const type = req.params.type;

        if (!uuid || !exhibit_id || !type || !VALID_TYPES.includes(type)) {
            return res.status(400).send({ message: 'Bad request.' });
        }

        if (!has_authorize()) {
            return authz_unavailable(res);
        }

        const is_authorized = await AUTHORIZE.check_permission({ req, ...record_authz_options(type, exhibit_id, uuid) });
        if (is_authorized !== true) {
            return deny(res);
        }

        const result = await RECYCLE_MODEL.restore_recycled_record(type, uuid);
        return res.status(result.status).send(result);

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/recycle_controller (restore_recycled_record)] ' + error.message);
        return res.status(500).send({ message: `Unable to restore recycled record. ${error.message}` });
    }
};

/**
 * DELETE — permanently delete a single recycled record. Requires delete
 * permission + ownership for that record type.
 */
exports.delete_recycled_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const uuid = req.params.uuid;
        const type = req.params.type;

        if (!uuid || !exhibit_id || !type || !VALID_TYPES.includes(type)) {
            return res.status(400).send({ message: 'Bad request.' });
        }

        if (!has_authorize()) {
            return authz_unavailable(res);
        }

        const is_authorized = await AUTHORIZE.check_permission({ req, ...record_authz_options(type, exhibit_id, uuid) });
        if (is_authorized !== true) {
            return deny(res);
        }

        const result = await RECYCLE_MODEL.delete_recycled_record(type, uuid);
        return res.status(result.status).send(result);

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/recycle_controller (delete_recycled_record)] ' + error.message);
        return res.status(500).send({ message: `Unable to delete recycled record. ${error.message}` });
    }
};

/**
 * POST — empty the recycle bin. A caller may empty their OWN recycled records;
 * emptying the entire bin (all owners) requires `manage_recycle_bin`.
 */
exports.delete_all_recycled_records = async function (req, res) {

    try {

        if (!has_authorize()) {
            return authz_unavailable(res);
        }

        const can_manage_all = await AUTHORIZE.check_permission({ req, permissions: ['manage_recycle_bin'] }) === true;
        const created_by = can_manage_all ? null : (req.decoded?.sub || null);

        if (!can_manage_all && !created_by) {
            return deny(res);
        }

        const result = await RECYCLE_MODEL.delete_all_recycled_records(created_by);
        return res.status(result.status).send(result);

    } catch (error) {
        LOGGER.module().error('ERROR: [/exhibits/recycle_controller (delete_all_recycled_records)] ' + error.message);
        return res.status(500).send({ message: `Unable to delete all recycled records. ${error.message}` });
    }
};

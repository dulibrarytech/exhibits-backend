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

const HEADINGS_MODEL = require('../exhibits/headings_model');

/*
 * This controller used to inline the RBAC tuple and the 403 twice, and hand
 * write every 400/500. It now speaks the same 'plain' wire format through the
 * shared helper as timelines_controller — bare 'Bad request.' on 400,
 * {message: 'Unable to ... <error.message>'} on 500 — with
 * AUTHORIZE.check_permission still the single decision point behind
 * check_authorization. See exhibits/controller_helper.js.
 */
const { send_model_result } = require('../exhibits/controller_helper');
const { send_error, send_ok } = require('../libs/http');
const {
    validate_id: validate_param,
    check_authorization,
    with_handler
} = require('../exhibits/controller_helper').create_controller_helper({
    format: 'plain',
    log_prefix: '/headings/controller'
});

exports.create_heading_record = with_handler(async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const data = req.body;

    if (!validate_param(res, data)) return false;
    if (!validate_param(res, is_member_of_exhibit)) return false;

    const is_authorized = await check_authorization(
        req, res,
        ['add_item', 'add_item_to_any_exhibit'],
        'heading', is_member_of_exhibit, null
    );
    if (!is_authorized) return false;

    const result = await HEADINGS_MODEL.create_heading_record(is_member_of_exhibit, data);
    send_model_result(res, result);

}, {
    context: 'create_heading_record',
    message: 'Unable to create heading record.'
});

exports.get_heading_record = with_handler(async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const uuid = req.params.heading_id;
    const type = req.query.type;

    if (!validate_param(res, uuid)) return false;
    if (!validate_param(res, is_member_of_exhibit)) return false;

    if (type === undefined || type === 'details') {
        const data = await HEADINGS_MODEL.get_heading_record(is_member_of_exhibit, uuid);
        send_model_result(res, data);
        return false;
    }

    if (type === 'edit') {

        const uid = req.query.uid;

        if (!validate_param(res, uid)) return false;

        const data = await HEADINGS_MODEL.get_heading_edit_record(uid, is_member_of_exhibit, uuid);
        send_model_result(res, data);
        return false;
    }

}, {
    context: 'get_heading_record',
    message: 'Unable to get heading record.'
});

exports.update_heading_record = with_handler(async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const heading_id = req.params.heading_id;
    const data = req.body;

    if (!validate_param(res, heading_id)) return false;
    if (!validate_param(res, is_member_of_exhibit)) return false;
    if (!validate_param(res, data)) return false;

    const is_authorized = await check_authorization(
        req, res,
        ['update_item', 'update_any_item'],
        'heading', is_member_of_exhibit, heading_id
    );
    if (!is_authorized) return false;

    const result = await HEADINGS_MODEL.update_heading_record(is_member_of_exhibit, heading_id, data);
    send_model_result(res, result);

}, {
    context: 'update_heading_record',
    message: 'Unable to update heading record.'
});

exports.unlock_heading_record = with_handler(async function (req, res) {

    const heading_id = req.params.heading_id;
    const uid = req.query.uid;
    const force = req.query.force;

    if (!validate_param(res, heading_id)) return false;
    if (!validate_param(res, uid)) return false;

    const options = {
        force: force === 'true'
    };

    const result = await HEADINGS_MODEL.unlock_heading_record(uid, heading_id, options);

    /* helper unlock_record resolves to the unlocked record row, not a boolean */
    if (result && typeof result === 'object') {
        send_ok(res, null, 'Heading record unlocked.');
    } else {
        send_error(res, 400, 'Unable to unlock heading record');
    }

}, {
    context: 'unlock_heading_record',
    message: 'Unable to unlock heading record.'
});

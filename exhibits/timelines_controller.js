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

const TIMELINES_MODEL = require('../exhibits/timelines_model');

/*
 * 'plain' is this controller's message wording: a flat 'Bad request.' on 400
 * and a 500 message of '<message> <error.message>'. Both ride the shared
 * {success, message, data} envelope. See exhibits/controller_helper.js.
 */
const { send_model_result, PLAIN_BAD_REQUEST_MESSAGE } = require('../exhibits/controller_helper');
const { send_error, send_ok } = require('../libs/http');
const {
    validate_id: validate_param,
    check_authorization,
    with_handler
} = require('../exhibits/controller_helper').create_controller_helper({
    format: 'plain',
    log_prefix: '/timelines/controller'
});

exports.create_timeline_record = with_handler(async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const data = req.body;

    if (!validate_param(res, data)) return false;
    if (!validate_param(res, is_member_of_exhibit)) return false;

    const is_authorized = await check_authorization(
        req, res,
        ['add_item', 'add_item_to_any_exhibit'],
        'timeline', is_member_of_exhibit, null
    );
    if (!is_authorized) return false;

    const result = await TIMELINES_MODEL.create_timeline_record(is_member_of_exhibit, data);
    send_model_result(res, result);

}, {
    context: 'create_timeline_record',
    message: 'Unable to create timeline record.'
});

exports.update_timeline_record = with_handler(async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const timeline_id = req.params.timeline_id;
    const data = req.body;

    if (!validate_param(res, data)) return false;
    if (!validate_param(res, is_member_of_exhibit)) return false;
    if (!validate_param(res, timeline_id)) return false;

    const is_authorized = await check_authorization(
        req, res,
        ['update_item', 'update_any_item'],
        'timeline', is_member_of_exhibit, timeline_id
    );
    if (!is_authorized) return false;

    const result = await TIMELINES_MODEL.update_timeline_record(is_member_of_exhibit, timeline_id, data);
    send_model_result(res, result);

}, {
    context: 'update_timeline_record',
    message: 'Unable to update timeline record.'
});

exports.get_timeline_record = with_handler(async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const timeline_id = req.params.timeline_id;

    if (!validate_param(res, is_member_of_exhibit)) return false;
    if (!validate_param(res, timeline_id)) return false;

    const result = await TIMELINES_MODEL.get_timeline_record(is_member_of_exhibit, timeline_id);
    send_model_result(res, result);

}, {
    context: 'get_timeline_record',
    message: 'Unable to get timeline record.'
});

exports.create_timeline_item_record = with_handler(async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const timeline_id = req.params.timeline_id;
    const data = req.body;

    if (!validate_param(res, is_member_of_exhibit)) return false;
    if (!validate_param(res, timeline_id)) return false;
    if (!validate_param(res, data)) return false;

    const is_authorized = await check_authorization(
        req, res,
        ['add_item', 'add_item_to_any_exhibit'],
        'timeline_item', is_member_of_exhibit, null
    );
    if (!is_authorized) return false;

    const result = await TIMELINES_MODEL.create_timeline_item_record(is_member_of_exhibit, timeline_id, data);
    send_model_result(res, result);

}, {
    context: 'create_timeline_item_record',
    message: 'Unable to create timeline item record.'
});

exports.get_timeline_item_records = with_handler(async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const is_member_of_timeline = req.params.timeline_id;

    if (!validate_param(res, is_member_of_exhibit)) return false;
    if (!validate_param(res, is_member_of_timeline)) return false;

    const result = await TIMELINES_MODEL.get_timeline_item_records(is_member_of_exhibit, is_member_of_timeline);
    send_model_result(res, result);

}, {
    context: 'get_timeline_item_records',
    message: 'Unable to get timeline item records.'
});

exports.get_timeline_item_record = with_handler(async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const is_member_of_timeline = req.params.timeline_id;
    const item_id = req.params.item_id;
    const type = req.query.type;

    if (!validate_param(res, is_member_of_exhibit)) return false;
    if (!validate_param(res, is_member_of_timeline)) return false;
    if (!validate_param(res, item_id)) return false;

    if (type === undefined) {
        const result = await TIMELINES_MODEL.get_timeline_item_record(is_member_of_exhibit, is_member_of_timeline, item_id);
        send_model_result(res, result);
    }

    if (type === 'details') {
        const result = await TIMELINES_MODEL.get_timeline_item_details_record(is_member_of_exhibit, is_member_of_timeline, item_id);
        send_model_result(res, result);
        return false;
    }

    if (type === 'edit') {

        const uid = req.query.uid;

        if (!validate_param(res, uid)) return false;

        const result = await TIMELINES_MODEL.get_timeline_item_edit_record(uid, is_member_of_exhibit, is_member_of_timeline, item_id);
        send_model_result(res, result);
        return false;
    }

}, {
    context: 'get_timeline_item_record',
    message: 'Unable to get timeline item.'
});

exports.update_timeline_item_record = with_handler(async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const timeline_id = req.params.timeline_id;
    const item_id = req.params.item_id;
    const data = req.body;

    if (!validate_param(res, data)) return false;
    if (!validate_param(res, is_member_of_exhibit)) return false;
    if (!validate_param(res, timeline_id)) return false;
    if (!validate_param(res, item_id)) return false;

    const is_authorized = await check_authorization(
        req, res,
        ['update_item', 'update_any_item'],
        'timeline_item', is_member_of_exhibit, item_id
    );
    if (!is_authorized) return false;

    const result = await TIMELINES_MODEL.update_timeline_item_record(is_member_of_exhibit, timeline_id, item_id, data);
    send_model_result(res, result);

}, {
    context: 'update_timeline_item_record',
    message: 'Unable to update timeline item.'
});

exports.publish_timeline_item_record = with_handler(async function (req, res) {

    const exhibit_id = req.params.exhibit_id;
    const timeline_id = req.params.timeline_id;
    const timeline_item_id = req.params.timeline_item_id;

    if (exhibit_id === undefined || exhibit_id.length === 0 && timeline_id === undefined || timeline_id.length === 0) {
        send_error(res, 400, PLAIN_BAD_REQUEST_MESSAGE);
        return false;
    }

    const is_authorized = await check_authorization(
        req, res,
        ['publish_item', 'publish_any_item'],
        'timeline_item', exhibit_id, timeline_item_id
    );
    if (!is_authorized) return false;

    const result = await TIMELINES_MODEL.publish_timeline_item_record(exhibit_id, timeline_id, timeline_item_id);

    if (result.status === true) {
        send_ok(res, null, 'timeline item published.');
    } else {
        send_error(res, 422, result?.message || 'Unable to publish timeline item');
    }

}, {
    context: 'publish_timeline_item_record',
    message: 'Unable to publish timeline item record.'
});

exports.suppress_timeline_item_record = with_handler(async function (req, res) {

    const exhibit_id = req.params.exhibit_id;
    const timeline_id = req.params.timeline_id;
    const timeline_item_id = req.params.timeline_item_id;

    if (exhibit_id === undefined || exhibit_id.length === 0 && timeline_id === undefined || timeline_id.length === 0) {
        send_error(res, 400, PLAIN_BAD_REQUEST_MESSAGE);
        return false;
    }

    const is_authorized = await check_authorization(
        req, res,
        ['suppress_item', 'suppress_any_item'],
        'timeline_item', exhibit_id, timeline_item_id
    );
    if (!is_authorized) return false;

    const result = await TIMELINES_MODEL.suppress_timeline_item_record(exhibit_id, timeline_id, timeline_item_id);

    if (result?.status === true) {
        send_ok(res, null, 'Item timeline suppressed.');
    } else {
        send_error(res, 422, result?.message || 'Unable to suppress timeline item');
    }

}, {
    context: 'suppress_timeline_item_record',
    message: 'Unable to suppress timeline item record.'
});

exports.delete_timeline_item_record = with_handler(async function (req, res) {

    const is_member_of_exhibit = req.params.exhibit_id;
    const timeline_id = req.params.timeline_id;
    const timeline_item_id = req.params.item_id;
    const record_type = req.query.type;

    if (timeline_item_id === undefined || timeline_item_id.length === 0 && timeline_id === undefined || timeline_id.length === 0) {
        send_error(res, 400, PLAIN_BAD_REQUEST_MESSAGE);
        return false;
    }

    const is_authorized = await check_authorization(
        req, res,
        ['delete_item', 'delete_any_item'],
        record_type, is_member_of_exhibit, timeline_item_id
    );
    if (!is_authorized) return false;

    const result = await TIMELINES_MODEL.delete_timeline_item_record(is_member_of_exhibit, timeline_id, timeline_item_id, record_type);
    send_model_result(res, result);

}, {
    context: 'delete_timeline_item_record',
    message: 'Unable to delete timeline item.'
});

exports.unlock_timeline_item_record = with_handler(async function (req, res) {

    const item_id = req.params.item_id;
    const uid = req.query.uid;
    const force = req.query.force;

    if (!validate_param(res, item_id)) return false;
    if (!validate_param(res, uid)) return false;

    const options = {
        force: force === 'true'
    };

    /*
     * No authorization gate here, matching the grid-item unlock path: a
     * force-unlock permission check is still to be specified.
     */

    const result = await TIMELINES_MODEL.unlock_timeline_item_record(uid, item_id, options);

    /* helper unlock_record resolves to the unlocked record row, not a boolean */
    if (result && typeof result === 'object') {
        send_ok(res, null, 'Timeline item record unlocked.');
    } else {
        send_error(res, 400, 'Unable to unlock timeline item record');
    }

}, {
    context: 'unlock_timeline_item_record',
    message: 'Unable to unlock timeline item record.'
});

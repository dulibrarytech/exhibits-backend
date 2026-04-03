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
const {
    validate_param,
    check_authorization,
    handle_error
} = require('../exhibits/timelines_helper');

exports.create_timeline_record = async function (req, res) {

    try {

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
        res.status(result.status).send(result);

    } catch (error) {
        handle_error(res, 'Unable to create timeline record.', error);
    }
};

exports.update_timeline_record = async function (req, res) {

    try {

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
        res.status(result.status).send(result);

    } catch (error) {
        handle_error(res, 'Unable to update timeline record.', error);
    }
};

exports.get_timeline_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const timeline_id = req.params.timeline_id;

        if (!validate_param(res, is_member_of_exhibit)) return false;
        if (!validate_param(res, timeline_id)) return false;

        const result = await TIMELINES_MODEL.get_timeline_record(is_member_of_exhibit, timeline_id);
        res.status(result.status).send(result);

    } catch (error) {
        handle_error(res, 'Unable to get timeline record.', error);
    }
};

exports.create_timeline_item_record = async function (req, res) {

    try {

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
        res.status(result.status).send(result);

    } catch (error) {
        handle_error(res, 'Unable to create timeline item record.', error);
    }
};

exports.get_timeline_item_records = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const is_member_of_timeline = req.params.timeline_id;

        if (!validate_param(res, is_member_of_exhibit)) return false;
        if (!validate_param(res, is_member_of_timeline)) return false;

        const result = await TIMELINES_MODEL.get_timeline_item_records(is_member_of_exhibit, is_member_of_timeline);
        res.status(result.status).send(result);

    } catch (error) {
        handle_error(res, 'Unable to get timeline item records.', error);
    }
};

exports.get_timeline_item_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const is_member_of_timeline = req.params.timeline_id;
        const item_id = req.params.item_id;
        const type = req.query.type;

        if (!validate_param(res, is_member_of_exhibit)) return false;
        if (!validate_param(res, is_member_of_timeline)) return false;
        if (!validate_param(res, item_id)) return false;

        if (type === undefined) {
            const result = await TIMELINES_MODEL.get_timeline_item_record(is_member_of_exhibit, is_member_of_timeline, item_id);
            res.status(result.status).send(result);
        }

        if (type === 'details') {
            const result = await TIMELINES_MODEL.get_timeline_item_details_record(is_member_of_exhibit, is_member_of_timeline, item_id);
            res.status(result.status).send(result);
            return false;
        }

        if (type === 'edit') {

            const uid = req.query.uid;

            if (uid === undefined || uid.length === 0) {
                res.status(400).send('Bad request.');
                return false;
            }

            const result = await TIMELINES_MODEL.get_timeline_item_edit_record(uid, is_member_of_exhibit, is_member_of_timeline, item_id);
            res.status(result.status).send(result);
            return false;
        }

    } catch (error) {
        handle_error(res, 'Unable to get timeline item.', error);
    }
};

exports.update_timeline_item_record = async function (req, res) {

    try {

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
        res.status(result.status).send(result);

    } catch (error) {
        handle_error(res, 'Unable to update timeline item.', error);
    }
};

exports.publish_timeline_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const timeline_id = req.params.timeline_id;
        const timeline_item_id = req.params.timeline_item_id;
        let result;

        if (exhibit_id === undefined || exhibit_id.length === 0 && timeline_id === undefined || timeline_id.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        const is_authorized = await check_authorization(
            req, res,
            ['publish_item', 'publish_any_item'],
            'timeline_item', exhibit_id, timeline_item_id
        );
        if (!is_authorized) return false;

        result = await TIMELINES_MODEL.publish_timeline_item_record(exhibit_id, timeline_id, timeline_item_id);

        if (result.status === true) {

            res.status(200).send({
                message: 'timeline item published.'
            });
        } else if (result.status === false) {
            res.status(204).send({
                message: 'Unable to publish timeline item'
            });
        }

    } catch (error) {
        handle_error(res, 'Unable to publish timeline item record.', error);
    }
};

exports.suppress_timeline_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const timeline_id = req.params.timeline_id;
        const timeline_item_id = req.params.timeline_item_id;
        let result;

        if (exhibit_id === undefined || exhibit_id.length === 0 && timeline_id === undefined || timeline_id.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        const is_authorized = await check_authorization(
            req, res,
            ['suppress_item', 'suppress_any_item'],
            'timeline_item', exhibit_id, timeline_item_id
        );
        if (!is_authorized) return false;

        result = await TIMELINES_MODEL.suppress_timeline_item_record(exhibit_id, timeline_id, timeline_item_id);

        if (result === true) {
            res.status(200).send({
                message: 'Item timeline suppressed.'
            });
        } else if (result === false) {
            res.status(204).send({
                message: 'Unable to suppress timeline item'
            });
        }

    } catch (error) {
        handle_error(res, 'Unable to suppress timeline item record.', error);
    }
};

exports.delete_timeline_item_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const timeline_id = req.params.timeline_id;
        const timeline_item_id = req.params.item_id;
        const record_type = req.query.type;

        if (timeline_item_id === undefined || timeline_item_id.length === 0 && timeline_id === undefined || timeline_id.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        const is_authorized = await check_authorization(
            req, res,
            ['delete_item', 'delete_any_item'],
            record_type, is_member_of_exhibit, timeline_item_id
        );
        if (!is_authorized) return false;

        const result = await TIMELINES_MODEL.delete_timeline_item_record(is_member_of_exhibit, timeline_id, timeline_item_id, record_type);
        res.status(result.status).send(result);

    } catch (error) {
        handle_error(res, 'Unable to delete timeline item.', error);
    }
};

exports.unlock_timeline_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const timeline_id = req.params.timeline_id;
        const item_id = req.params.item_id;
        const uid = req.query.uid;
        const force = req.query.force;
        let options = {};

        if (!validate_param(res, item_id)) return false;
        if (!validate_param(res, uid)) return false;

        if (force !== undefined && force === 'true') {
            options.force = true;
        } else {
            options.force = false;
        }

        /*
        const is_authorized = await check_authorization(
            req, res,
            ['update_any_item'],
            'timeline_item', exhibit_id, item_id
        );
        if (!is_authorized) return false;
        */

        const result = await TIMELINES_MODEL.unlock_timeline_item_record(uid, item_id, options);

        if (result === true) {
            res.status(200).send({
                message: 'Timeline item record unlocked.'
            });
        } else {
            res.status(400).send({
                message: 'Unable to unlock timeline item record'
            });
        }

    } catch (error) {
        handle_error(res, 'Unable to unlock timeline item record.', error);
    }
};

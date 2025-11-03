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
const TIMELINES_MODEL = require('../exhibits/timelines_model');
const AUTHORIZE = require('../auth/authorize');
// const GRIDS_MODEL = require("./grid_model");

exports.create_timeline_record = async function (req, res) {

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
        options.record_type = 'timeline';
        options.parent_id = is_member_of_exhibit;
        options.child_id = null;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const result = await TIMELINES_MODEL.create_timeline_record(is_member_of_exhibit, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to create timeline record. ${error.message}`});
    }
};

exports.update_timeline_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const timeline_id = req.params.timeline_id;
        const data = req.body;

        if (data === undefined || is_member_of_exhibit === undefined || timeline_id === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const permissions = ['update_item', 'update_any_item'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'timeline';
        options.parent_id = is_member_of_exhibit;
        options.child_id = timeline_id;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const result = await TIMELINES_MODEL.update_timeline_record(is_member_of_exhibit, timeline_id, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to update timeline record. ${error.message}`});
    }
};

exports.get_timeline_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const timeline_id = req.params.timeline_id;

        if (is_member_of_exhibit === undefined || timeline_id === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const result = await TIMELINES_MODEL.get_timeline_record(is_member_of_exhibit, timeline_id);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to get timeline record. ${error.message}`});
    }
};

exports.create_timeline_item_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const timeline_id = req.params.timeline_id;
        const data = req.body;

        if (is_member_of_exhibit === undefined || timeline_id === undefined || data === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const permissions = ['add_item', 'add_item_to_any_exhibit'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'timeline_item';
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

        const result = await TIMELINES_MODEL.create_timeline_item_record(is_member_of_exhibit, timeline_id, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to create timeline item record. ${error.message}`});
    }
};

exports.get_timeline_item_records = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const is_member_of_timeline = req.params.timeline_id;

        if (is_member_of_exhibit === undefined || is_member_of_timeline === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const result = await TIMELINES_MODEL.get_timeline_item_records(is_member_of_exhibit, is_member_of_timeline);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to get timeline item records. ${error.message}`});
    }
};

exports.get_timeline_item_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const is_member_of_timeline = req.params.timeline_id;
        const item_id = req.params.item_id;
        const type = req.query.type;

        if (is_member_of_exhibit === undefined || is_member_of_timeline === undefined || item_id === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (type === undefined) {
            const result = await TIMELINES_MODEL.get_timeline_item_record(is_member_of_exhibit, is_member_of_timeline, item_id);
            res.status(result.status).send(result);
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
        res.status(500).send({message: `Unable to get timeline item. ${error.message}`});
    }
};

exports.update_timeline_item_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const timeline_id = req.params.timeline_id;
        const item_id = req.params.item_id;
        const data = req.body;

        if (data === undefined || is_member_of_exhibit === undefined || timeline_id === undefined || item_id === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const permissions = ['update_item', 'update_any_item'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'timeline_item';
        options.parent_id = is_member_of_exhibit;
        options.child_id = item_id;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const result = await TIMELINES_MODEL.update_timeline_item_record(is_member_of_exhibit, timeline_id, item_id, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to update timeline item. ${error.message}`});
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

        const permissions = ['publish_item', 'publish_any_item'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'timeline_item';
        options.parent_id = exhibit_id;
        options.child_id = timeline_item_id;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

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
        res.status(500).send({message: `Unable to publish timeline item record. ${error.message}`});
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

        const permissions = ['suppress_item', 'suppress_any_item'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'timeline_item';
        options.parent_id = exhibit_id;
        options.child_id = timeline_item_id;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

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
        res.status(500).send({message: `Unable to suppress timeline item record. ${error.message}`});
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

        const permissions = ['delete_item', 'delete_any_item'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = record_type;
        options.parent_id = is_member_of_exhibit;
        options.child_id = timeline_item_id;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const result = await TIMELINES_MODEL.delete_timeline_item_record(is_member_of_exhibit, timeline_id, timeline_item_id, record_type);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to delete timeline item. ${error.message}`});
    }
};

exports.unlock_timeline_item_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const timeline_id = req.params.timeline_id;
        const item_id = req.params.item_id;
        const uid = req.query.uid;

        if (item_id === undefined || item_id.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (uid === undefined || uid.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        /*
        const permissions = ['update_any_item'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'timeline_item';
        options.parent_id = exhibit_id;
        options.child_id = item_id;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }
        */

        const result = await TIMELINES_MODEL.unlock_timeline_item_record(uid, item_id);

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
        res.status(500).send({message: `Unable to unlock timeline item record. ${error.message}`});
    }
};

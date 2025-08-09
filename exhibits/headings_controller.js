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
const AUTHORIZE = require("../auth/authorize");

exports.create_heading_record = async function (req, res) {

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
        options.record_type = 'heading_item';
        options.uuid = is_member_of_exhibit;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const result = await HEADINGS_MODEL.create_heading_record(is_member_of_exhibit, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(408).send({message: `Unable to create heading record. ${error.message}`});
    }
};

exports.get_heading_record = async function (req, res) {

    try {

        // TODO: type=edit,index,title
        const is_member_of_exhibit = req.params.exhibit_id;
        const uuid = req.params.heading_id;
        const uid = req.query.uid;
        const type = req.query.type;

        if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (type === undefined) {
            const data = await HEADINGS_MODEL.get_heading_record(is_member_of_exhibit, uuid);
            res.status(data.status).send(data);
            return false;
        }

        if (type === 'edit') {

            const uid = req.query.uid;

            if (uid === undefined || uid.length === 0) {
                res.status(400).send('Bad request.');
                return false;
            }

            const data = await HEADINGS_MODEL.get_heading_edit_record(uid, is_member_of_exhibit, uuid);
            res.status(data.status).send(data);
            return false;
        }

    } catch (error) {
        res.status(408).send({message: `Unable to get heading record. ${error.message}`});
    }
};

exports.update_heading_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const heading_id = req.params.heading_id;
        const data = req.body;

        if (heading_id === undefined || heading_id.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (data === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const result = await HEADINGS_MODEL.update_heading_record(is_member_of_exhibit, heading_id, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(408).send({message: `Unable to update heading record. ${error.message}`});
    }
};

exports.delete_heading_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const uuid = req.params.heading_id;

        if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        const result = await HEADINGS_MODEL.delete_heading_record(is_member_of_exhibit, uuid);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(408).send({message: `Unable to delete heading record. ${error.message}`});
    }
};

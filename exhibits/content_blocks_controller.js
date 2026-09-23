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

const CONTENT_BLOCKS_MODEL = require('../exhibits/content_blocks_model');
const AUTHORIZE = require('../auth/authorize');

exports.create_content_block_record = async function (req, res) {

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
        options.record_type = 'content block';
        options.parent_id = is_member_of_exhibit;
        options.child_id = null;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const result = await CONTENT_BLOCKS_MODEL.create_content_block_record(is_member_of_exhibit, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to create content block record. ${error.message}`});
    }
};

exports.get_content_block_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const uuid = req.params.content_block_id;
        const uid = req.query.uid;
        const type = req.query.type;

        if (uuid === undefined || uuid.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (type === undefined) {
            const data = await CONTENT_BLOCKS_MODEL.get_content_block_record(is_member_of_exhibit, uuid);
            res.status(data.status).send(data);
            return false;
        }

        if (type === 'details') {
            const data = await CONTENT_BLOCKS_MODEL.get_content_block_record(is_member_of_exhibit, uuid);
            res.status(data.status).send(data);
            return false;
        }

        if (type === 'edit') {
            const uid = req.query.uid;

            if (uid === undefined || uid.length === 0) {
                res.status(400).send('Bad request.');
                return false;
            }

            const data = await CONTENT_BLOCKS_MODEL.get_content_block_edit_record(uid, is_member_of_exhibit, uuid);
            res.status(data.status).send(data);
            console.log(2)
            return false;
        }

    } catch (error) {
        res.status(500).send({message: `Unable to get content block record. ${error.message}`});
    }
};

exports.update_content_block_record = async function (req, res) {

    try {

        const is_member_of_exhibit = req.params.exhibit_id;
        const content_block_id = req.params.content_block_id;
        const data = req.body;

        if (content_block_id === undefined || content_block_id.length === 0 && is_member_of_exhibit === undefined || is_member_of_exhibit.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (data === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const permissions = ['update_item', 'update_any_item'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = 'content block';
        options.parent_id = is_member_of_exhibit;
        options.child_id = content_block_id;

        const is_authorized = await AUTHORIZE.check_permission(options);

        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const result = await CONTENT_BLOCKS_MODEL.update_content_block_record(is_member_of_exhibit, content_block_id, data);
        res.status(result.status).send(result);

    } catch (error) {
        res.status(500).send({message: `Unable to update content block record. ${error.message}`});
    }
};

exports.unlock_content_block_record = async function (req, res) {

    try {

        const exhibit_id = req.params.exhibit_id;
        const content_block_id = req.params.content_block_id;
        const uid = req.query.uid;
        const force = req.query.force;
        let options = {};

        if (content_block_id === undefined || content_block_id.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (uid === undefined || uid.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        if (force !== undefined && force === 'true') {
            options.force = true;
        } else {
            options.force = false;
        }

        const result = await CONTENT_BLOCKS_MODEL.unlock_content_block_record(uid, content_block_id, options);

        /* helper unlock_record resolves to the unlocked record row, not a boolean */
        if (result && typeof result === 'object') {
            res.status(200).send({
                message: 'Content block record unlocked.'
            });
        } else {
            res.status(400).send({
                message: 'Unable to unlock content block record'
            });
        }

    } catch (error) {
        res.status(500).send({message: `Unable to unlock content block record. ${error.message}`});
    }
};

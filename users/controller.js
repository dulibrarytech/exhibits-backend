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

 */

'use strict';

const MODEL = require('../users/model');
const LOGGER = require("../libs/log4");
const AUTHORIZE = require("../auth/authorize");

/**
 * Gets Users
 * @param req
 * @param res
 */
exports.get_users = async function (req, res) {

    try {

        const permissions = ['view_users', 'add_users', 'update_users'];
        let options = {};
        options.req = req;
        options.permissions = permissions;
        options.record_type = null;
        options.parent_id = null;
        options.child_id = null;
        options.users = true;

        const is_authorized = await AUTHORIZE.check_permission(options);
        console.log('is_authorized ', is_authorized);
        if (is_authorized === false) {
            res.status(403).send({
                message: 'Unauthorized request'
            });

            return false;
        }

        const data = await MODEL.get_users();
        res.status(data.status).send(data.data);
    } catch (error) {
        LOGGER.module().error('ERROR: [/auth/controller (get_users)] unable to get user records ' + error.message);
        res.status(500).send({message: `Unable to get user records. ${error.message}`});
    }
};

/**
 * Gets single user record
 * @param req
 * @param res
 */
exports.get_user = async function (req, res) {

    try {

        const user_id = req.params.user_id;

        if (user_id === undefined || user_id.length === 0) {
            res.status(400).send('Bad request.');
            return false;
        }

        const data = await MODEL.get_user(user_id);
        res.status(data.status).send(data.data);

    } catch (error) {
        LOGGER.module().error('ERROR: [/user/controller (get_user)] unable to get user ' + error.message);
        res.status(500).send({message: `Unable to get user record. ${error.message}`});
    }
};

/**
 * Updates user
 * @param req
 * @param res
 */
exports.update_user = async function (req, res) {

    try {

        const user_id = req.params.user_id;
        const data = req.body;

        if (user_id === undefined || data === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const result = await MODEL.update_user(user_id, data);
        res.status(result.status).send(result);

    } catch (error) {
        LOGGER.module().error('ERROR: [/user/controller (update_user)] unable to update user record ' + error.message);
        res.status(500).send({message: `Unable to update user record. ${error.message}`});
    }
};

/**
 * Saves user
 * @param req
 * @param res
 */
exports.save_user = async function (req, res) {

    try {

        const data = req.body;

        if (data === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const response = await MODEL.save_user(data);
        res.status(response.status).send(response.data);

    } catch (error) {
        LOGGER.module().error('ERROR: [/user/controller (save_user)] unable to save user record ' + error.message);
        res.status(500).send({message: `Unable to save user record. ${error.message}`});
    }
};

/**
 * Deletes user
 * @param req
 * @param res
 */
exports.delete_user = async function (req, res) {

    try {

        const user_id = req.params.user_id;

        if (user_id === undefined) {
            res.status(400).send('Bad request.');
            return false;
        }

        const response = await MODEL.delete_user(user_id);
        res.sendStatus(response.status);

    } catch (error) {
        LOGGER.module().error('ERROR: [/user/controller (delete_user)] unable to delete user record ' + error.message);
        res.status(500).send({message: `Unable to delete user record. ${error.message}`});
    }
};

/**
 * Updates user status
 * @param req
 * @param res
 */
exports.update_status = async function (req, res) {

    try {

        const id = req.params.id;
        const is_active = req.params.is_active;
        const data = await MODEL.update_status(id, is_active);
        res.status(data.status).send(data.data);

    } catch (error) {
        LOGGER.module().error('ERROR: [/auth/controller (update_status)] unable update status ' + error.message);
    }
};

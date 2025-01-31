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
const EXHIBITS_MODEL = require("../exhibits/exhibits_model");

/**
 * Gets Users
 * @param req
 * @param res
 */
exports.get_users = async function (req, res) {

    try {
        const data = await MODEL.get_users();
        res.status(data.status).send(data.data);
    } catch (error) {
        LOGGER.module().error('ERROR: [/auth/controller (get_users)] unable to get users ' + error.message);
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
        LOGGER.module().error('ERROR: [/auth/controller (get_user)] unable to get user ' + error.message);
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
        res.status(500).send({message: `Unable to update exhibit record. ${error.message}`});
    }
};

/**
 * Saves user
 * @param req
 * @param res
 */
exports.save_user = (req, res) => {

    let user = req.body;

    MODEL.save_user(user, (data) => {
        res.status(data.status).send(data.data);
    });
};

/**
 * Deletes user
 * @param req
 * @param res
 */
exports.delete_user = (req, res) => {

    const id = req.query.id;

    MODEL.delete_user(id, (data) => {
        res.status(data.status).send(data.data);
    });
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

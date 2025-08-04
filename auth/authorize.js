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

const VALIDATOR = require('validator');
const DB = require('../config/db_config')();
const DB_TABLES = require('../config/db_tables_config')();
const TABLE = DB_TABLES.exhibits.user_records;
const AUTH = require('../auth/tasks/auth_tasks');
const AUTH_TASKS = new AUTH(DB, TABLE);
const LOGGER = require('../libs/log4');

/**
 * Checks user permissions
 * @param permission_type
 */
exports.check_permission = function (permission_type) {

    try {

        return (req, res, next) => {

            (async function() {

                let user_role_permissions = [];
                let permissions = [];
                let token = req.headers['x-access-token'];

                if (token !== undefined && VALIDATOR.isJWT(token)) {

                    let user_permissions = await AUTH_TASKS.get_user_permissions(token);

                    for (let i = 0; i < user_permissions.length; i++) {
                        user_role_permissions.push(user_permissions[i].permission_id);
                    }

                    let role_permissions = await AUTH_TASKS.get_role_permissions(permission_type);

                    for (let i = 0; i < role_permissions.length; i++) {
                        permissions.push(role_permissions[i].id);
                    }

                    let has_permission = user_role_permissions.some((permission) => {
                        return permissions.indexOf(permission) !== -1;
                    });

                    if (has_permission === true) {
                        console.log('Authorized!');
                        next();
                    } else if (has_permission === false) {

                        res.status(403).send({
                            message: 'Unauthorized request'
                        });
                    }
                } else {

                    res.status(401).send({
                        message: 'Access denied'
                    });
                }

            })();

        };

    } catch (error) {
        LOGGER.module().error('ERROR: [/auth/authorize lib (check_permission)] unable to check permission ' + error.message);
    }
};

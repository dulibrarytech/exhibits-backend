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
const res = require("express/lib/response");
const {permission} = require("kaltura-client/KalturaServices");

/**
 * Checks user permission
 * @param req
 * @param permissions
 */
exports.check_permission = async function (req, permissions) {

    try {

        let user_role_permissions = [];
        let permissions = [];
        let token = req.headers['x-access-token'];

        if (token === undefined && !VALIDATOR.isJWT(token)) {
            return false;
        }

        let user_permissions = await AUTH_TASKS.get_user_permissions(token);

        for (let i = 0; i < user_permissions.length; i++) {
            user_role_permissions.push(user_permissions[i].permission_id);
        }

        console.log('permissions for this action', permissions);
        console.log('my permissions ', user_role_permissions);

        let all_permissions = await AUTH_TASKS.get_permissions();

        console.log('all ', all_permissions);

        // TODO: filter
        function check_permission(permission) {
            return permission.permission === permissions;
        }

        /*
        for (let i = 0; i < role_permissions.length; i++) {
            permissions.push(role_permissions[i].permission);
        }
        console.log('All permissions ', permissions);
        */
        // console.log('permissions being checked', permissions);
        /*
        const inventory = [
            { name: "apples", quantity: 2 },
            { name: "bananas", quantity: 0 },
            { name: "cherries", quantity: 5 },
        ];

        function isCherries(fruit) {
            return fruit.name === "cherries";
        }

            console.log(inventory.find(isCherries));
            // { name: 'cherries', quantity: 5 }
         */

        /*
        let has_permission = user_role_permissions.some((permission_check) => {
            console.log('checking permission ', permission_check);

            return permission_check.find(permissions) !== -1;
        });
        console.log('has_permission', has_permission);
        if (has_permission === true) {
            LOGGER.module().info('INFO: [/auth/authorize lib (check_permission)] Authorized!');
            return true;
        } else if (has_permission === false) {
            LOGGER.module().warn('WARNING: [/auth/authorize lib (check_permission)] Unauthorized request');
            return false;
        }

         */


    } catch (error) {
        LOGGER.module().error('ERROR: [/auth/authorize lib (check_permission)] unable to check permission ' + error.message);
    }
};

/**
 * Checks ownership of asset
 * @param user_id
 * @param type
 */
exports.check_ownership = function (user_id, type) {
    console.log(user_id);
    console.log(type);
};

/**
 * Checks user permissions
 * @param permission_type
 */
exports.check_permission_ = function () {

    try {

        return (req, res, next) => {

            (async function () {

                let user_role_permissions = [];
                let permissions = [];
                let token = req.headers['x-access-token'];

                if (token !== undefined && VALIDATOR.isJWT(token)) {

                    let user_permissions = await AUTH_TASKS.get_user_permissions(token);

                    // these are the permissions the user has based on their assigned role

                    for (let i = 0; i < user_permissions.length; i++) {
                        user_role_permissions.push(user_permissions[i].permission_id);
                    }

                    console.log(user_permissions);
                    console.log('permissions associated with role ', user_role_permissions);

                    // TODO: compare user id with asset owner
                    let role_permissions = await AUTH_TASKS.get_role_permissions();

                    console.log('user permissions ', role_permissions);


                    for (let i = 0; i < role_permissions.length; i++) {
                        permissions.push(role_permissions[i].id);
                    }

                    console.log('permissions ', permissions);

                    let has_permission = user_role_permissions.some((permission) => {
                        return permissions.indexOf(permission) !== -1;
                    });

                    if (has_permission === true) {
                        LOGGER.module().info('INFO: [/auth/authorize lib (check_permission)] Authorized!');
                        next();
                    } else if (has_permission === false) {

                        res.status(403).send({
                            message: 'Unauthorized request'
                        });
                    }


                    next();
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

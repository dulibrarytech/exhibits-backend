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

const CONFIG = require('../config/webservices_config')();
const TOKEN = require('../libs/tokens');
const MODEL = require('../auth/model');
const LOGGER = require('../libs/log4');

exports.sso = async function (req, res) {

    const SSO_HOST = req.body.HTTP_HOST;
    const USERNAME = req.body.employeeID;

    if (SSO_HOST === CONFIG.ssoHost && USERNAME !== undefined) {

        try {

            let result;
            let token = TOKEN.create(USERNAME);
            token = encodeURIComponent(token);
            result = await MODEL.check_auth_user(USERNAME);

            if (result.auth === true) {
                res.redirect('/dashboard/home?t=' + token + '&id=' + result.data);
            } else {
                res.status(401).send({
                    message: 'Authenticate failed.'
                });
            }

        } catch (error) {
            LOGGER.module().error('ERROR: [/auth/controller (sso)] unable to complete authentication ' + error.message);
        }
    }
};

exports.get_auth_user_data = async function (req, res) {
    const ID = req.query.id;
    const data = await MODEL.get_auth_user_data(ID);
    res.status(data.status).send(data.data);
};

exports.logout = function (req, res) {

    res.render('logout', {
        host: CONFIG.host,
        appname: CONFIG.appName,
        appversion: CONFIG.appVersion,
        organization: CONFIG.organization,
        redirect: CONFIG.ssoLogoutUrl
    });
};

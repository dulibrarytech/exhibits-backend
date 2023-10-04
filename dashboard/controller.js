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

const CONFIG = require('../config/app_config')();
const SSO_CONFIG = require('../config/webservices_config')();

exports.get_dashboard = function (req, res) {
    res.redirect('/dashboard/login');
};

exports.get_dashboard_exhibits = function (req, res) {
    res.render('dashboard-exhibits', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_exhibits_form = function (req, res) {
    res.render('dashboard-exhibits-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_items = function (req, res) {
    res.render('dashboard-items', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_item_heading_form = function (req, res) {
    res.render('dashboard-item-heading-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_item_standard_form = function (req, res) {
    res.render('dashboard-item-standard-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_item_grid_form = function (req, res) {
    res.render('dashboard-item-grid-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_item_vertical_timeline = function (req, res) {
    res.render('dashboard-item-vertical-timeline-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_trash = function (req, res) {
    res.render('dashboard-trash', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_login = function (req, res) {
    res.render('dashboard-login', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization,
        sso_url: SSO_CONFIG.ssoUrl,
        sso_response_url: SSO_CONFIG.ssoResponseUrl
    });
};

exports.get_dashboard_logout = function (req, res) {
    res.render('dashboard-logout', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization,
        sso_logout: SSO_CONFIG.ssoLogoutUrl
    });
};

//
/*
exports.get_dashboard_users = function (req, res) {
    res.render('dashboard-users', {
        host: CONFIG.host,
        appname: CONFIG.appName,
        appversion: CONFIG.appVersion,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_user_detail = function (req, res) {
    res.render('dashboard-users-detail', {
        host: CONFIG.host,
        appname: CONFIG.appName,
        appversion: CONFIG.appVersion,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_user_add_form = function (req, res) {
    res.renderStatic('dashboard-add-user', {
        host: CONFIG.host,
        appname: CONFIG.appName,
        appversion: CONFIG.appVersion,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_user_edit_form = function (req, res) {
    res.render('dashboard-edit-user', {
        host: CONFIG.host,
        appname: CONFIG.appName,
        appversion: CONFIG.appVersion,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_user_delete_form = function (req, res) {
    res.render('dashboard-delete-user', {
        host: CONFIG.host,
        appname: CONFIG.appName,
        appversion: CONFIG.appVersion,
        organization: CONFIG.organization
    });
};

 */

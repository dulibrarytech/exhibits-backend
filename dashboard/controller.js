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

exports.default = function (req, res) {
    res.status(403).send({
        info: 'University of Denver Libraries - Exhibits'
    });
};

//======================== Exhibits ========================//
exports.get_dashboard_exhibits = function (req, res) {
    res.render('exhibits/dashboard-exhibits', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization,
        app_message: CONFIG.app_message
    });
};

exports.get_dashboard_exhibits_add_form = function (req, res) {
    res.render('exhibits/dashboard-exhibits-add-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_exhibits_details = function (req, res) {
    res.render('exhibits/dashboard-exhibits-details', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_exhibits_edit_form = function (req, res) {
    res.render('exhibits/dashboard-exhibits-edit-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_exhibits_delete_form = function (req, res) {
    res.render('exhibits/dashboard-exhibits-delete-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

//======================== Heading items ========================//
exports.get_dashboard_item_heading_add_form = function (req, res) {
    res.render('dashboard-item-heading-add-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_item_heading_details = function (req, res) {
    res.render('dashboard-item-heading-details', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_items_heading_edit_form = function (req, res) {
    res.render('dashboard-item-heading-edit-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

//======================== Standard items ========================//
exports.get_dashboard_items = function (req, res) {
    res.render('dashboard-items', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_items_standard_details = function (req, res) {
    res.render('dashboard-item-standard-details', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_items_standard_media_details = function (req, res) {
    res.render('dashboard-item-standard-media-details', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_items_standard_text_details = function (req, res) {
    res.render('dashboard-item-standard-text-details', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};


exports.get_dashboard_items_delete_form = function (req, res) {
    res.render('dashboard-items-delete-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_items_standard_media_add_form = function (req, res) {
    res.render('dashboard-item-standard-media-add-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_items_standard_media_edit_form = function (req, res) {
    res.render('dashboard-item-standard-media-edit-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_items_standard_text_add_form = function (req, res) {
    res.render('dashboard-item-standard-text-add-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_items_standard_text_edit_form = function (req, res) {
    res.render('dashboard-item-standard-text-edit-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

//======================== Grids ========================//
exports.get_dashboard_grid_add_form = function (req, res) {
    res.render('dashboard-grid-add-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_grid_add_form = function (req, res) {
    res.render('dashboard-grid-add-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_grid_details = function (req, res) {
    res.render('dashboard-grid-details', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_grid_edit_form = function (req, res) {
    res.render('dashboard-grid-edit-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_grid_add_media_item_form = function (req, res) {
    res.render('dashboard-grid-add-media-item-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_grid_add_text_item_form = function (req, res) {
    res.render('dashboard-grid-add-text-item-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_grid_edit_media_item_form = function (req, res) {
    res.render('dashboard-grid-edit-media-item-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_grid_edit_text_item_form = function (req, res) {
    res.render('dashboard-grid-edit-text-item-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_grid_item_details = function (req, res) {
    res.render('dashboard-grid-item-details', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_grid_item_media_details = function (req, res) {
    res.render('dashboard-grid-item-media-details', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_grid_item_text_details = function (req, res) {
    res.render('dashboard-grid-item-text-details', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_item_grid_items = function (req, res) {
    res.render('dashboard-grid-items', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_grid_items_delete_form = function (req, res) {
    res.render('dashboard-grid-items-delete-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

//======================== Timelines ========================//
exports.get_dashboard_vertical_timeline_add_form = function (req, res) {
    res.render('dashboard-vertical-timeline-add-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_vertical_timeline_details = function (req, res) {
    res.render('dashboard-vertical-timeline-details', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_vertical_timeline_edit_form = function (req, res) {
    res.render('dashboard-vertical-timeline-edit-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_vertical_timeline_item_add_form = function (req, res) {
    res.render('dashboard-vertical-timeline-item-add-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_vertical_timeline_item_edit_form = function (req, res) {
    res.render('dashboard-vertical-timeline-item-edit-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_vertical_timeline_item_details = function (req, res) {
    res.render('dashboard-vertical-timeline-item-details', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_item_timeline_items = function (req, res) {
    res.render('dashboard-timeline-items', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_timeline_items_delete_form = function (req, res) {
    res.render('dashboard-timeline-items-delete-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

//======================== Auth ========================//
exports.get_dashboard_login = function (req, res) {
    res.render('dashboard-login', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization,
        sso_url: SSO_CONFIG.sso_url,
        sso_response_url: SSO_CONFIG.sso_response_url

    });
};

exports.get_dashboard_session_out = function (req, res) {
    res.render('dashboard-session-out', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

exports.get_dashboard_logout = function (req, res) {
    res.render('dashboard-logout', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization,
        sso_logout_url: SSO_CONFIG.sso_logout_url
    });
};

//======================== Users ========================//
exports.get_dashboard_users = function (req, res) {
    res.render('dashboard-users', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization,
        sso_logout_url: SSO_CONFIG.sso_logout_url
    });
};

exports.get_dashboard_users_add_form = function (req, res) {
    res.render('dashboard-add-user', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization,
        sso_logout_url: SSO_CONFIG.sso_logout_url
    });
};

exports.get_dashboard_users_edit_form = function (req, res) {
    res.render('dashboard-edit-user', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization,
        sso_logout_url: SSO_CONFIG.sso_logout_url
    });
};

exports.get_dashboard_users_delete_form = function (req, res) {
    res.render('dashboard-delete-user-form', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization,
        sso_logout_url: SSO_CONFIG.sso_logout_url
    });
};

exports.get_dashboard_recycle = function (req, res) {
    res.render('dashboard-recycle', {
        host: CONFIG.host,
        appname: CONFIG.app_name,
        appversion: CONFIG.app_version,
        organization: CONFIG.organization
    });
};

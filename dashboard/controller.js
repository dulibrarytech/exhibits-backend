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

const template_config = {
    host: CONFIG.host,
    appname: CONFIG.app_name,
    appversion: CONFIG.app_version,
    organization: CONFIG.organization,
    app_message: CONFIG.app_message,
    build_version: CONFIG.build_version
};

//======================== Exhibits ========================//
exports.get_dashboard_exhibits = function (req, res) {
    res.render('dist/exhibits/dashboard-exhibits', template_config);
};

exports.get_dashboard_exhibits_add_form = function (req, res) {
    res.render('dist/exhibits/dashboard-exhibits-add-form', template_config);
};

exports.get_dashboard_exhibits_details = function (req, res) {
    res.render('dist/exhibits/dashboard-exhibits-details', template_config);
};

exports.get_dashboard_exhibits_edit_form = function (req, res) {
    res.render('dist/exhibits/dashboard-exhibits-edit-form', template_config);
};

exports.get_dashboard_exhibits_delete_form = function (req, res) {
    res.render('dist/exhibits/dashboard-exhibits-delete-form', template_config);
};

//======================== Heading items ========================//
exports.get_dashboard_item_heading_add_form = function (req, res) {
    res.render('dist/heading-items/dashboard-item-heading-add-form', template_config);
};

exports.get_dashboard_item_heading_details = function (req, res) {
    res.render('dist/heading-items/dashboard-item-heading-details', template_config);
};

exports.get_dashboard_items_heading_edit_form = function (req, res) {
    res.render('dist/heading-items/dashboard-item-heading-edit-form', template_config);
};

//======================== Standard items ========================//
exports.get_dashboard_items = function (req, res) {
    res.render('dist/standard-items/dashboard-items', template_config);
};

exports.get_dashboard_items_standard_details = function (req, res) {
    res.render('dist/standard-items/dashboard-item-standard-details', template_config);
};

exports.get_dashboard_items_standard_media_details = function (req, res) {
    res.render('dist/standard-items/dashboard-item-standard-media-details', template_config);
};

exports.get_dashboard_items_standard_text_details = function (req, res) {
    res.render('dist/standard-items/dashboard-item-standard-text-details', template_config);
};

exports.get_dashboard_items_delete_form = function (req, res) {
    res.render('dist/standard-items/dashboard-items-delete-form', template_config);
};

exports.get_dashboard_items_standard_media_add_form = function (req, res) {
    res.render('dist/standard-items/dashboard-item-standard-media-add-form', template_config);
};

exports.get_dashboard_items_standard_media_edit_form = function (req, res) {
    res.render('dist/standard-items/dashboard-item-standard-media-edit-form', template_config);
};

exports.get_dashboard_items_standard_text_add_form = function (req, res) {
    res.render('dist/standard-items/dashboard-item-standard-text-add-form', template_config);
};

exports.get_dashboard_items_standard_text_edit_form = function (req, res) {
    res.render('dist/standard-items/dashboard-item-standard-text-edit-form', template_config);
};

//======================== Grids ========================//
exports.get_dashboard_grid_add_form = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-add-form', template_config);
};

exports.get_dashboard_grid_add_form = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-add-form', template_config);
};

exports.get_dashboard_grid_details = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-details', template_config);
};

exports.get_dashboard_grid_edit_form = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-edit-form', template_config);
};

exports.get_dashboard_grid_add_media_item_form = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-add-media-item-form', template_config);
};

exports.get_dashboard_grid_add_text_item_form = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-add-text-item-form', template_config);
};

exports.get_dashboard_grid_edit_media_item_form = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-edit-media-item-form', template_config);
};

exports.get_dashboard_grid_edit_text_item_form = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-edit-text-item-form', template_config);
};

exports.get_dashboard_grid_item_details = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-item-details', template_config);
};

exports.get_dashboard_grid_item_media_details = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-item-media-details', template_config);
};

exports.get_dashboard_grid_item_text_details = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-item-text-details', template_config);
};

exports.get_dashboard_item_grid_items = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-items', template_config);
};

exports.get_dashboard_grid_items_delete_form = function (req, res) {
    res.render('dist/grid-items/dashboard-grid-items-delete-form', template_config);
};

//======================== Timelines ========================//
exports.get_dashboard_vertical_timeline_add_form = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-add-form', template_config);
};

exports.get_dashboard_vertical_timeline_details = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-details', template_config);
};

exports.get_dashboard_vertical_timeline_edit_form = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-edit-form', template_config);
};

exports.get_dashboard_vertical_timeline_item_media_add_form = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-item-media-add-form', template_config);
};

exports.get_dashboard_vertical_timeline_item_media_edit_form = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-item-media-edit-form', template_config);
};

exports.get_dashboard_vertical_timeline_item_text_add_form = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-item-text-add-form', template_config);
};

exports.get_dashboard_vertical_timeline_item_text_edit_form = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-item-text-edit-form', template_config);
};

exports.get_dashboard_vertical_timeline_item_media_details = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-item-media-details', template_config);
};

exports.get_dashboard_vertical_timeline_item_text_details = function (req, res) {
    res.render('dist/timeline-items/dashboard-vertical-timeline-item-text-details', template_config);
};

exports.get_dashboard_item_timeline_items = function (req, res) {
    res.render('dist/timeline-items/dashboard-timeline-items', template_config);
};

exports.get_dashboard_timeline_items_delete_form = function (req, res) {
    res.render('dist/timeline-items/dashboard-timeline-items-delete-form', template_config);
};

//======================== Auth ========================//
exports.get_dashboard_session_out = function (req, res) {
    res.render('dist/dashboard-session-out', template_config);
};

exports.get_dashboard_logout = function (req, res) {
    template_config.sso_logout_url = SSO_CONFIG.sso_logout_url;
    res.render('dist/dashboard-logout', template_config);
};

//======================== Users ========================//
exports.get_dashboard_users = function (req, res) {
    res.render('dist/users/dashboard-users', template_config);
};

exports.get_dashboard_users_add_form = function (req, res) {
    res.render('dist/users/dashboard-add-user', template_config);
};

exports.get_dashboard_users_edit_form = function (req, res) {
    res.render('dist/users/dashboard-edit-user', template_config);
};

exports.get_dashboard_users_delete_form = function (req, res) {
    res.render('dist/users/dashboard-delete-user-form', template_config);
};

exports.get_dashboard_access_denied = function (req, res) {
    res.render('dist/dashboard-access-denied', template_config);
};

exports.get_dashboard_recycle = function (req, res) {
    res.render('dist/dashboard-recycle', template_config);
};

//======================== Media Library ========================//
exports.get_dashboard_media = function (req, res) {
    res.render('media-library/dashboard-media-home.ejs', template_config);
};
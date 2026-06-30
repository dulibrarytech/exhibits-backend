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

const APP_CONFIG = require('../config/app_config')();
const CONTROLLER = require('../dashboard/controller');
const TOKENS = require('../libs/tokens');
const APP_PATH = APP_CONFIG.app_path;

// Page-level auth for the dashboard HTML. verify_page reads the session from the
// `exhibits_token` cookie (sent on page navigations) and redirects to SSO if it's
// missing/invalid, so the admin UI isn't served to anonymous users. (Data APIs are
// already protected separately.) The auth/error pages — logout, session-out,
// access-denied — stay public.
const PAGE_AUTH = TOKENS.verify_page;

module.exports = function (app) {

    //============Exhibits============//
    app.route(APP_PATH + '/exhibits')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_exhibits);

    app.route(APP_PATH + '/exhibits/exhibit')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_exhibits_add_form);

    app.route(APP_PATH + '/exhibits/exhibit/details')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_exhibits_details);

    app.route(APP_PATH + '/exhibits/exhibit/edit')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_exhibits_edit_form);

    app.route(APP_PATH + '/exhibits/exhibit/delete')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_exhibits_delete_form);

    //============Standard Items============//
    app.route(APP_PATH + '/items')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_items);

    app.route(APP_PATH + '/items/standard/media')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_items_standard_media_add_form);

    app.route(APP_PATH + '/items/standard/text')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_items_standard_text_add_form);

    app.route(APP_PATH + '/items/standard/media/edit')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_items_standard_media_edit_form);

    app.route(APP_PATH + '/items/standard/text/edit')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_items_standard_text_edit_form);

    app.route(APP_PATH + '/items/standard/media/details')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_items_standard_media_details);

    app.route(APP_PATH + '/items/standard/text/details')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_items_standard_text_details);

    //============Headings============//
    app.route(APP_PATH + '/items/heading')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_item_heading_add_form);

    app.route(APP_PATH + '/items/heading/details')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_item_heading_details);

    app.route(APP_PATH + '/items/heading/edit')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_items_heading_edit_form);

    //============Grids============//
    app.route(APP_PATH + '/items/grid')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_grid_add_form);

    app.route(APP_PATH + '/items/grid/details')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_grid_details);

    app.route(APP_PATH + '/items/grid/edit')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_grid_edit_form);

    app.route(APP_PATH + '/items/grid/item/media')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_grid_add_media_item_form);

    app.route(APP_PATH + '/items/grid/item/text')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_grid_add_text_item_form);

    app.route(APP_PATH + '/items/grid/item/media/details')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_grid_item_media_details);

    app.route(APP_PATH + '/items/grid/item/text/details')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_grid_item_text_details);

    app.route(APP_PATH + '/items/grid/item/media/edit')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_grid_edit_media_item_form);

    app.route(APP_PATH + '/items/grid/item/text/edit')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_grid_edit_text_item_form);

    app.route(APP_PATH + '/items/grid/items')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_item_grid_items);

    app.route(APP_PATH + '/items/grid/item/delete')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_grid_items_delete_form);

    //============Timelines============//
    app.route(APP_PATH + '/items/vertical-timeline')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_vertical_timeline_add_form);

    app.route(APP_PATH + '/items/vertical-timeline/details')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_vertical_timeline_details);

    app.route(APP_PATH + '/items/vertical-timeline/edit')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_vertical_timeline_edit_form);

    app.route(APP_PATH + '/items/vertical-timeline/item/media')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_vertical_timeline_item_media_add_form);

    app.route(APP_PATH + '/items/vertical-timeline/item/media/edit')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_vertical_timeline_item_media_edit_form);

    app.route(APP_PATH + '/items/vertical-timeline/item/text')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_vertical_timeline_item_text_add_form);

    app.route(APP_PATH + '/items/vertical-timeline/item/text/edit')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_vertical_timeline_item_text_edit_form);

    app.route(APP_PATH + '/items/vertical-timeline/item/media/details')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_vertical_timeline_item_media_details);

    app.route(APP_PATH + '/items/vertical-timeline/item/text/details')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_vertical_timeline_item_text_details);

    app.route(APP_PATH + '/items/timeline/items')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_item_timeline_items);

    app.route(APP_PATH + '/items/timeline/item/delete')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_timeline_items_delete_form);

    app.route(APP_PATH + '/items/delete')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_items_delete_form);

    //============Users============//
    app.route(APP_PATH + '/users')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_users);

    app.route(APP_PATH + '/users/add')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_users_add_form);

    app.route(APP_PATH + '/users/edit')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_users_edit_form);

    app.route(APP_PATH + '/users/delete')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_users_delete_form);

    app.route(APP_PATH + '/session')
        .get(CONTROLLER.get_dashboard_session_out);

    app.route(APP_PATH + '/logout')
        .get(CONTROLLER.get_dashboard_logout);

    app.route(APP_PATH + '/access-denied')
        .get(CONTROLLER.get_dashboard_access_denied);

    app.route(APP_PATH + '/recycle')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_recycle);

    //============Media============//
    app.route(APP_PATH + '/media/library')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_media);

    //============Styles============//
    app.route(APP_PATH + '/styles')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_styles);

    //============Index Management============//
    app.route(APP_PATH + '/index-management')
        .get(PAGE_AUTH, CONTROLLER.get_dashboard_index_management);

};

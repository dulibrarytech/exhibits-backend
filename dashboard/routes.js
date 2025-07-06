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

const CONTROLLER = require('../dashboard/controller');
const APP_PATH = '/exhibits-dashboard';

module.exports = function (app) {

    //============Exhibits============//
    app.route(APP_PATH + '/exhibits')
        .get(CONTROLLER.get_dashboard_exhibits);

    app.route(APP_PATH + '/exhibits/exhibit')
        .get(CONTROLLER.get_dashboard_exhibits_add_form);

    app.route(APP_PATH + '/exhibits/exhibit/details')
        .get(CONTROLLER.get_dashboard_exhibits_details);

    app.route(APP_PATH + '/exhibits/exhibit/edit')
        .get(CONTROLLER.get_dashboard_exhibits_edit_form);

    app.route(APP_PATH + '/exhibits/exhibit/delete')
        .get(CONTROLLER.get_dashboard_exhibits_delete_form);

    //============Standard Items============//
    app.route(APP_PATH + '/items')
        .get(CONTROLLER.get_dashboard_items);

    app.route(APP_PATH + '/items/standard/media')
        .get(CONTROLLER.get_dashboard_items_standard_media_add_form);

    app.route(APP_PATH + '/items/standard/text')
        .get(CONTROLLER.get_dashboard_items_standard_text_add_form);

    app.route(APP_PATH + '/items/standard/details')
        .get(CONTROLLER.get_dashboard_items_standard_details);

    app.route(APP_PATH + '/items/standard/media/edit')
        .get(CONTROLLER.get_dashboard_items_standard_media_edit_form);

    app.route(APP_PATH + '/items/standard/text/edit')
        .get(CONTROLLER.get_dashboard_items_standard_text_edit_form);

    //============Headings============//
    app.route(APP_PATH + '/items/heading')
        .get(CONTROLLER.get_dashboard_item_heading_add_form);

    app.route(APP_PATH + '/items/heading/details')
        .get(CONTROLLER.get_dashboard_item_heading_details);

    app.route(APP_PATH + '/items/heading/edit')
        .get(CONTROLLER.get_dashboard_items_heading_edit_form);

    //============Grids============//
    app.route(APP_PATH + '/items/grid')
        .get(CONTROLLER.get_dashboard_grid_add_form);

    app.route(APP_PATH + '/items/grid/details')
        .get(CONTROLLER.get_dashboard_grid_details);

    app.route(APP_PATH + '/items/grid/edit')
        .get(CONTROLLER.get_dashboard_grid_edit_form);

    app.route(APP_PATH + '/items/grid/item')
        .get(CONTROLLER.get_dashboard_grid_add_item_form);

    app.route(APP_PATH + '/items/grid/item/details')
        .get(CONTROLLER.get_dashboard_grid_item_details);

    app.route(APP_PATH + '/items/grid/item/edit')
        .get(CONTROLLER.get_dashboard_grid_edit_item_form);

    app.route(APP_PATH + '/items/grid/items')
        .get(CONTROLLER.get_dashboard_item_grid_items);

    app.route(APP_PATH + '/items/grid/item/delete')
        .get(CONTROLLER.get_dashboard_grid_items_delete_form);

    //============Timelines============//
    app.route(APP_PATH + '/items/vertical-timeline')
        .get(CONTROLLER.get_dashboard_vertical_timeline_add_form);

    app.route(APP_PATH + '/items/vertical-timeline/details')
        .get(CONTROLLER.get_dashboard_vertical_timeline_details);

    app.route(APP_PATH + '/items/vertical-timeline/edit')
        .get(CONTROLLER.get_dashboard_vertical_timeline_edit_form);

    app.route(APP_PATH + '/items/vertical-timeline/item')
        .get(CONTROLLER.get_dashboard_vertical_timeline_item_add_form);

    app.route(APP_PATH + '/items/vertical-timeline/item/edit')
        .get(CONTROLLER.get_dashboard_vertical_timeline_item_edit_form);

    app.route(APP_PATH + '/items/vertical-timeline/item/details')
        .get(CONTROLLER.get_dashboard_vertical_timeline_item_details);

    app.route(APP_PATH + '/items/timeline/items')
        .get(CONTROLLER.get_dashboard_item_timeline_items);

    app.route(APP_PATH + '/items/vertical-timeline/item/delete')
        .get(CONTROLLER.get_dashboard_timeline_items_delete_form);

    app.route(APP_PATH + '/items/delete')
        .get(CONTROLLER.get_dashboard_items_delete_form);

    //============Users============//
    app.route(APP_PATH + '/users')
        .get(CONTROLLER.get_dashboard_users);

    app.route(APP_PATH + '/users/add')
        .get(CONTROLLER.get_dashboard_users_add_form);

    app.route(APP_PATH + '/users/edit')
        .get(CONTROLLER.get_dashboard_users_edit_form);

    app.route(APP_PATH + '/users/delete')
        .get(CONTROLLER.get_dashboard_users_delete_form);

    app.route(APP_PATH + '/session')
        .get(CONTROLLER.get_dashboard_session_out);

    app.route(APP_PATH + '/logout')
        .get(CONTROLLER.get_dashboard_logout);

    app.route(APP_PATH + '/recycle')
        .get(CONTROLLER.get_dashboard_recycle);
};

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

    /*
    app.route(APP_PATH)
    .get(CONTROLLER.get_dashboard);
    */

    /*
    app.route(APP_PATH + '/dashboard/login')
    .get(CONTROLLER.get_dashboard_login);
    */

    app.route(APP_PATH + '/exhibits')
    .get(CONTROLLER.get_dashboard_exhibits);

    app.route(APP_PATH + '/exhibits/exhibit')
    .get(CONTROLLER.get_dashboard_exhibits_add_form);

    app.route(APP_PATH + '/exhibits/exhibit/edit')
    .get(CONTROLLER.get_dashboard_exhibits_edit_form);

    app.route(APP_PATH + '/exhibits/exhibit/delete')
    .get(CONTROLLER.get_dashboard_exhibits_delete_form);

    app.route(APP_PATH + '/items')
    .get(CONTROLLER.get_dashboard_items);

    app.route(APP_PATH + '/items/details')
    .get(CONTROLLER.get_dashboard_item_details);

    app.route(APP_PATH + '/items/standard')
    .get(CONTROLLER.get_dashboard_item_standard_form);

    app.route(APP_PATH + '/items/standard/edit')
    .get(CONTROLLER.get_dashboard_items_standard_edit_form);

    app.route(APP_PATH + '/items/grid/item')
    .get(CONTROLLER.get_dashboard_item_griditem_form);

    app.route(APP_PATH + '/items/grid')
    .get(CONTROLLER.get_dashboard_item_griditem_form);

    app.route(APP_PATH + '/items/heading')
    .get(CONTROLLER.get_dashboard_item_heading_form);

    app.route(APP_PATH + '/items/heading/edit')
    .get(CONTROLLER.get_dashboard_items_heading_edit_form);

    app.route(APP_PATH + '/items/grid/list')
    .get(CONTROLLER.get_dashboard_item_grid_list);

    app.route(APP_PATH + '/items/vertical-timeline')
    .get(CONTROLLER.get_dashboard_item_vertical_timeline);

    app.route(APP_PATH + '/trash')
    .get(CONTROLLER.get_dashboard_trash);

    app.route(APP_PATH + '/logout')
    .get(CONTROLLER.get_dashboard_logout);

    /*
    app.route('/dashboard/users')
    .get(CONTROLLER.get_dashboard_users);

    app.route('/dashboard/users/edit')
    .get(CONTROLLER.get_dashboard_user_edit_form);

    app.route('/dashboard/users/add')
    .get(CONTROLLER.get_dashboard_user_add_form);

    app.route('/dashboard/users/delete')
    .get(CONTROLLER.get_dashboard_user_delete_form);

     */
};
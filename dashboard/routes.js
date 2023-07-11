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

module.exports = function (app) {

    app.route('/dashboard/home')
    .get(CONTROLLER.get_dashboard_home);

    app.route('/dashboard/items')
    .get(CONTROLLER.get_dashboard_items);

    app.route('/dashboard/exhibits/add')
    .get(CONTROLLER.get_dashboard_exhibits_add_form);

    app.route('/dashboard/items/delete')
    .get(CONTROLLER.delete_dashboard_item);

    app.route('/dashboard/users')
    .get(CONTROLLER.get_dashboard_users);

    app.route('/dashboard/users/edit')
    .get(CONTROLLER.get_dashboard_user_edit_form);

    app.route('/dashboard/users/add')
    .get(CONTROLLER.get_dashboard_user_add_form);

    app.route('/dashboard/users/delete')
    .get(CONTROLLER.get_dashboard_user_delete_form);
};
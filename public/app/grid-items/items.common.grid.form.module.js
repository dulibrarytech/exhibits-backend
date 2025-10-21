/**

 Copyright 2024 University of Denver

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

const itemsCommonStandardGridFormModule = (function () {

    'use strict';

    let obj = {};

    obj.get_common_grid_form_fields = function () {

        try {

            const grid = { styles: {} };

            // Helper function for safe DOM queries
            const get_element_value = (selector, default_value = '') => {
                const el = document.querySelector(selector);
                return el?.value?.trim() ?? default_value;
            };

            const show_error = (message) => {
                const message_el = document.querySelector('#message');
                if (message_el) {
                    message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${message}</div>`;
                }
            };

            // Get grid metadata
            grid.title = get_element_value('#grid-title-input');
            grid.text = get_element_value('#grid-text-input');

            const columns_value = get_element_value('#grid-columns');

            // Validate columns is a valid number
            if (!columns_value || columns_value === '') {
                show_error('Please enter the number of columns');
                return false;
            }

            const parsed_columns = Number(columns_value);
            if (!Number.isInteger(parsed_columns) || parsed_columns <= 0 || parsed_columns > 12) {
                show_error('Please enter a valid number of columns (1-12)');
                return false;
            }

            grid.columns = parsed_columns.toString(); // converted to number at server

            return grid;

        } catch (error) {
            console.error('Error in get_common_grid_form_fields:', error.message);
            const message_el = document.querySelector('#message');
            if (message_el) {
                message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
            }
            return false;
        }
    };

    obj.init = async function () {

        try {

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();
            navModule.back_to_items();
            navModule.set_preview_link();

            let grid_background_color_picker = document.querySelector('#grid-background-color-picker');

            if (grid_background_color_picker) {
                document.querySelector('#grid-background-color-picker').addEventListener('input', () => {
                    if (document.querySelector('#grid-background-color')) {
                        document.querySelector('#grid-background-color').value = document.querySelector('#grid-background-color-picker').value;
                    }
                });

                document.querySelector('#grid-background-color').addEventListener('input', () => {
                    document.querySelector('#grid-background-color-picker').value = document.querySelector('#grid-background-color').value;
                });
            }

            let grid_font_color_picker = document.querySelector('#grid-font-color-picker');

            if (grid_font_color_picker) {
                document.querySelector('#grid-font-color-picker').addEventListener('input', () => {
                    if (document.querySelector('#grid-font-color')) {
                        document.querySelector('#grid-font-color').value = document.querySelector('#grid-font-color-picker').value;
                    }
                });

                document.querySelector('#grid-font-color').addEventListener('input', () => {
                    document.querySelector('#grid-font-color-picker').value = document.querySelector('#grid-font-color').value;
                });
            }

            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());

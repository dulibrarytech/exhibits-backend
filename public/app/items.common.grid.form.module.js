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

    /**
     * Gets common standard grid form fields
     */
    obj.get_common_grid_form_fields = function (rich_text_data) {

        try {

            let grid = {};
            grid.styles = {};

            // grid metadata
            grid.title = rich_text_data['grid-title-input'].getHTMLCode();
            grid.columns = document.querySelector('#grid-columns').value;

            // grid styles
            let grid_background_color = document.querySelector('#grid-background-color').value;
            let grid_color = document.querySelector('#grid-font-color').value;
            let grid_font = document.querySelector('#grid-font').value;
            let grid_font_size = document.querySelector('#grid-font-size').value;

            if (grid_background_color.length > 0) {
                grid.styles.backgroundColor = grid_background_color;
            }

            if (grid_color.length > 0) {
                grid.styles.color = document.querySelector('#grid-font-color').value;
            }

            if (grid_font.length > 0) {
                grid.styles.fontFamily = grid_font;
            }

            if (grid_font_size.length > 0) {
                grid.styles.fontSize = grid_font_size;
            }

            return grid;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Init function for grid common add/edit forms
     */
    obj.init = async function () {

        try {

            navModule.init();
            navModule.back_to_items();

            document.querySelector('#grid-background-color-picker').addEventListener('input', () => {
                if (document.querySelector('#grid-background-color')) {
                    document.querySelector('#grid-background-color').value = document.querySelector('#grid-background-color-picker').value;
                }
            });

            document.querySelector('#grid-font-color-picker').addEventListener('input', () => {
                if (document.querySelector('#grid-font-color')) {
                    document.querySelector('#grid-font-color').value = document.querySelector('#grid-font-color-picker').value;
                }
            });

            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());

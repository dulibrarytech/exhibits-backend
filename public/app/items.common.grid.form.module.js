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
     * Gets common standard item form fields
     */
    obj.get_common_grid_form_fields = function (rich_text_data) {

        try {

            let grid = {};
            grid.styles = {};

            // grid metadata
            grid.title = document.querySelector('#grid-title').value;
            grid.columns = document.querySelector('#grid-columns').value;

            // grid styles
            let item_background_color = document.querySelector('#item-background-color').value;
            let item_color = document.querySelector('#item-font-color').value;
            let item_font = document.querySelector('#item-font').value;
            let item_font_size = document.querySelector('#item-font-size').value;

            if (item_background_color.length > 0) {
                grid.styles.backgroundColor = item_background_color;
            }

            if (item_color.length > 0) {
                grid.styles.color = document.querySelector('#item-font-color').value;
            }

            if (item_font.length > 0) {
                grid.styles.fontFamily = item_font;
            }

            if (item_font_size.length > 0) {
                grid.styles.fontSize = item_font_size;
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
            console.log('common init');
            navModule.back_to_items();
            navModule.set_item_nav_menu_links();

            /*
            document.querySelector('#item-background-color-picker').addEventListener('input', () => {
                if (document.querySelector('#item-background-color')) {
                    document.querySelector('#item-background-color').value = document.querySelector('#item-background-color-picker').value;
                }
            });

            document.querySelector('#item-font-color-picker').addEventListener('input', () => {
                if (document.querySelector('#item-font-color')) {
                    document.querySelector('#item-font-color').value = document.querySelector('#item-font-color-picker').value;
                }
            });

            setTimeout(() => {
                document.querySelector('#item-data-card').style.visibility = 'visible';
            }, 250);

             */

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());

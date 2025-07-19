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

const itemsCommonHeadingFormModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Gets common heading form fields
     */
    obj.get_common_heading_form_fields = function () {

        try {

            let item_heading = {};
            item_heading.styles = {};
            item_heading.text = document.querySelector('#item-heading-text-input').value;

            if (item_heading.text.length === 0) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please enter heading text</div>`;
                return false;
            }

            if (document.querySelector('#is-published') !== null) {
                item_heading.is_published = document.querySelector('#is-published').value;
            }

            let heading_background_color =  document.querySelector('#heading-background-color').value;
            let heading_font_color = document.querySelector('#heading-font-color').value;
            let heading_font_size = document.querySelector('#heading-font-size').value;
            let heading_font = document.querySelector('#heading-font').value;

            if (heading_background_color.length > 0) {
                item_heading.styles.backgroundColor = heading_background_color;
            } else {
                item_heading.styles.backgroundColor = '';
            }

            if (heading_font_color.length > 0) {
                item_heading.styles.color = heading_font_color;
            } else {
                item_heading.styles.color = '';
            }

            if (heading_font.length > 0) {
                item_heading.styles.fontFamily = heading_font;
            } else {
                item_heading.styles.fontFamily = '';
            }

            if (heading_font_size.length > 0) {
                item_heading.styles.fontSize = `${heading_font_size}px`;
            } else {
                item_heading.styles.fontSize = '';
            }

            return item_heading;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    /**
     * Init function for exhibits common add/edit forms
     */
    obj.init = async function () {

        try {

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();
            navModule.back_to_items();
            navModule.set_preview_link();

            document.querySelector('#heading-background-color-picker').addEventListener('input', () => {
                if (document.querySelector('#heading-background-color')) {
                    document.querySelector('#heading-background-color').value = document.querySelector('#heading-background-color-picker').value;
                }
            });

            document.querySelector('#heading-background-color').addEventListener('input', () => {
                document.querySelector('#heading-background-color-picker').value = document.querySelector('#heading-background-color').value;
            });

            document.querySelector('#heading-font-color-picker').addEventListener('input', () => {
                if (document.querySelector('#heading-font-color')) {
                    document.querySelector('#heading-font-color').value = document.querySelector('#heading-font-color-picker').value;
                }
            });

            document.querySelector('#heading-font-color').addEventListener('input', () => {
                document.querySelector('#heading-font-color-picker').value = document.querySelector('#heading-font-color').value;
            });

            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());

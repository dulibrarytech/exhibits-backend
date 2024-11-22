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
    obj.get_common_heading_form_fields = function (rich_text_data) {

        try {

            let item_heading = {};
            item_heading.styles = {};
            item_heading.text = rich_text_data['item-heading-text-input'].getHTMLCode();

            if (item_heading.text.length === 0 || item_heading.text.title === '<div></div>') {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please enter heading text</div>`;
                return false;
            }

            let heading_background_color =  document.querySelector('#heading-background-color').value;
            let heading_font_color = document.querySelector('#heading-font-color').value;
            let heading_font_size = document.querySelector('#heading-font-size').value;
            let heading_font = document.querySelector('#heading-font').value;

            /*
            item_heading.styles = {
                backgroundColor: heading_background_color.length > 1 ? heading_background_color : '',
                color: heading_font_color.length > 1 ? heading_font_color : '',
                fontSize: heading_font_size.length > 1 ? heading_font_size : '',
                fontFamily: heading_font.length > 1 ? heading_font : ''
            };
             */

            if (heading_background_color.length > 0) {
                item_heading.styles.backgroundColor = heading_background_color;
            }

            if (heading_font_color.length > 0) {
                item_heading.styles.color = heading_font_color;
            }

            if (heading_font.length > 0) {
                item_heading.styles.fontFamily = heading_font;
            }

            if (heading_font_size.length > 0) {
                item_heading.styles.fontSize = `${heading_font_size}px`;
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

            navModule.init();
            navModule.back_to_items();

            document.querySelector('#heading-background-color-picker').addEventListener('input', () => {
                if (document.querySelector('#heading-background-color')) {
                    document.querySelector('#heading-background-color').value = document.querySelector('#heading-background-color-picker').value;
                }
            });

            document.querySelector('#heading-font-color-picker').addEventListener('input', () => {
                if (document.querySelector('#heading-font-color')) {
                    document.querySelector('#heading-font-color').value = document.querySelector('#heading-font-color-picker').value;
                }
            });

            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());

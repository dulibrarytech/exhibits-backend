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

    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /**
     * Gets common heading form fields
     */
    obj.get_common_heading_form_fields = function () {

        try {

            let item_heading = {};
            item_heading.styles = {};
            item_heading.text = document.querySelector('#item-heading-text').value;

            if (item_heading.text.length === 0) {
                document.querySelector('#message').innerHTML = '<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please enter heading text</div>';
                return false;
            }

            let heading_background_color =  document.querySelector('#heading-background-color').value;
            let heading_color = document.querySelector('#heading-font-color').value;
            let font = document.querySelector('#heading-font').value;

            if (heading_background_color.length > 0) {
                item_heading.styles.backGroundColor = heading_background_color;
            }

            if (heading_color.length > 0) {
                item_heading.styles.color = heading_color;
            }

            if (font.length > 0) {
                item_heading.styles.fontFamily = font;
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

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());

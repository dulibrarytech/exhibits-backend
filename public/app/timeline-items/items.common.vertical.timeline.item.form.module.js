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

const itemsCommonVerticalTimelineItemFormModule = (function () {

    'use strict';

    let obj = {};

    obj.get_common_timeline_item_form_fields = function () {

        try {

            let item = {};
            item.styles = {};

            // item metadata
            item.title = document.querySelector('#item-title-input').value;
            item.text = document.querySelector('#item-text-input').value;
            item.date = document.querySelector('input[type="date"]').value;

            if (window.location.pathname.indexOf('text') !== -1 && item.text.length === 0) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please enter "Text" for this item</div>`;
                return false;
            }

            if (item.date.length === 0) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Please enter a timeline date</div>`;
                return false;
            }

            if (window.location.pathname.indexOf('media') !== -1) {
                helperMediaModule.process_media_fields_common(item);
            } else {
                item.item_type = 'text';
                item.mime_type = 'text/plain';
            }

            // item styles
            /*
            let item_background_color = document.querySelector('#item-background-color').value;
            let item_color = document.querySelector('#item-font-color').value;
            let item_font = document.querySelector('#item-font').value;
            let item_font_size = document.querySelector('#item-font-size').value;

            if (item_background_color.length > 0) {
                item.styles.backgroundColor = item_background_color;
            }

            if (item_color.length > 0) {
                item.styles.color = document.querySelector('#item-font-color').value;
            }

            if (item_font.length > 0) {
                item.styles.fontFamily = item_font;
            }

            if (item_font_size.length > 0) {
                item.styles.fontSize = `${item_font_size}px`;
            }

             */

            return item;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.init = async function () {

        try {

            if (window.location.pathname.indexOf('media') !== -1) {
                helperMediaModule.media_common_init();
            }

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            navModule.init();
            navModule.back_to_timeline_items();
            navModule.set_preview_link();
            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());

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

const itemsCommonVerticalTimelineFormModule = (function () {

    'use strict';

    let obj = {};

    obj.get_common_timeline_form_fields = function () {

        try {

            const timeline = { styles: {} };

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

            // Get timeline metadata
            timeline.title = get_element_value('#timeline-title-input');
            timeline.text = get_element_value('#timeline-text-input');

            // Validate required title field
            /*
            if (!timeline.title || timeline.title.length === 0) {
                show_error('Please enter a title for the timeline');
                return false;
            }
            */

            return timeline;

        } catch (error) {
            console.error('Error in get_common_timeline_form_fields:', error.message);
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

            let timeline_background_color_picker =  document.querySelector('#timeline-background-color-picker');

            if (timeline_background_color_picker) {
                document.querySelector('#timeline-background-color-picker').addEventListener('input', () => {
                    if (document.querySelector('#timeline-background-color')) {
                        document.querySelector('#timeline-background-color').value = document.querySelector('#timeline-background-color-picker').value;
                    }
                });
            }

            let timeline_font_color_picker =  document.querySelector('#timeline-font_color-picker');

            if (timeline_font_color_picker) {
                document.querySelector('#timeline-font-color-picker').addEventListener('input', () => {
                    if (document.querySelector('#timeline-font-color')) {
                        document.querySelector('#timeline-font-color').value = document.querySelector('#timeline-font-color-picker').value;
                    }
                });
            }

            helperModule.show_form();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());

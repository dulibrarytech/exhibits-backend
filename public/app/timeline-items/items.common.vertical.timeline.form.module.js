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

            let timeline = {};
            timeline.styles = {};

            // timeline metadata
            timeline.title = document.querySelector('#timeline-title-input').value;
            timeline.text = document.querySelector('#timeline-text-input').value;

            // timeline styles
            /*
            let timeline_background_color = document.querySelector('#timeline-background-color').value;
            let timeline_color = document.querySelector('#timeline-font-color').value;
            let timeline_font = document.querySelector('#timeline-font').value;
            let timeline_font_size = document.querySelector('#timeline-font-size').value;

            if (timeline_background_color.length > 0) {
                timeline.styles.backgroundColor = timeline_background_color;
            }

            if (timeline_color.length > 0) {
                timeline.styles.color = document.querySelector('#timeline-font-color').value;
            }

            if (timeline_font.length > 0) {
                timeline.styles.fontFamily = timeline_font;
            }

            if (timeline_font_size.length > 0) {
                timeline.styles.fontSize = `${timeline_font_size}px`;
            }
            */

            return timeline;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
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

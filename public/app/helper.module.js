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

const helperModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Gets url parameter
     * @param name
     * @param url
     * @returns {*}
     */
    obj.get_parameter_by_name = function (name, url) {

        if (!url) {
            url = window.location.href;
        }

        name = name.replace(/[\[\]]/g, "\\$&");

        let regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);

        if (!results) {
            return null;
        }

        if (!results[2]) {
            return '';
        }

        return decodeURIComponent(DOMPurify.sanitize(results[2].replace(/\+/g, " ")));
    };

    /**
     * https://stackoverflow.com/questions/7394748/whats-the-right-way-to-decode-a-string-that-has-special-html-entities-in-it
     * Unescapes HTML elements
     * @param data
     */
    obj.unescape = function (data) {
        let elem = document.createElement('textarea');
        elem.innerHTML = data;
        return elem.value;
    };

    /**
     * Strips HTML elements
     * @param data
     * @return {*}
     */
    obj.strip_html = function (data) {
        return data.replace(/(<([^>]+)>)/gi, '');
    };

    /**
     *
     * @param id
     * @return {*}
     */
    obj.set_rich_text_editor = function (id) {
        return helperModule.render_rich_text_editor('#' + id);
    };

    /**
     * Creates rich text editor object
     * @param id
     */
    obj.render_rich_text_editor = function(id) {
        const editor_config = {}
        editor_config.toolbar = 'custom';
        editor_config.toolbar_custom = '{code} | {bold, italic, underline, superscript, subscript} | {justifyleft, justifycenter, justifyright, indent} | {preview}';
        editor_config.enterKeyTag = '';
        return new RichTextEditor(id, editor_config);
    };

    /**
     * Gets checked radio button value
     * @param radio_buttons
     */
    obj.get_checked_radio_button = function(radio_buttons) {
        for (let i = 0; i < radio_buttons.length; i++) {
            if (radio_buttons[i].checked) {
                return radio_buttons[i].value;
            }
        }
    };

    /**
     * Gets current year
     */
    obj.get_current_year = function () {
        let cdate = new Date().getFullYear();
        domModule.html('#cdate', DOMPurify.sanitize(cdate));
    };

    obj.init = function() {};

    return obj;

}());
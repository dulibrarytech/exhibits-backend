/**

 Copyright 2025 University of Denver

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

const itemsDetailsGridFormModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Set grid text input value. The text field is a rich text editor;
     * internal name is a plain input.
     */
    function set_grid_text(text, element) {

        if (!element) {
            return;
        }

        const unescaped_text = text ? helperModule.unescape(text) : '';

        if (element.dataset.rte !== undefined) {
            rteModule.set_html(element.id, unescaped_text);
        } else {
            element.value = unescaped_text;
        }
    }

    /**
     * Set grid columns value, clamped to a sane range.
     */
    function set_grid_columns(columns, element) {

        if (!element) {
            return;
        }

        let column_value = parseInt(columns, 10);

        if (isNaN(column_value) || column_value < 1 || column_value > 12) {
            column_value = 3;
        }

        element.value = column_value;
    }

    /**
     * Populates the read-only grid details page from a fetched record.
     * @param {Object} record
     */
    function populate(record) {

        set_grid_text(record.text, document.querySelector('#grid-text-input'));
        set_grid_text(record.internal_name, document.querySelector('#grid-internal-name-input'));
        set_grid_columns(record.columns, document.querySelector('#grid-columns'));
    }

    const form = itemFormBaseModule.create({
        record_type: 'grid',
        mode: 'details',
        /* The container details page reads the record without `?type=details`,
         * as the container edit form does. */
        query: { type: null, uid: false },
        populate: populate,
        show_denied_banner: true
    });

    obj.init = form.init;

    return obj;

}());

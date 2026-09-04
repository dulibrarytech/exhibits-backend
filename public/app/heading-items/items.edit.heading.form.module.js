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

const itemsEditHeadingFormModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Cache all required DOM elements to avoid repeated queries
     */
    function cache_dom_elements() {
        return {
            heading_type_input: document.querySelector('#item-heading-type-input'),
            is_published: document.querySelector('#is-published')
        };
    }

    /**
     * Set heading type input value
     */
    function set_heading_type(type, element) {

        if (!element) {
            return;
        }

        element.value = type;
    }

    /**
     * Set published status checkbox
     */
    function set_published_status(is_published, element) {

        if (!element) {
            return;
        }

        /* Handle both numeric (0/1) and boolean values */
        const PUBLISHED_VALUES = [1, true, '1', 'true'];
        element.checked = PUBLISHED_VALUES.includes(is_published);
    }

    /**
     * Populates the heading edit form from a fetched record.
     * @param {Object} record
     */
    async function populate(record) {

        const dom_elements = cache_dom_elements();

        rteModule.set_html('item-heading-text-input', record.text ? helperModule.unescape(record.text) : '');
        set_heading_type(record.type, dom_elements.heading_type_input);
        set_published_status(record.is_published, dom_elements.is_published);

        /* Set saved style selection after the chooser is populated. Style keys
         * are simple strings like "heading1"; skip "{}" (prepare_styles
         * default) and legacy JSON blobs. */
        if (record.styles && typeof record.styles === 'string'
            && record.styles.trim() !== '' && !record.styles.startsWith('{')) {
            await itemsCommonHeadingFormModule.wait_for_styles();
            itemsCommonHeadingFormModule.set_item_style(record.styles);
        }

        domModule.set_value('#margins', record.margins ?? 'medium');
        domModule.set_value('#text-align', record.text_alignment ?? 'left');
    }

    const form = itemFormBaseModule.create({
        record_type: 'heading',
        mode: 'edit',
        lock: { card_selector: '#item-submit-card' },
        populate: populate,
        collect: function () {
            return itemsCommonHeadingFormModule.get_common_heading_form_fields();
        },
        submit_selector: '#save-heading-btn',
        permissions: ['update_item', 'update_any_item'],
        redirect_path: function (ids) {
            return `/items/heading/details?exhibit_id=${ids.exhibit_id}&item_id=${ids.record_id}&status=403`;
        }
    });

    /**
     * Update item heading record
     * @returns {Promise<boolean>}
     */
    obj.update_item_heading_record = form.submit_record;

    obj.init = form.init;

    return obj;

}());

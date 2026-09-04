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

const itemsEditVerticalTimelineFormModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Cache all required DOM elements
     */
    function cache_dom_elements() {
        return {
            timeline_text: document.querySelector('#timeline-text-input'),
            timeline_internal_name: document.querySelector('#timeline-internal-name-input'),
            timeline_bg_color: document.querySelector('#timeline-background-color'),
            timeline_bg_color_picker: document.querySelector('#timeline-background-color-picker'),
            timeline_font_color: document.querySelector('#timeline-font-color'),
            timeline_font_color_picker: document.querySelector('#timeline-font-color-picker'),
            timeline_font: document.querySelector('#timeline-font'),
            timeline_font_size: document.querySelector('#timeline-font-size')
        };
    }

    /**
     * Set timeline text input value. The text field is a rich text editor;
     * internal name is a plain input.
     */
    function set_timeline_text(text, element) {

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
     * Apply color value to input and picker
     */
    function apply_color_setting(color_value, input_element, picker_element) {

        const value = color_value ? String(color_value).trim() : '';

        if (input_element) {
            input_element.value = value;
        }

        if (picker_element) {
            picker_element.value = value;
        }
    }

    /**
     * Apply font size setting
     */
    function apply_font_size(font_size_value, element) {

        if (!element) {
            return;
        }

        element.value = font_size_value
            ? String(font_size_value).replace(/px$/i, '').trim()
            : '';
    }

    /**
     * Apply font family if it exists in options
     */
    function apply_font_family(font_family_value, element) {

        if (!font_family_value || !element || !element.options) {
            return;
        }

        const sanitized_font = String(font_family_value).trim();
        const has_match = Array.from(element.options).some(option => option.value === sanitized_font);

        if (has_match) {
            element.value = sanitized_font;
        }
    }

    /**
     * Apply the legacy per-field style settings carried on the record.
     */
    function apply_style_settings(styles_data, elements) {

        if (!styles_data) {
            return;
        }

        let styles;

        try {
            styles = typeof styles_data === 'string' ? JSON.parse(styles_data) : styles_data;
        } catch (error) {
            console.error('Failed to parse styles JSON:', error);
            return;
        }

        if (!styles || typeof styles !== 'object' || Object.keys(styles).length === 0) {
            return;
        }

        apply_color_setting(styles.backgroundColor, elements.timeline_bg_color, elements.timeline_bg_color_picker);
        apply_color_setting(styles.color, elements.timeline_font_color, elements.timeline_font_color_picker);
        apply_font_size(styles.fontSize, elements.timeline_font_size);
        apply_font_family(styles.fontFamily, elements.timeline_font);
    }

    /**
     * Populates the timeline (container) edit form from a fetched record.
     * @param {Object} record
     */
    async function populate(record) {

        const elements = cache_dom_elements();

        set_timeline_text(record.text, elements.timeline_text);

        /* Legacy timelines predate the internal_name column — the required
         * field stays empty so the save-time validation forces a value. */
        set_timeline_text(record.internal_name, elements.timeline_internal_name);

        apply_style_settings(record.styles, elements);

        /* Set saved style selection after the chooser is populated. Style keys
         * are simple strings like "item1"; skip "{}" (prepare_styles default)
         * and legacy JSON blobs. */
        if (record.styles && typeof record.styles === 'string'
            && record.styles.trim() !== '' && !record.styles.startsWith('{')) {
            await itemsCommonVerticalTimelineFormModule.wait_for_styles();
            itemsCommonVerticalTimelineFormModule.set_item_style(record.styles);
        }

        domModule.set_value('#margins', record.margins ?? 'medium');
        domModule.set_value('#text-align', record.text_alignment ?? 'left');
    }

    const form = itemFormBaseModule.create({
        record_type: 'timeline',
        mode: 'edit',
        /* Container edit forms do not request `?type=edit`, so the server never
         * locks the record for them and there is no lock state to honour. */
        lock: false,
        query: { type: null, uid: false },
        populate: populate,
        collect: function () {
            return itemsCommonVerticalTimelineFormModule.get_common_timeline_form_fields();
        },
        submit_selector: '#save-timeline-btn',
        permissions: ['update_item', 'update_any_item'],
        redirect_path: function (ids) {
            return `/items/vertical-timeline/details?exhibit_id=${ids.exhibit_id}&item_id=${ids.record_id}&status=403`;
        }
    });

    /**
     * Update timeline record
     * @returns {Promise<boolean>}
     */
    obj.update_timeline_record = form.submit_record;

    obj.init = form.init;

    return obj;

}());

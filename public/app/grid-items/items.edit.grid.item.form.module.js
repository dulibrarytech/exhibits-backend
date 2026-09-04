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

const itemsEditGridItemFormModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Cache all required DOM elements
     */
    function cache_dom_elements() {
        return {
            is_published: document.querySelector('#is-published'),
            item_bg_color: document.querySelector('#item-background-color'),
            item_bg_color_picker: document.querySelector('#item-background-color-picker'),
            item_font_color: document.querySelector('#item-font-color'),
            item_font_color_picker: document.querySelector('#item-font-color-picker'),
            item_font: document.querySelector('#item-font'),
            item_font_size: document.querySelector('#item-font-size'),
            layouts: document.getElementsByName('layout'),
            media_width: document.getElementsByName('media_width')
        };
    }

    /**
     * Set published status
     */
    function set_published_status(is_published, element) {

        if (!element) {
            return;
        }

        const published_values = [1, true, '1', 'true'];
        element.checked = published_values.includes(is_published);
    }

    /**
     * Set layout radio buttons
     */
    function set_layout_selection(layout_value, layouts) {

        if (!layouts || layouts.length === 0 || !layout_value) {
            return;
        }

        for (let i = 0; i < layouts.length; i++) {
            if (layouts[i].value === layout_value) {
                layouts[i].checked = true;
                break;
            }
        }
    }

    /**
     * Set media width radio buttons
     */
    function set_media_width_selection(width_value, media_width_elements) {

        if (!media_width_elements || media_width_elements.length === 0) {
            return;
        }

        const target_width = parseInt(width_value, 10);

        if (isNaN(target_width)) {
            return;
        }

        for (let i = 0; i < media_width_elements.length; i++) {
            if (parseInt(media_width_elements[i].value, 10) === target_width) {
                media_width_elements[i].checked = true;
                break;
            }
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

        apply_color_setting(styles.backgroundColor, elements.item_bg_color, elements.item_bg_color_picker);
        apply_color_setting(styles.color, elements.item_font_color, elements.item_font_color_picker);
        apply_font_size(styles.fontSize, elements.item_font_size);
        apply_font_family(styles.fontFamily, elements.item_font);
    }

    /**
     * Populates the grid item edit form from a fetched record.
     * @param {Object} record
     */
    function populate(record) {

        const elements = cache_dom_elements();

        set_published_status(record.is_published, elements.is_published);

        rteModule.set_html('item-title-input', record.title ? helperModule.unescape(record.title) : '');
        rteModule.set_html('item-text-input', record.text ? helperModule.unescape(record.text) : '');

        /* Populate media previews from record (media picker integration) */
        const is_media_path = window.location.pathname.split('/').filter(Boolean).includes('media');

        if (is_media_path) {

            itemsCommonGridItemFormModule.populate_media_previews(record);

            /* Populate optional Pop-up Window Description + Caption fields */
            rteModule.set_html('item-description-input', helperModule.unescape(record.description));
            rteModule.set_html('item-caption-input', helperModule.unescape(record.caption));
        }

        set_layout_selection(record.layout, elements.layouts);
        set_media_width_selection(record.media_width, elements.media_width);

        /* Set embed item checkbox from record */
        const embed_item_el = document.getElementById('embed-item');

        if (embed_item_el) {
            embed_item_el.checked = record.is_embedded === 1;
            embed_item_el.dispatchEvent(new Event('change'));
        }

        apply_style_settings(record.styles, elements);
    }

    const form = itemFormBaseModule.create({
        record_type: 'grid_item',
        mode: 'edit',
        lock: { card_selector: '#item-submit-card' },
        populate: populate,
        collect: function () {
            return itemsCommonGridItemFormModule.get_common_grid_item_form_fields();
        },
        submit_selector: '#save-item-btn',
        permissions: ['update_item', 'update_any_item'],
        redirect_path: function (ids) {
            return `/items/grid/details?exhibit_id=${ids.exhibit_id}&item_id=${ids.record_id}&status=403`;
        }
    });

    /**
     * Update grid item record
     * @returns {Promise<boolean>}
     */
    obj.update_grid_item_record = form.submit_record;

    obj.init = form.init;

    return obj;

}());

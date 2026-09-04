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

const itemsDetailsStandardItemModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Checks the radio in `name` whose value matches.
     */
    function set_radio_value(name, value) {

        const elements = document.getElementsByName(name);

        for (const element of elements) {
            if (element.value === value) {
                element.checked = true;
                break;
            }
        }
    }

    /**
     * Populates the read-only standard item details page from a record.
     * @param {Object} record
     */
    function populate(record) {

        /* Set published status */
        const published_el = document.querySelector('#is-published');

        if (published_el) {
            published_el.value = record.is_published === 1;
        }

        /*
         * The media details template renders static .rte-readonly boxes
         * (no editors); the text details template keeps read-only editors.
         */
        const is_media_details = window.location.pathname.indexOf('media') !== -1;

        /* Set basic item data */
        if (is_media_details) {
            rteModule.render_static('item-text-input', helperModule.unescape(record.text));
        } else {
            rteModule.set_html('item-text-input', helperModule.unescape(record.text));
        }

        /* Populate media previews using the shared common module */
        if (is_media_details) {

            itemsCommonStandardItemFormModule.populate_media_previews(record);

            /* Surface the popup-related fields read-only. The common form module
             * (also init'd on this page) reveals/relocates them; here we fill in
             * their values and gate the Embed Item control to audio/video media. */
            rteModule.render_static('item-description-input', helperModule.unescape(record.description));
            rteModule.render_static('item-caption-input', helperModule.unescape(record.caption));

            const embed_item_el = document.getElementById('embed-item');
            if (embed_item_el) embed_item_el.checked = record.is_embedded === 1;

            const media_padding_el = document.getElementById('media-padding');
            if (media_padding_el) media_padding_el.checked = record.media_padding === 0;

            const wrap_text_el = document.getElementById('wrap-text');
            if (wrap_text_el) wrap_text_el.checked = record.wrap_text !== 0;
        }

        set_radio_value('layout', record.layout);
        set_radio_value('media_width', String(record.media_width));
    }

    const form = itemFormBaseModule.create({
        record_type: 'item',
        mode: 'details',
        populate: populate,
        disable_fields: true,
        show_denied_banner: true
    });

    obj.init = form.init;

    return obj;

}());

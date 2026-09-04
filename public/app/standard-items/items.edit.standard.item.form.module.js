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

const itemsEditStandardItemFormModule = (function () {

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
     * Populates the standard item edit form from a fetched record.
     * @param {Object} record
     */
    async function populate(record) {

        const is_media_path = window.location.pathname.split('/').filter(Boolean).includes('media');

        /* Set published status */
        const published_el = document.querySelector('#is-published');

        if (published_el) {
            published_el.value = record.is_published === 1;
        }

        /* Set basic item data */
        rteModule.set_html('item-text-input', helperModule.unescape(record.text));

        /* Handle media-specific fields */
        if (is_media_path) {

            itemsCommonStandardItemFormModule.populate_media_previews(record);

            /* Populate optional Pop-up Window Description + Caption fields */
            rteModule.set_html('item-description-input', helperModule.unescape(record.description));
            rteModule.set_html('item-caption-input', helperModule.unescape(record.caption));

            /* Populate the Embed Item flag and sync the description's enabled
             * state (dispatch 'change' so the common module's listener runs). */
            const embed_item_el = document.getElementById('embed-item');

            if (embed_item_el) {
                embed_item_el.checked = record.is_embedded === 1;
                embed_item_el.dispatchEvent(new Event('change'));
            }

            const media_padding_el = document.getElementById('media-padding');

            if (media_padding_el) {
                media_padding_el.checked = record.media_padding === 0;
            }

            const wrap_text_el = document.getElementById('wrap-text');

            if (wrap_text_el) {
                wrap_text_el.checked = record.wrap_text !== 0;
            }
        }

        set_radio_value('layout', record.layout);
        set_radio_value('media_width', String(record.media_width));

        /* Set saved style selection after the chooser is populated. Style keys
         * are simple strings like "item1"; skip "{}" (prepare_styles default)
         * and legacy JSON blobs. */
        if (record.styles && typeof record.styles === 'string'
            && record.styles.trim() !== '' && !record.styles.startsWith('{')) {
            await itemsCommonStandardItemFormModule.wait_for_styles();
            itemsCommonStandardItemFormModule.set_item_style(record.styles);
        }

        domModule.set_value('#margins', record.margins ?? 'medium');
        domModule.set_value('#text-align', record.text_alignment ?? 'left');
    }

    const form = itemFormBaseModule.create({
        record_type: 'item',
        mode: 'edit',
        lock: { card_selector: '#exhibit-submit-card' },
        populate: populate,
        collect: function () {
            return itemsCommonStandardItemFormModule.get_common_standard_item_form_fields();
        },
        submit_selector: '#save-item-btn',
        permissions: ['update_item', 'update_any_item'],
        redirect_path: function (ids) {
            /* The standard family has a text and a media form; keep the
             * caller on the flavour they came from. */
            const type = window.location.pathname.indexOf('text') !== -1 ? 'text' : 'media';
            return `/items/standard/${type}/details?exhibit_id=${ids.exhibit_id}&item_id=${ids.record_id}&status=403`;
        }
    });

    /**
     * Update standard item record
     * @returns {Promise<boolean>}
     */
    obj.update_item_record = form.submit_record;

    obj.init = form.init;

    return obj;

}());

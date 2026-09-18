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

const itemsEditVerticalTimelineItemFormModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Set item date input value. Timeline items carry a date field the other
     * item families do not; the record's ISO timestamp is trimmed to the
     * date portion the <input type="date"> expects.
     */
    function set_item_date(date_value, element) {

        if (!element) {
            return;
        }

        if (!date_value) {
            element.value = '';
            return;
        }

        const date_parts = String(date_value).split('T');
        element.value = (date_parts.length > 0 && date_parts[0]) ? date_parts[0] : '';
    }

    /**
     * Populates the timeline item edit form from a fetched record.
     * @param {Object} record
     */
    function populate(record) {

        /* Stored HTML goes into the editors as-is: decoding it first turned an
           author's literal "&lt;b&gt;" into bold on the next save. */
        rteModule.set_html('item-title-input', record.title || '');
        rteModule.set_html('item-text-input', record.text || '');
        set_item_date(record.date, document.querySelector('#item-date-input'));

        /* Media fields, on the media flavour of the form only */
        if (window.location.pathname.indexOf('media') !== -1) {

            itemsCommonVerticalTimelineItemFormModule.populate_media_previews(record);

            /* Populate optional Pop-up Window Description + Caption fields */
            rteModule.set_html('item-description-input', record.description || '');
            /* Caption is a plain textarea, so it keeps the entity decode. */
            domModule.set_value('#item-caption-input', record.caption ? helperModule.unescape(record.caption) : '');
        }

        /* Set embed item checkbox from record */
        const embed_item_el = document.getElementById('embed-item');

        if (embed_item_el) {
            embed_item_el.checked = record.is_embedded === 1;
            embed_item_el.dispatchEvent(new Event('change'));
        }
    }

    const form = itemFormBaseModule.create({
        record_type: 'timeline_item',
        mode: 'edit',
        lock: { card_selector: '#item-submit-card' },
        populate: populate,
        collect: function () {
            return itemsCommonVerticalTimelineItemFormModule.get_common_timeline_item_form_fields();
        },
        submit_selector: '#save-item-btn',
        permissions: ['update_item', 'update_any_item'],
        redirect_path: function (ids) {
            return `/items?exhibit_id=${ids.exhibit_id}&item_id=${ids.record_id}&status=403`;
        }
    });

    obj.init = form.init;

    return obj;

}());

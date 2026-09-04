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

const itemsDetailsVerticalTimelineItemModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Populates the read-only timeline item details page from a record.
     * @param {Object} record
     */
    function populate(record) {

        rteModule.render_static('item-title-input', record.title ? helperModule.unescape(record.title) : '');
        rteModule.render_static('item-text-input', record.text ? helperModule.unescape(record.text) : '');

        /* Set date field (extract date portion from ISO string) */
        if (record.date) {
            const date_parts = String(record.date).split('T');
            domModule.set_value('#item-date-input', date_parts.length > 0 ? date_parts[0] : '');
        } else {
            domModule.set_value('#item-date-input', '');
        }

        /* Populate media previews using the shared common module */
        if (window.location.pathname.indexOf('media') !== -1) {

            itemsCommonVerticalTimelineItemFormModule.populate_media_previews(record);

            /* Surface the Pop-up Window Description + Caption read-only. */
            rteModule.render_static('item-description-input', record.description ? helperModule.unescape(record.description) : '');
            rteModule.render_static('item-caption-input', record.caption ? helperModule.unescape(record.caption) : '');
        }

        /* Set embed item checkbox from record */
        const embed_item_el = document.getElementById('embed-item');

        if (embed_item_el) {
            embed_item_el.checked = record.is_embedded === 1;
        }
    }

    const form = itemFormBaseModule.create({
        record_type: 'timeline_item',
        mode: 'details',
        populate: populate,
        disable_fields: true,
        show_denied_banner: true
    });

    obj.init = form.init;

    return obj;

}());

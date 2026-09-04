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

const itemsEditGridFormModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Populates the grid (container) edit form from a fetched record.
     * @param {Object} record
     */
    async function populate(record) {

        rteModule.set_html('grid-text-input', helperModule.unescape(record.text));

        /* Legacy grids predate internal_name (nullable column) — leave the
         * required field empty so the save-time validation forces a value. */
        domModule.set_value('#grid-internal-name-input', helperModule.unescape(record.internal_name || ''));
        itemsCommonStandardGridFormModule.set_grid_columns(record.columns);

        /* Set saved style selection after the chooser is populated. Style keys
         * are simple strings like "item1"; skip "{}" (prepare_styles default)
         * and legacy JSON blobs. */
        if (record.styles && typeof record.styles === 'string'
            && record.styles.trim() !== '' && !record.styles.startsWith('{')) {
            await itemsCommonStandardGridFormModule.wait_for_styles();
            itemsCommonStandardGridFormModule.set_item_style(record.styles);
        }

        domModule.set_value('#margins', record.margins ?? 'medium');
        domModule.set_value('#text-align', record.text_alignment ?? 'left');
    }

    const form = itemFormBaseModule.create({
        record_type: 'grid',
        mode: 'edit',
        /* Container edit forms do not request `?type=edit`, so the server never
         * locks the record for them and there is no lock state to honour. */
        lock: false,
        query: { type: null, uid: false },
        populate: populate,
        collect: function () {
            return itemsCommonStandardGridFormModule.get_common_grid_form_fields();
        },
        submit_selector: '#save-item-btn',
        permissions: ['update_item', 'update_any_item'],
        redirect_path: function (ids) {
            return `/items/grid/details?exhibit_id=${ids.exhibit_id}&item_id=${ids.record_id}&status=403`;
        }
    });

    /**
     * Update grid record
     * @returns {Promise<boolean>}
     */
    obj.update_grid_record = form.submit_record;

    obj.init = form.init;

    return obj;

}());

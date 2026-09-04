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

const itemsDetailsHeadingModule = (function () {

    'use strict';

    let obj = {};

    /**
     * Populates the read-only heading details page from a fetched record.
     * @param {Object} record
     */
    function populate(record) {

        rteModule.set_html('item-heading-text-input', helperModule.unescape(record.text));
        domModule.set_value('#item-heading-type-input', record.type);

        if (record.is_published === 1) {
            domModule.set_value('#is-published', true);
        } else if (record.is_published === 0) {
            domModule.set_value('#is-published', false);
        }
    }

    const form = itemFormBaseModule.create({
        record_type: 'heading',
        mode: 'details',
        populate: populate,
        show_denied_banner: true
    });

    obj.init = form.init;

    return obj;

}());

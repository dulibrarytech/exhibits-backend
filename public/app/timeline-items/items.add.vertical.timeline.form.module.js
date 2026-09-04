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

const itemsAddVerticalTimelineFormModule = (function () {

    'use strict';

    let obj = {};

    const form = itemFormBaseModule.create({
        record_type: 'timeline',
        mode: 'add',
        collect: function () {
            return itemsCommonVerticalTimelineFormModule.get_common_timeline_form_fields();
        },
        submit_selector: '#save-timeline-btn',
        permissions: ['add_item', 'add_item_to_any_exhibit'],
        redirect_path: function (ids) {
            return `/items?exhibit_id=${ids.exhibit_id}&status=403`;
        }
    });

    /**
     * Create timeline record
     * @returns {Promise<boolean>}
     */
    obj.create_timeline_record = form.submit_record;

    obj.init = form.init;

    return obj;

}());

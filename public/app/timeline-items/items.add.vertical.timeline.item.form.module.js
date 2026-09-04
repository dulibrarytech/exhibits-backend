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

const itemsAddVerticalTimelineItemFormModule = (function () {

    'use strict';

    const APP_PATH = endpointsModule.get_app_path();
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    obj.create_timeline_item_record = async function() {
        // CRITICAL: Check if we're in edit mode first
        const item_id = helperModule.get_parameter_by_name('item_id');
        if (item_id) {
            console.debug('🔴 Item ID exists - already in edit mode, preventing duplicate creation');
            console.debug('Current URL:', window.location.href);
            console.debug('item_id:', item_id);

            const message_element = document.querySelector('#message');
            domModule.set_alert(message_element, 'warning', 'Already in edit mode.');
            return false;
        }

        console.debug('🟢 CREATE FUNCTION CALLED - No item_id, proceeding with creation');

        // Prevent duplicate submissions
        if (this._is_creating_timeline_item) {
            console.debug('Already creating, preventing duplicate submission');
            return false;
        }

        this._is_creating_timeline_item = true;

        try {
            // Cache DOM element
            const message_element = document.querySelector('#message');

            // Scroll to top for user feedback
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

            // Validate required parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');

            if (!exhibit_id || !timeline_id) {
                domModule.set_alert(message_element, 'warning', 'Missing exhibit ID or timeline ID. Cannot create timeline item record.');
                return false;
            }

            // Show loading state
            domModule.set_alert(message_element, 'info', 'Creating timeline item record...');

            // Get and validate form data
            const form_data = itemsCommonVerticalTimelineItemFormModule.get_common_timeline_item_form_fields();

            if (!form_data || form_data === false || form_data === undefined) {
                // domModule.set_alert(message_element, 'danger', 'Unable to get form field values. Please check all required fields.');
                return false;
            }

            // Add metadata
            const user_name = helperModule.get_user_name();
            const owner = helperModule.get_owner();

            if (user_name) {
                form_data.created_by = user_name;
            }

            if (owner) {
                form_data.owner = owner;
            }

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.exhibits?.timeline_item_records?.post?.endpoint) {
                domModule.set_alert(message_element, 'danger', 'API endpoint configuration missing');
                return false;
            }

            const endpoint = endpointsModule.build(EXHIBITS_ENDPOINTS.exhibits.timeline_item_records.post.endpoint, {
                exhibit_id: exhibit_id,
                timeline_id: timeline_id
            });

            // Make API request (null = missing token; httpModule.api has
            // already alerted and scheduled the logout)
            const response = await httpModule.api({
                method: 'POST',
                url: endpoint,
                data: form_data
            });

            if (response === null) {
                return false;
            }

            // Validate response
            if (!response || response.status !== 201) {
                if (!response) {
                    domModule.set_alert(message_element, 'danger', 'Permission denied. You do not have access to add items to this timeline.');
                    return false;
                }
                throw new Error('Failed to create timeline item record');
            }

            const new_timeline_item_id = response.data?.data;

            if (!new_timeline_item_id) {
                throw new Error('Server did not return a valid timeline item ID');
            }

            console.debug('✅ Timeline item record created successfully, ID:', new_timeline_item_id);

            // Show success message
            domModule.set_alert(message_element, 'success', 'Timeline item record created successfully. Redirecting to edit page...');

            // Scroll to top to show success message
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

            // Gracefully redirect to edit page after showing success message
            setTimeout(() => {
                redirect_to_timeline_item_edit_page(exhibit_id, timeline_id, new_timeline_item_id);
            }, 1200);

            return true;

        } catch (error) {
            console.error('❌ Error creating timeline item record:', error);

            const message_element = document.querySelector('#message');
            const error_message = error.user_message || error.message || 'Unable to create timeline item record. Please try again.';
            domModule.set_alert(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_creating_timeline_item = false;
        }
    };

    /**
     * Gracefully redirect to timeline item edit page (prevents back button to create page)
     */
    function redirect_to_timeline_item_edit_page(exhibit_id, timeline_id, timeline_item_id) {
        console.debug('=== REDIRECTING TO TIMELINE ITEM EDIT PAGE ===');
        console.debug('exhibit_id:', exhibit_id);
        console.debug('timeline_id:', timeline_id);
        console.debug('timeline_item_id:', timeline_item_id);

        // Determine item form type based on current URL path
        let item_form = 'text';

        if (window.location.pathname.indexOf('media') !== -1) {
            item_form = 'media';
            console.debug('Media form detected from URL path');
        } else {
            console.debug('Text form detected (default)');
        }

        const params = new URLSearchParams({
            exhibit_id: exhibit_id,
            timeline_id: timeline_id,
            item_id: timeline_item_id
        });

        const edit_url = `${APP_PATH}/items/vertical-timeline/item/${item_form}/edit?${params.toString()}`;

        console.debug('Item form type:', item_form);
        console.debug('Redirecting to:', edit_url);
        console.debug('Note: Back button will NOT return to create page');

        // Use window.location.replace() to prevent back button to create page
        window.location.replace(edit_url);
    }

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');
            const redirect = '/items?exhibit_id=' + exhibit_id + '&timeline_id=' + timeline_id + '&status=403';
            await authModule.check_permissions(['add_item', 'add_item_to_any_exhibit'], 'timeline_item', exhibit_id, null, redirect);

            exhibitsModule.set_exhibit_title(exhibit_id);
            domModule.on('#save-item-btn', 'click', itemsAddVerticalTimelineItemFormModule.create_timeline_item_record);

        } catch (error) {
            domModule.set_alert(document.querySelector('#message'), 'danger', error.message);
        }
    };

    return obj;

}());

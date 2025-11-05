/**

 Copyright 2023 University of Denver

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

const itemsAddGridItemFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    obj.create_grid_item_record = async function() {
        // CRITICAL: Check if we're in edit mode first
        const item_id = helperModule.get_parameter_by_name('item_id');
        if (item_id) {
            console.log('🔴 Item ID exists - already in edit mode, preventing duplicate creation');
            console.log('Current URL:', window.location.href);
            console.log('item_id:', item_id);

            // Call update instead if it exists
            if (obj.update_grid_item_record && typeof obj.update_grid_item_record === 'function') {
                console.log('Redirecting to update function...');
                return await obj.update_grid_item_record();
            }

            const message_element = document.querySelector('#message');
            display_status_message(message_element, 'warning', 'Already in edit mode. Update function not available.');
            console.error('ERROR: update_grid_item_record function not found!');
            return false;
        }

        console.log('🟢 CREATE FUNCTION CALLED - No item_id, proceeding with creation');

        // Prevent duplicate submissions
        if (this._is_creating_grid_item) {
            console.log('Already creating, preventing duplicate submission');
            return false;
        }

        this._is_creating_grid_item = true;

        try {
            // Cache DOM element
            const message_element = document.querySelector('#message');

            // Scroll to top for user feedback
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Validate required parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');

            if (!exhibit_id || !grid_id) {
                display_status_message(message_element, 'warning', 'Missing exhibit ID or grid ID. Cannot create grid item record.');
                return false;
            }

            // Show loading state
            display_status_message(message_element, 'info', 'Creating grid item record...');

            // Validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_status_message(message_element, 'danger', 'Session expired. Please log in again.');

                setTimeout(() => {
                    authModule.logout();
                }, 1000);

                return false;
            }

            // Get and validate form data
            const form_data = itemsCommonGridItemFormModule.get_common_grid_item_form_fields();

            if (!form_data || form_data === false || form_data === undefined) {
                // display_status_message(message_element, 'danger', 'Unable to get form field values. Please check all required fields.');
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
            if (!EXHIBITS_ENDPOINTS?.exhibits?.grid_item_records?.post?.endpoint) {
                display_status_message(message_element, 'danger', 'API endpoint configuration missing');
                return false;
            }

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.post.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id))
                .replace(':grid_id', encodeURIComponent(grid_id));

            // Make API request
            const response = await httpModule.req({
                method: 'POST',
                url: endpoint,
                data: form_data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000
            });

            // Validate response
            if (!response || response.status !== 201) {
                if (!response) {
                    display_status_message(message_element, 'danger', 'Permission denied. You do not have access to add items to this grid.');
                    return false;
                }
                throw new Error('Failed to create grid item record');
            }

            const new_grid_item_id = response.data?.data;

            if (!new_grid_item_id) {
                throw new Error('Server did not return a valid grid item ID');
            }

            console.log('✅ Grid item record created successfully, ID:', new_grid_item_id);

            // Show success message
            display_status_message(message_element, 'success', 'Grid item record created successfully. Redirecting to edit page...');

            // Scroll to top to show success message
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Gracefully redirect to edit page after showing success message
            setTimeout(() => {
                redirect_to_grid_item_edit_page(exhibit_id, grid_id, new_grid_item_id);
            }, 1200);

            return true;

        } catch (error) {
            console.error('❌ Error creating grid item record:', error);

            const message_element = document.querySelector('#message');
            const error_message = error.user_message || error.message || 'Unable to create grid item record. Please try again.';
            display_status_message(message_element, 'danger', error_message);

            return false;

        } finally {
            // Reset submission flag
            this._is_creating_grid_item = false;
        }
    };

    /**
     * Gracefully redirect to grid item edit page (prevents back button to create page)
     */
    function redirect_to_grid_item_edit_page(exhibit_id, grid_id, grid_item_id) {
        console.log('=== REDIRECTING TO GRID ITEM EDIT PAGE ===');
        console.log('exhibit_id:', exhibit_id);
        console.log('grid_id:', grid_id);
        console.log('grid_item_id:', grid_item_id);

        // Determine item form type based on current URL path
        let item_form = 'text';

        if (window.location.pathname.indexOf('media') !== -1) {
            item_form = 'media';
            console.log('Media form detected from URL path');
        } else {
            console.log('Text form detected (default)');
        }

        const params = new URLSearchParams({
            exhibit_id: exhibit_id,
            grid_id: grid_id,
            item_id: grid_item_id
        });

        const edit_url = `${APP_PATH}/items/grid/item/${item_form}/edit?${params.toString()}`;

        console.log('Item form type:', item_form);
        console.log('Redirecting to:', edit_url);
        console.log('Note: Back button will NOT return to create page');

        // Use window.location.replace() to prevent back button to create page
        // This replaces the current history entry instead of adding a new one
        window.location.replace(edit_url);
    }

    /**
     * Display status message to user (XSS-safe)
     */
    function display_status_message(element, type, message) {
        if (!element) {
            return;
        }

        // Validate message type
        const valid_types = ['info', 'success', 'danger', 'warning'];
        const alert_type = valid_types.includes(type) ? type : 'info';

        // Create alert container
        const alert_div = document.createElement('div');
        alert_div.className = `alert alert-${alert_type}`;
        alert_div.setAttribute('role', 'alert');

        // Add icon based on type
        const icon = document.createElement('i');
        icon.className = get_icon_class(alert_type);
        alert_div.appendChild(icon);

        // Add message text
        const text_node = document.createTextNode(` ${message}`);
        alert_div.appendChild(text_node);

        // Clear and set new content
        element.textContent = '';
        element.appendChild(alert_div);
    }

    /**
     * Get appropriate icon class for alert type
     */
    function get_icon_class(alert_type) {
        const icon_map = {
            'info': 'fa fa-info',
            'success': 'fa fa-check',
            'danger': 'fa fa-exclamation',
            'warning': 'fa fa-exclamation-triangle'
        };

        return icon_map[alert_type] || 'fa fa-info';
    }

    obj.create_grid_item_record__ = async function () {

        try {

            window.scrollTo(0, 0);
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');

            if (grid_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to create grid item record.</div>`;
                return false;
            }

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Creating grid item record...</div>`;

            let data = itemsCommonGridItemFormModule.get_common_grid_item_form_fields();

            if (data === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get form field values</div>`;
                return false;
            } else if (data === false) {
                return false;
            }

            data.created_by = helperModule.get_user_name();
            data.owner = helperModule.get_owner();

            let tmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.post.endpoint.replace(':exhibit_id', exhibit_id);
            let endpoint = tmp.replace(':grid_id', grid_id);
            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'POST',
                url: endpoint,
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                let message = 'Grid item record created';
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> ${message}</div>`;
                const grid_item_id = response.data.data;

                setTimeout(() => {

                    let item_form = 'text';

                    if (window.location.pathname.indexOf('media') !== -1) {
                        item_form = 'media';
                    }

                    window.location.replace(`${APP_PATH}/items/grid/item/${item_form}/edit?exhibit_id=${exhibit_id}&grid_id=${grid_id}&item_id=${grid_item_id}`);

                }, 900);
            } else if (response === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> You do not have permission to add item to this exhibit.</div>`;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const redirect = '/items/grid/items?exhibit_id=' + exhibit_id + '&grid_id=' + grid_id + '&status=403';
            await authModule.check_permissions(['add_item', 'add_item_to_any_exhibit'], 'grid_item', exhibit_id, null, redirect);

            exhibitsModule.set_exhibit_title(exhibit_id);
            document.querySelector('#save-item-btn').addEventListener('click', itemsAddGridItemFormModule.create_grid_item_record);

            if (window.location.pathname.indexOf('media') !== -1) {
                await helperModule.create_subjects_menu();
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());

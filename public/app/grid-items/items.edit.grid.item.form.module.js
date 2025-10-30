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

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_grid_item_record() {

        // Cache DOM element
        const message_element = document.querySelector('#message');

        /**
         * Display status message to user (XSS-safe)
         */
        const display_message = (element, type, message) => {
            if (!element) {
                return;
            }

            const valid_types = ['info', 'success', 'danger', 'warning'];
            const alert_type = valid_types.includes(type) ? type : 'danger';

            const alert_div = document.createElement('div');
            alert_div.className = `alert alert-${alert_type}`;
            alert_div.setAttribute('role', 'alert');

            const icon = document.createElement('i');
            icon.className = get_icon_class(alert_type);
            alert_div.appendChild(icon);

            const text_node = document.createTextNode(` ${message}`);
            alert_div.appendChild(text_node);

            element.textContent = '';
            element.appendChild(alert_div);
        };

        /**
         * Get icon class for alert type
         */
        const get_icon_class = (alert_type) => {
            const icon_map = {
                'info': 'fa fa-info',
                'success': 'fa fa-check',
                'danger': 'fa fa-exclamation',
                'warning': 'fa fa-exclamation-triangle'
            };
            return icon_map[alert_type] || 'fa fa-exclamation';
        };

        /**
         * Validate required parameters
         */
        const validate_parameters = (exhibit_id, grid_id, item_id) => {
            if (!exhibit_id || !grid_id || !item_id) {
                return {
                    valid: false,
                    error: 'Missing required parameters: exhibit_id, grid_id, or item_id'
                };
            }

            // Validate reasonable string lengths
            if (exhibit_id.length > 255 || grid_id.length > 255 || item_id.length > 255) {
                return {
                    valid: false,
                    error: 'Invalid parameter length'
                };
            }

            return { valid: true };
        };

        try {

            // Get and validate required parameters
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const validation = validate_parameters(exhibit_id, grid_id, item_id);

            if (!validation.valid) {
                display_message(message_element, 'danger', validation.error);
                return null;
            }

            // Get and validate authentication
            const token = authModule.get_user_token();

            if (!token || token === false) {
                display_message(message_element, 'danger', 'Authentication required. Redirecting...');

                setTimeout(() => {
                    authModule.redirect_to_auth();
                }, 1000);

                return null;
            }

            // Get user profile
            const profile = authModule.get_user_profile_data();

            if (!profile?.uid) {
                display_message(message_element, 'danger', 'Invalid user profile data');
                return null;
            }

            // Validate endpoint configuration
            if (!EXHIBITS_ENDPOINTS?.exhibits?.grid_item_record?.get?.endpoint) {
                display_message(message_element, 'danger', 'API endpoint configuration missing');
                return null;
            }

            // Construct endpoint with URL encoding
            const endpoint = EXHIBITS_ENDPOINTS.exhibits.grid_item_record.get.endpoint
                .replace(':exhibit_id', encodeURIComponent(exhibit_id))
                .replace(':grid_id', encodeURIComponent(grid_id))
                .replace(':item_id', encodeURIComponent(item_id));

            // Construct URL with query parameters safely
            const params = new URLSearchParams({
                type: 'edit',
                uid: profile.uid
            });
            const full_url = `${endpoint}?${params.toString()}`;

            // Make API request with timeout
            const response = await httpModule.req({
                method: 'GET',
                url: full_url,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 30000
            });
            console.log('RESPONSE ', response);
            // Validate response structure
            if (!response) {
                throw new Error('No response received from server');
            }

            if (response.status !== 200) {
                throw new Error(`Server returned status ${response.status}`);
            }

            if (!response.data?.data) {
                throw new Error('Invalid response structure');
            }

            return response.data.data;

        } catch (error) {
            // Log error for debugging
            console.error('Error in get_grid_item_record:', error);

            // Display error message (use user_message from Axios interceptor if available)
            const error_message = error.user_message || 'Unable to load the grid item record. Please try again.';
            display_message(message_element, 'danger', error_message);

            return null;
        }
    }
    /*
    async function get_grid_item_record__() {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            const profile = authModule.get_user_profile_data();
            let etmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_record.get.endpoint.replace(':exhibit_id', exhibit_id);
            let itmp = etmp.replace(':grid_id', grid_id);
            let endpoint = itmp.replace(':item_id', item_id);

            if (token === false) {

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    authModule.redirect_to_auth();
                }, 1000);

                return false;
            }

            let response = await httpModule.req({
                method: 'GET',
                url: endpoint + '?type=edit&uid=' + profile.uid,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                return response.data.data;
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }
    */

    async function display_edit_record() {

        try {

            let record = await get_grid_item_record();
            let is_published = record.is_published;
            let created_by = record.created_by;
            let created = record.created;
            let create_date = new Date(created);
            let updated_by = record.updated_by;
            let updated = record.updated;
            let update_date = new Date(updated);
            let item_created = '';
            let create_date_time = helperModule.format_date(create_date);
            let update_date_time = helperModule.format_date(update_date);

            helperModule.check_if_locked(record, '#item-submit-card');

            if (created_by !== null) {
                item_created += `<em>Created by ${created_by} on ${create_date_time}</em>`;
            }

            if (updated_by !== null) {
                item_created += ` | <em>Last updated by ${updated_by} on ${update_date_time}</em>`;
            }

            document.querySelector('#created').innerHTML = item_created;

            if (document.querySelector('#is-published') !== null && is_published === 1) {
                document.querySelector('#is-published').value = true;
            } else if (document.querySelector('#is-published') !== null && is_published === 0) {
                document.querySelector('#is-published').value = false;
            }

            // item data
            document.querySelector('#item-title-input').value = helperModule.unescape(record.title);
            document.querySelector('#item-text-input').value = helperModule.unescape(record.text);

            if (window.location.pathname.indexOf('media') !== -1) {
                await helperMediaModule.display_media_fields_common(record);
            }

            let layouts = document.getElementsByName('layout');

            for (let j = 0; j < layouts.length; j++) {
                if (layouts[j].value === record.layout) {
                    document.querySelector('#' + layouts[j].id).checked = true;
                }
            }

            let media_width = document.getElementsByName('media_width');

            for (let j = 0; j < media_width.length; j++) {
                if (parseInt(media_width[j].value) === parseInt(record.media_width)) {
                    document.querySelector('#' + media_width[j].id).checked = true;
                }
            }

            let styles = JSON.parse(record.styles);

            if (Object.keys(styles).length !== 0) {

                if (styles.backgroundColor !== undefined) {
                    document.querySelector('#item-background-color').value = styles.backgroundColor;
                    document.querySelector('#item-background-color-picker').value = styles.backgroundColor;
                } else {
                    document.querySelector('#item-background-color').value = '';
                }

                if (styles.color !== undefined) {
                    document.querySelector('#item-font-color').value = styles.color;
                    document.querySelector('#item-font-color-picker').value = styles.color;
                } else {
                    document.querySelector('#item-font-color').value = '';
                }

                let font_values = document.querySelector('#item-font');

                for (let i = 0; i < font_values.length; i++) {
                    if (font_values[i].value === styles.fontFamily) {
                        document.querySelector('#item-font').value = styles.fontFamily;
                    }
                }

                if (styles.fontSize !== undefined) {
                    document.querySelector('#item-font-size').value = styles.fontSize.replace('px', '');
                } else {
                    document.querySelector('#item-font-size').value = '';
                }
            }

            return false;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.update_grid_item_record = async function () {

        try {

            window.scrollTo(0, 0);
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const grid_id = helperModule.get_parameter_by_name('grid_id');
            const item_id = helperModule.get_parameter_by_name('item_id');

            if (exhibit_id === undefined || grid_id === undefined || item_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to update grid item record.</div>`;
                return false;
            }

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating grid item record...</div>`;

            let data = itemsCommonGridItemFormModule.get_common_grid_item_form_fields();

            if (data === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get form field values</div>`;
                return false;
            } else if (data === false) {
                return false;
            }

            /*
            const user = JSON.parse(sessionStorage.getItem('exhibits_user'));

            if (user.name === null) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to retrieve your name</div>`;
                return false;
            }

             */

            data.updated_by = helperModule.get_user_name(); // user.name;

            let etmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_records.put.endpoint.replace(':exhibit_id', exhibit_id);
            let itmp = etmp.replace(':grid_id', grid_id);
            let endpoint = itmp.replace(':item_id', item_id);
            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'PUT',
                url: endpoint,
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                let message = 'Grid item record updated';
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> ${message}</div>`;

                setTimeout(() => {
                    window.location.reload();
                }, 900);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const redirect = '/items/grid/details?exhibit_id=' + exhibit_id + '&item_id=' + item_id + '&status=403';
            await authModule.check_permissions(['update_item', 'update_any_item'], 'grid_item', exhibit_id, item_id, redirect);

            exhibitsModule.set_exhibit_title(exhibit_id);
            navModule.back_to_grid_items();
            await display_edit_record();
            document.querySelector('#save-item-btn').addEventListener('click', itemsEditGridItemFormModule.update_grid_item_record);

            if (window.location.pathname.indexOf('media') !== -1) {
                helperMediaModule.media_edit_init();
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());

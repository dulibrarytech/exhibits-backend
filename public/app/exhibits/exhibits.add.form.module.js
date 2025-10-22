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

const exhibitsAddFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    function get_exhibit_data () {

        try {

            let exhibit = exhibitsCommonFormModule.get_common_form_fields();

            if (exhibit === false) {
                return exhibit;
            }

            exhibit.styles = exhibitsCommonFormModule.get_exhibit_styles();

            return exhibit;

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.create_exhibit_record = async function () {

        // Cache DOM element and constants
        const messageEl = document.querySelector('#message');
        const REDIRECT_DELAY = 900;
        const TOKEN_ERROR_DELAY = 1000;

        // Helper function to safely display messages (prevents XSS)
        const showMessage = (type, message, icon = 'fa-info') => {
            if (!messageEl) {
                console.error('Message element not found');
                return;
            }

            // Use textContent for security, create elements programmatically
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert alert-${type}`;
            alertDiv.setAttribute('role', 'alert');

            const iconEl = document.createElement('i');
            iconEl.className = `fa ${icon}`;

            const textNode = document.createTextNode(` ${message}`);

            alertDiv.appendChild(iconEl);
            alertDiv.appendChild(textNode);

            // Clear and append
            messageEl.innerHTML = '';
            messageEl.appendChild(alertDiv);
        };

        // Store timeout IDs for cleanup
        let timeoutId = null;

        try {
            // Cross-browser scroll to top
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

            // Validate token early
            const token = authModule.get_user_token();
            if (!token) {
                showMessage('warning', 'Unable to get session token');

                timeoutId = setTimeout(() => {
                    authModule.logout();
                }, TOKEN_ERROR_DELAY);

                return false;
            }

            // Validate exhibit data
            const data = get_exhibit_data();
            console.log('DATA ', data);

            if (!data) {
                return false;
            }

            // Show loading state
            showMessage('info', 'Creating exhibit record...');

            // Add user metadata
            data.created_by = helperModule.get_user_name();
            data.owner = helperModule.get_owner();

            // Make API request with timeout
            const response = await Promise.race([
                httpModule.req({
                    method: 'POST',
                    url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoint,
                    data: data,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), 30000)
                )
            ]);

            // Validate response structure
            if (!response || response.status !== 201) {
                throw new Error('Failed to create exhibit record');
            }

            if (!response.data?.data) {
                throw new Error('Invalid response from server');
            }

            // Show success message
            showMessage('success', 'Exhibit record created');

            // Redirect after delay
            const exhibitId = encodeURIComponent(response.data.data);
            timeoutId = setTimeout(() => {
                window.location.href = `${APP_PATH}/items?exhibit_id=${exhibitId}`;
            }, REDIRECT_DELAY);

            return true;

        } catch (error) {
            // Clear any pending timeouts
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            // Log error for debugging
            console.error('Create exhibit error:', error);

            // Display user-friendly error message
            const errorMessage = error.message || 'An unexpected error occurred';
            showMessage('danger', errorMessage, 'fa-exclamation');

            return false;
        }
    };

    obj.init = function () {

        try {

            document.querySelector('#save-exhibit-btn').addEventListener('click', exhibitsAddFormModule.create_exhibit_record);
            document.querySelector('#hero-trash').addEventListener('click', exhibitsCommonFormModule.delete_hero_image);
            document.querySelector('#thumbnail-trash').addEventListener('click', exhibitsCommonFormModule.delete_thumbnail_image);
            document.querySelector('#item-list-nav').innerHTML = '';

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());

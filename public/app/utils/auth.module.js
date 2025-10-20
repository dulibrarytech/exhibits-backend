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

const authModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const init_endpoints = endpointsModule.init();
    let obj = {};

    obj.get_user_token = function () {

        try {
            // Check if sessionStorage is available (for cross-browser compatibility)
            if (typeof window.sessionStorage === 'undefined') {
                console.warn('sessionStorage is not available');
                return null;
            }

            const token_data = window.sessionStorage.getItem('exhibits_token');

            if (token_data === null) {
                return null;
            }

            let data;

            try {
                data = JSON.parse(token_data);
            } catch (parse_error) {
                console.error('Invalid JSON in sessionStorage:', parse_error.message);
                window.sessionStorage.removeItem('exhibits_token');
                return null;
            }

            // Validate data structure
            if (!data || typeof data !== 'object') {
                console.warn('Invalid token data structure');
                return null;
            }

            // Handle case where token is explicitly null
            if (data.token === null || data.token === undefined) {
                console.warn('Token is null or undefined in sessionStorage');
                redirect_to_login();
                return null;
            }

            // Validate token is a string
            if (typeof data.token !== 'string') {
                console.warn('Token is not a string');
                return null;
            }

            // Validate token is not empty after trimming
            const token = data.token.trim();

            if (token.length === 0) {
                console.warn('Token is empty');
                return null;
            }

            // Sanitize token to prevent XSS attacks
            const sanitized_token = DOMPurify.sanitize(token, { ALLOWED_TAGS: [] });

            // Validate sanitization didn't remove content
            if (sanitized_token !== token) {
                console.warn('Token contained potentially malicious content');
                return null;
            }

            return sanitized_token;

        } catch (error) {
            console.error('Error in get_user_token:', error.message);
            show_error_message(`An error occurred: ${error.message}`);
            return null;
        }
    };

    // Helper function to handle login redirect
    function redirect_to_login() {
        try {
            window.location.replace(`${APP_PATH}/`);
        } catch (error) {
            console.error('Failed to redirect to login:', error.message);
        }
    }

    // Helper function for consistent error messaging
    function show_error_message(message) {
        try {
            const message_el = document.querySelector('#message');
            if (message_el) {
                message_el.innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${message}</div>`;
            }
        } catch (error) {
            console.error('Error displaying message:', error.message);
        }
    }

    obj.get_auth_user_data = async function () {

        try {

            if (!authModule || !helperModule || !httpModule) {
                console.error('Required modules are not available');
                show_error_message('System configuration error.');
                return false;
            }

            // Extract and validate user ID parameter
            const user_id = helperModule.get_parameter_by_name('id');

            if (!user_id) {
                console.warn('Missing required parameter: id');
                return false;
            }

            // Validate user ID format (numeric and positive)
            const parsed_id = Number(user_id);

            if (!Number.isInteger(parsed_id) || parsed_id <= 0) {
                console.warn(`Invalid user ID format: ${user_id}`);
                show_error_message('Invalid user ID format.');
                return false;
            }

            // Save current token to session
            authModule.save_token();

            // Retrieve authentication token
            const token = authModule.get_user_token();
            if (!token) {
                console.warn('Failed to retrieve authentication token');
                authModule.redirect_to_auth();
                return false;
            }

            // Construct URL with validated parameters
            const url = `${init_endpoints.authenticate}?id=${encodeURIComponent(parsed_id)}`;

            // Make authenticated request
            const response = await httpModule.req({
                method: 'GET',
                url: url,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 10000
            });

            // Validate response structure
            if (!response || typeof response.status !== 'number') {
                console.error('Invalid response structure from server');
                show_error_message('Server communication error.');
                return false;
            }

            // Handle successful authentication
            if (response.status === 200) {
                // Validate response data exists and has expected structure
                if (!response.data || typeof response.data !== 'object') {
                    console.error('Invalid user data in response');
                    show_error_message('Invalid server response.');
                    return false;
                }

                // Save authenticated user data
                try {
                    authModule.save_user_auth_data(response.data);
                } catch (save_error) {
                    console.error('Failed to save user auth data:', save_error.message);
                    show_error_message('Failed to save authentication data.');
                    return false;
                }

                return true;
            }

            // Handle authentication failures
            if (response.status === 401 || response.status === 403) {
                console.warn(`Authentication failed with status ${response.status}`);
                authModule.redirect_to_auth();
                return false;
            }

            // Handle other HTTP errors
            console.error(`Server returned status ${response.status}`);
            const error_message = response.data?.message || 'Authentication service error.';
            show_error_message(error_message);
            return false;

        } catch (error) {

            console.error('Error in get_auth_user_data:', error.message);

            if (error.message.includes('timeout')) {
                show_error_message('Request timeout. Please try again.');
            } else if (error.message.includes('network')) {
                show_error_message('Network error. Please check your connection.');
            } else {
                show_error_message(`An error occurred: ${error.message}`);
            }

            return false;
        }
    };

    obj.get_user_profile_data = function () {

        try {

            if (typeof window.sessionStorage === 'undefined') {
                console.warn('sessionStorage is not available');
                authModule.redirect_to_auth();
                return null;
            }

            // Safely retrieve profile data from session storage
            const profile_data = window.sessionStorage.getItem('exhibits_user');

            // Redirect to auth if no profile data exists
            if (profile_data === null || profile_data === '') {
                console.warn('No user profile found in sessionStorage');
                authModule.redirect_to_auth();
                return null;
            }

            let profile;

            try {
                profile = JSON.parse(profile_data);
            } catch (parse_error) {
                console.error('Invalid JSON in sessionStorage:', parse_error.message);
                window.sessionStorage.removeItem('exhibits_user');
                authModule.redirect_to_auth();
                return null;
            }

            if (!profile || typeof profile !== 'object') {
                console.warn('Invalid profile data structure');
                window.sessionStorage.removeItem('exhibits_user');
                authModule.redirect_to_auth();
                return null;
            }

            // Validate required profile fields
            const required_fields = ['uid', 'name'];
            const missing_fields = required_fields.filter(field => !profile[field]);

            if (missing_fields.length > 0) {
                console.warn(`Missing required profile fields: ${missing_fields.join(', ')}`);
                window.sessionStorage.removeItem('exhibits_user');
                authModule.redirect_to_auth();
                return null;
            }

            // Validate critical fields have correct types
            if (typeof profile.uid !== 'string' || profile.uid.length === 0) {
                console.warn('Invalid uid field in profile');
                window.sessionStorage.removeItem('exhibits_user');
                authModule.redirect_to_auth();
                return null;
            }

            const user_id = Number(profile.uid);

            if (!Number.isInteger(user_id) || user_id <= 0) {
                console.warn('Invalid id field in profile');
                window.sessionStorage.removeItem('exhibits_user');
                authModule.redirect_to_auth();
                return null;
            }

            return profile;

        } catch (error) {
            console.error('Error in get_user_profile_data:', error.message);
            show_error_message(`An error occurred: ${error.message}`);
            authModule.redirect_to_auth();
            return null;
        }
    };

    obj.get_user_role = async function (user_id) {

        try {

            if (user_id === null || user_id === undefined) {
                console.warn('Missing required parameter: user_id');
                return null;
            }

            const parsed_id = Number(user_id);

            if (!Number.isInteger(parsed_id) || parsed_id <= 0) {
                console.warn(`Invalid user_id format: ${user_id}`);
                show_error_message('Invalid user ID format.');
                return null;
            }

            // Validate required modules exist
            if (!httpModule) {
                console.error('httpModule is not available');
                show_error_message('System configuration error.');
                return null;
            }

            // Retrieve authentication token
            const token = this.get_user_token();

            if (!token) {
                console.warn('No authentication token available');
                show_error_message('Authentication required. Please log in.');
                return null;
            }

            // Construct URL with safely encoded parameters
            const endpoint = `/exhibits-dashboard/auth/role?user_id=${encodeURIComponent(parsed_id)}`;

            // Make authenticated request with timeout
            const response = await httpModule.req({
                method: 'GET',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                timeout: 10000
            });

            // Validate response structure
            if (!response || typeof response.status !== 'number') {
                console.error('Invalid response structure from server');
                show_error_message('Server communication error.');
                return null;
            }

            // Handle successful response
            if (response.status === 200) {
                // Validate response data structure
                if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
                    console.error('Invalid role data structure in response');
                    show_error_message('Invalid server response.');
                    return null;
                }

                const role_record = response.data[0];

                if (!role_record.role || typeof role_record.role !== 'string') {
                    console.error('Role field missing or invalid in response');
                    show_error_message('Invalid role data received.');
                    return null;
                }

                const role = role_record.role.trim();

                if (role.length === 0) {
                    console.warn('Role is empty string');
                    return null;
                }

                return role;
            }

            // Handle authentication failures
            if (response.status === 401 || response.status === 403) {
                console.warn(`Authorization failed with status ${response.status}`);
                show_error_message('You do not have permission to access this resource.');
                return null;
            }

            // Handle not found
            if (response.status === 404) {
                console.warn(`User not found: ${parsed_id}`);
                show_error_message('User not found.');
                return null;
            }

            // Handle other HTTP errors
            console.error(`Server returned status ${response.status}`);
            const error_message = response.data?.message || 'Failed to retrieve user role.';
            show_error_message(error_message);
            return null;

        } catch (error) {
            console.error('Error in get_user_role:', error.message);

            // Differentiate error types for better debugging and user feedback
            if (error.message.includes('timeout')) {
                show_error_message('Request timeout. Please try again.');
            } else if (error.message.includes('network')) {
                show_error_message('Network error. Please check your connection.');
            } else if (error.message.includes('JSON')) {
                show_error_message('Invalid server response format.');
            } else {
                show_error_message(`An error occurred: ${error.message}`);
            }

            return null;
        }
    };

    obj.check_user_auth_data = function () {

        try {

            if (typeof window.sessionStorage === 'undefined') {
                console.warn('sessionStorage is not available');
                return false;
            }

            // Safely retrieve auth data from session storage
            const auth_data = window.sessionStorage.getItem('exhibits_user');

            // Return false if no auth data exists or is empty
            if (!auth_data || auth_data === '') {
                return false;
            }

            // Validate auth data is properly formatted JSON
            let profile;

            try {
                profile = JSON.parse(auth_data);
            } catch (parse_error) {
                console.warn('Invalid JSON in sessionStorage exhibits_user:', parse_error.message);
                window.sessionStorage.removeItem('exhibits_user');
                return false;
            }

            // Validate auth data structure
            if (!profile || typeof profile !== 'object') {
                console.warn('Invalid auth data structure');
                window.sessionStorage.removeItem('exhibits_user');
                return false;
            }

            // Validate required authentication fields exist
            const required_fields = ['uid', 'name'];
            const has_required_fields = required_fields.every(field => {
                return profile[field] !== null && profile[field] !== undefined && profile[field] !== '';
            });

            if (!has_required_fields) {
                console.warn('Missing required authentication fields');
                window.sessionStorage.removeItem('exhibits_user');
                return false;
            }

            // Validate critical field types
            if (typeof profile.uid !== 'string' || profile.uid.length === 0) {
                console.warn('Invalid uid field in auth data');
                window.sessionStorage.removeItem('exhibits_user');
                return false;
            }

            const user_id = Number(profile.uid);

            if (!Number.isInteger(user_id) || user_id <= 0) {
                console.warn('Invalid id field in auth data');
                window.sessionStorage.removeItem('exhibits_user');
                return false;
            }

            // All validations passed
            return true;

        } catch (error) {
            console.error('Error in check_user_auth_data:', error.message);
            show_error_message('Unable to check user authentication data.');
            return false;
        }
    };

    obj.save_user_auth_data = function (data) {

        try {

            if (!data || typeof data !== 'object') {
                console.warn('Invalid data parameter provided to save_user_auth_data');
                show_error_message('Invalid authentication data format.');
                return false;
            }

            // Validate required nested structure
            if (!data.user_data || typeof data.user_data !== 'object') {
                console.warn('Missing or invalid user_data in authentication response');
                show_error_message('Invalid user data structure.');
                return false;
            }

            // Validate required fields exist
            const required_fields = ['id', 'first_name', 'last_name'];
            for (const field of required_fields) {
                if (data.user_data[field] === null || data.user_data[field] === undefined) {
                    console.warn(`Missing required field in user_data: ${field}`);
                    show_error_message(`Missing required user information: ${field}.`);
                    return false;
                }
            }

            // Validate field types
            if (typeof data.user_data.id !== 'string' && typeof data.user_data.id !== 'number') {
                console.warn('Invalid id type in user_data');
                show_error_message('Invalid user ID format.');
                return false;
            }

            if (typeof data.user_data.first_name !== 'string' || typeof data.user_data.last_name !== 'string') {
                console.warn('Invalid name field types in user_data');
                show_error_message('Invalid user name format.');
                return false;
            }

            // Sanitize and validate user ID
            const sanitized_id = DOMPurify.sanitize(String(data.user_data.id), { ALLOWED_TAGS: [] });
            if (!sanitized_id || sanitized_id.length === 0) {
                console.warn('User ID sanitization resulted in empty value');
                show_error_message('Invalid user ID.');
                return false;
            }

            // Sanitize name fields
            const sanitized_first_name = DOMPurify.sanitize(data.user_data.first_name.trim(), { ALLOWED_TAGS: [] });
            const sanitized_last_name = DOMPurify.sanitize(data.user_data.last_name.trim(), { ALLOWED_TAGS: [] });

            // Validate sanitized names are not empty
            if (!sanitized_first_name || !sanitized_last_name) {
                console.warn('Name sanitization resulted in empty values');
                show_error_message('Invalid user name.');
                return false;
            }

            // Check if sessionStorage is available
            if (typeof window.sessionStorage === 'undefined') {
                console.error('sessionStorage is not available');
                show_error_message('Storage is not available. Please check your browser settings.');
                return false;
            }

            // Build user object with sanitized data
            const user = {
                uid: sanitized_id,
                // id: sanitized_id, // Include both uid and id for backward compatibility
                name: `${sanitized_first_name} ${sanitized_last_name}`
            };

            // Validate user object can be serialized
            let serialized_user;

            try {
                serialized_user = JSON.stringify(user);
            } catch (stringify_error) {
                console.error('Failed to serialize user data:', stringify_error.message);
                show_error_message('Failed to save authentication data.');
                return false;
            }

            // Save user data to session storage
            try {
                window.sessionStorage.setItem('exhibits_user', serialized_user);
            } catch (storage_error) {
                console.error('Failed to save to sessionStorage:', storage_error.message);
                show_error_message('Failed to save authentication data. Storage may be full.');
                return false;
            }

            // Save endpoints data
            try {
                if (data.endpoints) {
                    endpointsModule.save_exhibits_endpoints(data);
                } else {
                    console.warn('No endpoints data provided in authentication response');
                }
            } catch (endpoints_error) {
                console.error('Failed to save endpoints data:', endpoints_error.message);
                // Don't fail completely if endpoints save fails, but log it
                show_error_message('Warning: Failed to cache endpoints data.');
                // Continue and return true since user data was saved
            }

            return true;

        } catch (error) {
            console.error('Error in save_user_auth_data:', error.message);
            show_error_message(`An error occurred while saving authentication data: ${error.message}`);
            return false;
        }
    };

    obj.save_token = function () {

        try {

            if (!helperModule) {
                console.error('helperModule is not available');
                show_error_message('System configuration error.');
                return false;
            }

            // Extract token from URL parameters
            const token = helperModule.get_parameter_by_name('t');

            // Return early if no token provided
            if (!token || token === '') {
                console.debug('No token parameter provided');
                return false;
            }

            // Validate token is a string
            if (typeof token !== 'string') {
                console.warn('Invalid token type provided');
                show_error_message('Invalid token format.');
                return false;
            }

            // Trim whitespace
            const trimmed_token = token.trim();
            if (trimmed_token.length === 0) {
                console.warn('Token is empty after trimming');
                return false;
            }

            // Validate token length (JWT tokens typically 100+ characters)
            if (trimmed_token.length < 20 || trimmed_token.length > 2048) {
                console.warn(`Token length outside acceptable range: ${trimmed_token.length}`);
                show_error_message('Invalid token format.');
                return false;
            }

            // Sanitize token to prevent XSS
            const sanitized_token = DOMPurify.sanitize(trimmed_token, { ALLOWED_TAGS: [] });

            // Validate sanitization didn't remove content
            if (sanitized_token !== trimmed_token) {
                console.warn('Token contained potentially malicious content');
                show_error_message('Invalid token format.');
                return false;
            }

            // Check if sessionStorage is available
            if (typeof window.sessionStorage === 'undefined') {
                console.error('sessionStorage is not available');
                show_error_message('Storage is not available. Please check your browser settings.');
                return false;
            }

            // Build token object
            const token_data = {
                token: sanitized_token,
                saved_at: new Date().toISOString() // Track when token was saved
            };

            // Validate object can be serialized
            let serialized_token;

            try {
                serialized_token = JSON.stringify(token_data);
            } catch (stringify_error) {
                console.error('Failed to serialize token data:', stringify_error.message);
                show_error_message('Failed to save authentication token.');
                return false;
            }

            // Save token to session storage
            try {
                window.sessionStorage.setItem('exhibits_token', serialized_token);
            } catch (storage_error) {
                console.error('Failed to save to sessionStorage:', storage_error.message);
                show_error_message('Failed to save authentication token. Storage may be full.');
                return false;
            }

            return true;

        } catch (error) {
            console.error('Error in save_token:', error.message);
            show_error_message(`An error occurred while saving token: ${error.message}`);
            return false;
        }
    };

    obj.check_auth = async function (token) {

        try {

            if (token === null || token === undefined || token === false || token === '') {
                console.warn('Invalid or missing token provided to check_auth');
                show_error_message('Session expired. Redirecting to login...');
                authModule.redirect_to_auth();
                return false;
            }

            // Validate token is a string
            if (typeof token !== 'string') {
                console.warn('Token is not a string');
                show_error_message('Invalid authentication token.');
                return false;
            }

            // Validate token is not empty after trimming
            const trimmed_token = token.trim();
            if (trimmed_token.length === 0) {
                console.warn('Token is empty string');
                show_error_message('Session expired. Redirecting to login...');
                authModule.redirect_to_auth();
                return false;
            }

            // Validate required modules exist
            if (!endpointsModule || !httpModule) {
                console.error('Required modules not available');
                show_error_message('System configuration error.');
                return false;
            }

            // Retrieve endpoints configuration
            const endpoints = endpointsModule.get_exhibits_endpoints();
            if (!endpoints || !endpoints.exhibits || !endpoints.exhibits.token_verify || !endpoints.exhibits.token_verify.endpoint) {
                console.error('Invalid endpoints configuration');
                show_error_message('System configuration error.');
                return false;
            }

            const verify_endpoint = endpoints.exhibits.token_verify.endpoint;

            // Verify token with server
            const response = await httpModule.req({
                method: 'POST',
                url: verify_endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': trimmed_token
                },
                timeout: 10000
            });

            // Validate response structure
            if (!response || typeof response !== 'object') {
                console.error('Invalid response structure from token verification');
                redirect_to_session();
                return false;
            }

            // Handle successful token verification
            if (response.status === 200) {
                return true;
            }

            // Handle authentication failures
            if (response.status === 401 || response.status === 403) {
                console.warn(`Token verification failed with status ${response.status}`);
                show_error_message('Session expired. Redirecting to login...');
                authModule.redirect_to_auth();
                return false;
            }

            // Handle undefined response (server communication error)
            if (response === undefined) {
                console.error('Undefined response from token verification');
                redirect_to_session();
                return false;
            }

            // Handle other HTTP errors
            console.error(`Token verification returned status ${response.status}`);
            const error_message = response.data?.message || 'Authentication verification failed.';
            show_error_message(error_message);
            return false;

        } catch (error) {
            console.error('Error in check_auth:', error.message);

            // Differentiate error types for better debugging and user feedback
            if (error.message.includes('timeout')) {
                show_error_message('Request timeout. Please try again.');
            } else if (error.message.includes('network')) {
                show_error_message('Network error. Please check your connection.');
            } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
                show_error_message('Session expired. Redirecting to login...');
                authModule.redirect_to_auth();
            } else {
                show_error_message(`An error occurred: ${error.message}`);
            }

            return false;
        }
    };

    // Helper function to redirect to session page
    function redirect_to_session() {
        try {
            window.location.replace(`${APP_PATH}/session`);
        } catch (error) {
            console.error('Failed to redirect to session page:', error.message);
        }
    }

    obj.check_permissions = async function (permissions, record_type, parent_id, child_id, redirect) {
        console.log(child_id);
        try {

            if (!authModule || !httpModule) {
                console.error('Required modules not available');
                show_error_message('System configuration error.');
                return false;
            }

            // Validate input parameters
            if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
                console.warn('Invalid or missing permissions parameter');
                show_error_message('Invalid permission request.');
                return false;
            }

            if (!record_type || typeof record_type !== 'string') {
                console.warn('Invalid or missing record_type parameter');
                show_error_message('Invalid record type.');
                return false;
            }

            // Validate IDs are valid UUIDs if provided
            const is_valid_uuid = (value) => {
                const uuid_pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                return typeof value === 'string' && uuid_pattern.test(value);
            };

            if (parent_id !== null && parent_id !== undefined) {
                if (!is_valid_uuid(parent_id)) {
                    console.warn(`Invalid parent_id format (not a valid UUID): ${parent_id}`);
                    show_error_message('Invalid parent record ID format.');
                    return false;
                }
            }

            /* TODO child id is coming in like this - /items?exhibit_id=69a96c10-a37c-42e3-b31b-bc6c59ddea77&status=403
            // TODO: check init code to fix this
            if (child_id !== null && child_id !== undefined) {
                if (!is_valid_uuid(child_id)) {
                    console.warn(`Invalid child_id format (not a valid UUID): ${child_id}`);
                    show_error_message('Invalid child record ID format.');
                    return false;
                }
            }
            */
            // Retrieve and validate authentication token
            const token = authModule.get_user_token();

            if (!token || token === false || token === '') {
                console.warn('Invalid or missing authentication token');
                show_error_message('Session expired. Redirecting to login...');
                authModule.redirect_to_auth();
                return false;
            }

            // Validate token is a string
            if (typeof token !== 'string') {
                console.warn('Token is not a string');
                show_error_message('Invalid authentication token.');
                return false;
            }

            // Validate redirect parameter format if provided
            let redirect_path = '/access-denied'; // Default redirect

            if (redirect !== null && redirect !== undefined) {
                if (typeof redirect !== 'string' || !redirect.startsWith('/')) {
                    console.warn(`Invalid redirect path format: ${redirect}`);
                    show_error_message('Invalid redirect configuration.');
                    return false;
                }
                redirect_path = redirect;
            }

            // Build permission check request payload
            const request_payload = {
                permissions: permissions,
                record_type: record_type,
                parent_id: parent_id || null,
                child_id: child_id || null
            };

            // Validate payload can be serialized
            let serialized_payload;
            try {
                serialized_payload = JSON.stringify(request_payload);
                console.log(serialized_payload);
            } catch (stringify_error) {
                console.error('Failed to serialize permission request:', stringify_error.message);
                show_error_message('Failed to process permission request.');
                return false;
            }

            // Make permission verification request
            const response = await httpModule.req({
                method: 'POST',
                url: '/exhibits-dashboard/auth/permissions',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                data: request_payload,
                timeout: 10000
            });

            // Validate response structure
            if (!response || typeof response !== 'object') {
                console.error('Invalid response structure from permission verification');
                redirect_to_path(redirect_path);
                return false;
            }

            // Handle successful authorization
            if (response.status === 200) {
                console.debug('User authorized for requested permissions');
                return true;
            }

            // Handle authentication failures
            if (response.status === 401 || response.status === 403) {
                console.warn(`Permission denied with status ${response.status}`);
                show_error_message('You do not have permission to access this resource.');
                redirect_to_path(redirect_path);
                return false;
            }

            // Handle not found
            if (response.status === 404) {
                console.warn('Resource not found during permission check');
                show_error_message('The requested resource was not found.');
                redirect_to_path(redirect_path);
                return false;
            }

            // Handle other HTTP errors
            console.error(`Permission check returned status ${response.status}`);
            const error_message = response.data?.message || 'Permission verification failed.';
            show_error_message(error_message);
            redirect_to_path(redirect_path);
            return false;

        } catch (error) {
            console.error('Error in check_permissions:', error.message);

            // Differentiate error types for better debugging and user feedback
            if (error.message.includes('timeout')) {
                show_error_message('Request timeout. Please try again.');
            } else if (error.message.includes('network')) {
                show_error_message('Network error. Please check your connection.');
            } else if (error.message.includes('401') || error.message.includes('unauthorized')) {
                show_error_message('Session expired. Redirecting to login...');
                authModule.redirect_to_auth();
            } else {
                show_error_message(`An error occurred: ${error.message}`);
            }

            return false;
        }
    };

    // Helper function to safely redirect to a path (access-denied)
    function redirect_to_path(path) {
        try {
            window.location.replace(`${APP_PATH}${path}`);
        } catch (error) {
            console.error('Failed to redirect to path:', error.message);
        }
    }

    obj.redirect_to_auth = function () {
        setTimeout(() => {
            window.location.replace(APP_PATH + '/auth');
        }, 4000);
    };

    obj.clear = function () {
        window.sessionStorage.clear();
        window.localStorage.clear();
    };

    obj.logout = function () {
        window.location.replace(APP_PATH + '/logout');
    };

    obj.init = function () {};

    return obj;

}());

const endpointsModule = (function() {

    'use strict';

    const APP_PATH = '/exhibits-dashboard';

    // Cache for parsed endpoints to avoid repeated JSON.parse
    let endpoints_cache = {
        users: null,
        exhibits: null,
        indexer: null,
        last_updated: null
    };

    let obj = {};

    /**
     * Check if localStorage is available
     */
    const is_local_storage_available = () => {
        try {
            const test_key = '__localStorage_test__';
            window.localStorage.setItem(test_key, 'test');
            window.localStorage.removeItem(test_key);
            return true;
        } catch (error) {
            console.error('localStorage not available:', error);
            return false;
        }
    };

    /**
     * Safely get item from localStorage with JSON parsing
     */
    const safe_get_local_storage = (key, default_value = null) => {
        if (!is_local_storage_available()) {
            console.warn(`localStorage unavailable, cannot get ${key}`);
            return default_value;
        }

        try {
            const item = window.localStorage.getItem(key);

            if (item === null || item === undefined) {
                return default_value;
            }

            // Try to parse JSON
            try {
                return JSON.parse(item);
            } catch (parse_error) {
                console.error(`Error parsing JSON for key "${key}":`, parse_error);
                return default_value;
            }

        } catch (error) {
            console.error(`Error getting localStorage item "${key}":`, error);
            return default_value;
        }
    };

    /**
     * Safely set item to localStorage with JSON stringification
     */
    const safe_set_local_storage = (key, value) => {
        if (!is_local_storage_available()) {
            console.warn(`localStorage unavailable, cannot set ${key}`);
            return false;
        }

        try {
            // Validate value is not undefined
            if (value === undefined) {
                console.error(`Cannot store undefined value for key "${key}"`);
                return false;
            }

            // For strings, store directly. For objects, stringify
            const value_to_store = typeof value === 'string' ? value : JSON.stringify(value);

            window.localStorage.setItem(key, value_to_store);
            return true;

        } catch (error) {
            // Handle quota exceeded errors
            if (error.name === 'QuotaExceededError') {
                console.error('localStorage quota exceeded');
            } else {
                console.error(`Error setting localStorage item "${key}":`, error);
            }
            return false;
        }
    };

    /**
     * Validate endpoint data structure
     */
    const validate_endpoint_data = (data) => {
        if (!data || typeof data !== 'object') {
            return {
                valid: false,
                error: 'Data must be an object'
            };
        }

        if (!data.endpoints || typeof data.endpoints !== 'object') {
            return {
                valid: false,
                error: 'Data must contain "endpoints" object'
            };
        }

        // Check required endpoint types exist
        const required_types = ['users', 'exhibits', 'indexer'];
        const missing_types = required_types.filter(type => !data.endpoints[type]);

        if (missing_types.length > 0) {
            return {
                valid: false,
                error: `Missing required endpoint types: ${missing_types.join(', ')}`
            };
        }

        return { valid: true };
    };

    /**
     * Validate individual endpoint structure
     */
    const validate_endpoint_structure = (endpoints, type) => {
        if (!endpoints || typeof endpoints !== 'object') {
            console.warn(`Invalid ${type} endpoints structure`);
            return false;
        }

        // Check if it has at least one endpoint defined
        const has_endpoints = Object.keys(endpoints).length > 0;

        if (!has_endpoints) {
            console.warn(`No ${type} endpoints defined`);
            return false;
        }

        return true;
    };

    /**
     * Clear endpoints cache
     */
    const clear_cache = () => {
        endpoints_cache = {
            users: null,
            exhibits: null,
            indexer: null,
            last_updated: null
        };
    };

    /**
     * Get cached or fetch from localStorage
     */
    const get_cached_endpoints = (type, storage_key) => {
        // Check cache first
        if (endpoints_cache[type] !== null && endpoints_cache.last_updated) {
            // Cache is valid for 5 minutes
            const cache_age = Date.now() - endpoints_cache.last_updated;
            const cache_max_age = 5 * 60 * 1000; // 5 minutes

            if (cache_age < cache_max_age) {
                return endpoints_cache[type];
            }
        }

        // Fetch from localStorage
        const endpoints = safe_get_local_storage(storage_key);

        // Validate structure
        if (endpoints && validate_endpoint_structure(endpoints, type)) {
            // Update cache
            endpoints_cache[type] = endpoints;
            endpoints_cache.last_updated = Date.now();
            return endpoints;
        }

        console.error(`Failed to load ${type} endpoints from localStorage`);
        return null;
    };

    /**
     * Save exhibits endpoints to localStorage
     */
    obj.save_exhibits_endpoints = function(data) {
        try {
            // Validate input data
            const validation = validate_endpoint_data(data);
            if (!validation.valid) {
                console.error('Invalid endpoint data:', validation.error);
                return false;
            }

            // Save each endpoint type
            const users_saved = safe_set_local_storage(
                'exhibits_endpoints_users',
                data.endpoints.users
            );

            const exhibits_saved = safe_set_local_storage(
                'exhibits_endpoints',
                data.endpoints.exhibits
            );

            const indexer_saved = safe_set_local_storage(
                'exhibits_endpoints_indexer',
                data.endpoints.indexer
            );

            // Check if all saves were successful
            if (users_saved && exhibits_saved && indexer_saved) {
                // Clear cache to force reload
                clear_cache();
                console.log('Endpoints saved successfully');
                return true;
            } else {
                console.error('Failed to save one or more endpoint types');
                return false;
            }

        } catch (error) {
            console.error('Error saving exhibits endpoints:', error);
            return false;
        }
    };

    /**
     * Get users endpoints
     */
    obj.get_users_endpoints = function() {
        try {
            return get_cached_endpoints('users', 'exhibits_endpoints_users');
        } catch (error) {
            console.error('Error getting users endpoints:', error);
            return null;
        }
    };

    /**
     * Get indexer endpoints
     */
    obj.get_indexer_endpoints = function() {
        try {
            return get_cached_endpoints('indexer', 'exhibits_endpoints_indexer');
        } catch (error) {
            console.error('Error getting indexer endpoints:', error);
            return null;
        }
    };

    /**
     * Get exhibits endpoints
     */
    obj.get_exhibits_endpoints = function() {
        try {
            return get_cached_endpoints('exhibits', 'exhibits_endpoints');
        } catch (error) {
            console.error('Error getting exhibits endpoints:', error);
            return null;
        }
    };

    /**
     * Clear all endpoints from localStorage
     */
    obj.clear_exhibits_endpoints = function() {
        try {
            if (!is_local_storage_available()) {
                return false;
            }

            window.localStorage.removeItem('exhibits_endpoints_users');
            window.localStorage.removeItem('exhibits_endpoints');
            window.localStorage.removeItem('exhibits_endpoints_indexer');

            clear_cache();
            console.log('Endpoints cleared successfully');
            return true;

        } catch (error) {
            console.error('Error clearing endpoints:', error);
            return false;
        }
    };

    /**
     * Check if endpoints are configured
     */
    obj.are_endpoints_configured = function() {
        try {
            const users = obj.get_users_endpoints();
            const exhibits = obj.get_exhibits_endpoints();
            const indexer = obj.get_indexer_endpoints();

            return !!(users && exhibits && indexer);

        } catch (error) {
            console.error('Error checking endpoints configuration:', error);
            return false;
        }
    };

    /**
     * Get all endpoints
     */
    obj.get_all_endpoints = function() {
        try {
            return {
                users: obj.get_users_endpoints(),
                exhibits: obj.get_exhibits_endpoints(),
                indexer: obj.get_indexer_endpoints()
            };
        } catch (error) {
            console.error('Error getting all endpoints:', error);
            return null;
        }
    };

    /**
     * Initialize endpoints module
     */
    obj.init = function() {
        try {
            // Check localStorage availability
            if (!is_local_storage_available()) {
                console.error('localStorage not available - endpoints module cannot function');
                return null;
            }

            // Save app path
            const path_saved = safe_set_local_storage('exhibits_app_path', APP_PATH);

            if (!path_saved) {
                console.error('Failed to save app path');
            }

            // Return authentication endpoint
            return {
                authenticate: `${APP_PATH}/api/v1/authenticate`,
                app_path: APP_PATH
            };

        } catch (error) {
            console.error('Error initializing endpoints module:', error);
            return null;
        }
    };

    /**
     * Get app path
     */
    obj.get_app_path = function() {
        return APP_PATH;
    };

    /**
     * Refresh cache (force reload from localStorage)
     */
    obj.refresh_cache = function() {
        clear_cache();
        console.log('Endpoints cache cleared');
    };

    return obj;

}());
const endpointsModule = (function() {

    'use strict';

    const APP_PATH = '/exhibits-dashboard';

    // Endpoints-registry version. The client caches the server's endpoint
    // map in localStorage at authenticate time and reuses it indefinitely
    // (no TTL). When the server adds/changes an endpoint, already-logged-in
    // clients keep the stale map and silently 404 on the new endpoint until
    // they re-authenticate. BUMP THIS STRING whenever the endpoint set the
    // client must know about changes — a mismatch on the next page load
    // wipes the stale cache and routes the client back through the normal
    // auth flow once (the automated equivalent of a manual logout/login),
    // so the new registry is refetched. History:
    //   '1' — baseline
    //   '2' — added media_library.upload.get / upload.delete
    const ENDPOINTS_REGISTRY_VERSION = '2';
    const ENDPOINTS_VERSION_KEY = 'exhibits_endpoints_version';
    // sessionStorage one-shot guard so a failed/no-op re-auth can't loop.
    const ENDPOINTS_REFRESH_GUARD = 'exhibits_endpoints_refresh_attempted';

    // Cache for parsed endpoints to avoid repeated JSON.parse
    let endpoints_cache = {
        users: null,
        exhibits: null,
        indexer: null,
        media_library: null,
        last_updated: null
    };

    let obj = {};

    /**
     * Probe localStorage once at module init. Every get/set call previously
     * performed a setItem/removeItem round-trip just to confirm availability;
     * on a page load with ~dozens of endpoint reads, that added up. The
     * probe runs once here and the boolean is reused.
     */
    const LOCAL_STORAGE_AVAILABLE = (() => {
        try {
            const test_key = '__localStorage_test__';
            window.localStorage.setItem(test_key, 'test');
            window.localStorage.removeItem(test_key);
            return true;
        } catch (error) {
            console.error('localStorage not available:', error);
            return false;
        }
    })();

    const is_local_storage_available = () => LOCAL_STORAGE_AVAILABLE;

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
        const required_types = ['users', 'exhibits', 'indexer', 'media_library'];
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
            media_library: null,
            last_updated: null
        };
    };

    /**
     * Resolves the build-time endpoint templates (endpoints.templates.js,
     * generated from the server endpoint modules) against the runtime
     * APP_PATH. Synchronous and storage-free, so it cannot be cold or null.
     * Memoized per resolved path.
     */
    let resolved_templates = null;
    let resolved_templates_app_path = null;

    const get_endpoint_templates = () => {

        if (typeof ENDPOINT_TEMPLATES === 'undefined' || !ENDPOINT_TEMPLATES) {
            return null;
        }

        const app_path = obj.get_app_path();

        if (resolved_templates && resolved_templates_app_path === app_path) {
            return resolved_templates;
        }

        try {
            const raw = JSON.stringify(ENDPOINT_TEMPLATES);
            resolved_templates = JSON.parse(raw.split('__APP_PATH__').join(app_path));
            resolved_templates_app_path = app_path;
            return resolved_templates;
        } catch (error) {
            console.error('Error resolving endpoint templates:', error);
            return null;
        }
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

            const media_library_saved = safe_set_local_storage(
                'exhibits_endpoints_media_library',
                data.endpoints.media_library
            );

            // Check if all saves were successful
            if (users_saved && exhibits_saved && indexer_saved && media_library_saved) {
                // Stamp the registry version so future deploys can detect a
                // stale client, and release the one-shot refresh guard.
                safe_set_local_storage(ENDPOINTS_VERSION_KEY, ENDPOINTS_REGISTRY_VERSION);
                try {
                    if (window.sessionStorage) {
                        window.sessionStorage.removeItem(ENDPOINTS_REFRESH_GUARD);
                    }
                } catch (guard_error) {
                    console.warn('Could not clear endpoints refresh guard:', guard_error.message);
                }

                // Clear cache to force reload
                clear_cache();
                console.debug('Endpoints saved successfully');
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
            const templates = get_endpoint_templates();
            if (templates && templates.users) {
                return templates.users;
            }
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
            const templates = get_endpoint_templates();
            if (templates && templates.indexer) {
                return templates.indexer;
            }
            return get_cached_endpoints('indexer', 'exhibits_endpoints_indexer');
        } catch (error) {
            console.error('Error getting indexer endpoints:', error);
            return null;
        }
    };

    /**
     * Get media library endpoints
     */
    obj.get_media_library_endpoints = function() {
        try {
            const templates = get_endpoint_templates();
            if (templates && templates.media_library) {
                return templates.media_library;
            }
            return get_cached_endpoints('media_library', 'exhibits_endpoints_media_library');
        } catch (error) {
            console.error('Error getting media library endpoints:', error);
            return null;
        }
    };

    /**
     * Get exhibits endpoints
     */
    obj.get_exhibits_endpoints = function() {
        try {
            const templates = get_endpoint_templates();
            if (templates && templates.exhibits) {
                return templates.exhibits;
            }
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
            window.localStorage.removeItem('exhibits_endpoints_media_library');
            window.localStorage.removeItem(ENDPOINTS_VERSION_KEY);

            clear_cache();
            console.debug('Endpoints cleared successfully');
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
            const media_library = obj.get_media_library_endpoints();

            return !!(users && exhibits && indexer && media_library);

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
                indexer: obj.get_indexer_endpoints(),
                media_library: obj.get_media_library_endpoints()
            };
        } catch (error) {
            console.error('Error getting all endpoints:', error);
            return null;
        }
    };

    /**
     * Enforce the endpoints-registry version.
     *
     * Runs once per page load (from init). If a previously-cached registry
     * exists but its stored version does not match ENDPOINTS_REGISTRY_VERSION
     * (including the legacy case of no stored version at all), the stale
     * registry is wiped and the client is routed back through the auth entry
     * exactly once — the automated equivalent of the manual logout/login
     * users otherwise need after the server adds an endpoint.
     *
     * Brand-new clients (no cached registry) are left untouched: they follow
     * the normal first-time auth flow, which stamps the current version.
     */
    const enforce_registry_version = () => {

        if (!is_local_storage_available()) {
            return;
        }

        let stored_version = null;

        try {
            stored_version = window.localStorage.getItem(ENDPOINTS_VERSION_KEY);
        } catch (error) {
            return;
        }

        if (stored_version === ENDPOINTS_REGISTRY_VERSION) {
            return; // up to date
        }

        // Only act when there is a previously-configured registry to
        // invalidate. A client with no cached endpoints is simply new.
        const had_endpoints = !!(
            safe_get_local_storage('exhibits_endpoints_media_library') ||
            safe_get_local_storage('exhibits_endpoints') ||
            safe_get_local_storage('exhibits_endpoints_users') ||
            safe_get_local_storage('exhibits_endpoints_indexer')
        );

        if (!had_endpoints) {
            return;
        }

        console.warn(
            'Endpoints registry version mismatch (have "' +
            (stored_version || 'none') + '", need "' + ENDPOINTS_REGISTRY_VERSION +
            '") — clearing stale cached endpoints and refreshing'
        );

        obj.clear_exhibits_endpoints();

        // One-shot, loop-safe re-auth so the new registry is refetched. The
        // guard lives in sessionStorage (per tab) and is cleared on the next
        // successful save; if the round-trip fails to repopulate, we degrade
        // to the prior behavior (warning + placeholder) instead of looping.
        try {
            const already_attempted =
                window.sessionStorage &&
                window.sessionStorage.getItem(ENDPOINTS_REFRESH_GUARD) === '1';

            const at_entry =
                window.location &&
                typeof window.location.pathname === 'string' &&
                (window.location.pathname === APP_PATH + '/' ||
                 window.location.pathname === APP_PATH);

            if (!already_attempted && !at_entry) {
                if (window.sessionStorage) {
                    window.sessionStorage.setItem(ENDPOINTS_REFRESH_GUARD, '1');
                }
                window.location.replace(APP_PATH + '/');
            }
        } catch (error) {
            console.error('Endpoints version refresh redirect failed:', error);
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

            // Invalidate + refresh a stale registry before any consumer
            // reads it (may redirect; the page unloads in that case).
            enforce_registry_version();

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
        // Single source of truth for the app path. Prefer the localStorage cache when
        // present (lets tests/e2e override the base), else the hardcoded APP_PATH.
        // Consumers call this instead of reading the cache directly, so a cold cache
        // (first login) can never yield null → no broken `null/...` redirects.
        try {
            return window.localStorage.getItem('exhibits_app_path') || APP_PATH;
        } catch (error) {
            return APP_PATH;
        }
    };

    /**
     * Refresh cache (force reload from localStorage)
     */
    obj.refresh_cache = function() {
        clear_cache();
        console.debug('Endpoints cache cleared');
    };

    return obj;

}());
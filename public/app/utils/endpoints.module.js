/*
 * Single source of the client's API endpoint map and of APP_PATH.
 */

const endpointsModule = (function() {

    'use strict';

    /*
     * The dashboard's public path is a build constant: nginx proxies
     * `/exhibits-dashboard` to this app and the server's .env carries the
     * same value, so the endpoint map below is generated with it already in
     * place (tools/generate-client-endpoints.js).
     */
    const APP_PATH = '/exhibits-dashboard';

    let obj = {};

    /*
     * The live endpoint map ships inside the client bundle
     * (endpoints.templates.js, generated from the server endpoint modules by
     * `npm run build:js`), so it is replaced atomically with the code that
     * reads it and cannot go stale. Every page that loads this module loads
     * the templates first; the guard only matters to unit tests that evaluate
     * this file on its own.
     */
    const templates = () => {
        return (typeof ENDPOINT_TEMPLATES !== 'undefined' && ENDPOINT_TEMPLATES) ? ENDPOINT_TEMPLATES : null;
    };

    /**
     * One section of the generated map, or null (after a console.error) when
     * the bundle does not carry it.
     * @param {string} name - 'exhibits' | 'users' | 'media_library' | 'auth'
     * @returns {Object|null}
     */
    const section = (name) => {

        const map = templates();

        if (map && map[name]) {
            return map[name];
        }

        console.error(`Endpoint templates for "${name}" are missing (run build:js)`);
        return null;
    };

    obj.get_exhibits_endpoints = () => section('exhibits');
    obj.get_users_endpoints = () => section('users');
    obj.get_media_library_endpoints = () => section('media_library');
    obj.get_auth_endpoints = () => section('auth');

    /**
     * The /authenticate URL, read from the generated registry.
     * @returns {string|null}
     */
    obj.get_authenticate_endpoint = function() {
        const endpoint = obj.get_auth_endpoints()?.auth?.authentication?.get?.endpoint;
        return (typeof endpoint === 'string' && endpoint.length > 0) ? endpoint : null;
    };

    /**
     * The dashboard's public path. Consumers call this rather than
     * hardcoding the string.
     * @returns {string}
     */
    obj.get_app_path = function() {
        return APP_PATH;
    };

    /**
     * Escapes regex metacharacters so a placeholder name can be embedded in a
     * RegExp literal safely.
     */
    const escape_regex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    /**
     * Substitutes `:name` placeholders in an endpoint template string with
     * URL-encoded parameter values. Shared by every `.replace(':x_id', …)`
     * site.
     *
     * The registry is nested (EXHIBITS_ENDPOINTS.grid_records.get.endpoint),
     * so this takes the template STRING, not a registry key.
     *
     * Behaviour:
     *   - Each params[name] is coerced with String() and encodeURIComponent()
     *     and replaces EVERY `:name` occurrence. Matching is prefix-safe:
     *     `:item` never touches `:item_id`.
     *   - A param whose value is undefined, null or '' logs a console.error
     *     and makes the call return null (0 and false are accepted values).
     *   - A non-string / empty template returns null.
     *   - A missing/non-object `params` is treated as {}.
     *   - Placeholders still present after substitution log a console.warn;
     *     the partially-built string is still returned.
     *
     * @param {string} template - e.g. '/exhibits-dashboard/api/v1/exhibits/:exhibit_id/items/:item_id'
     * @param {Object} params   - { exhibit_id: 'abc', item_id: 'def' }
     * @returns {string|null}
     */
    obj.build = function(template, params) {

        if (typeof template !== 'string' || template.length === 0) {
            console.error('endpointsModule.build: template must be a non-empty string');
            return null;
        }

        const values = (params && typeof params === 'object') ? params : {};
        let endpoint = template;

        for (const [key, value] of Object.entries(values)) {

            if (value === undefined || value === null || value === '') {
                console.error(`endpointsModule.build: missing required parameter: ${key}`);
                return null;
            }

            const placeholder = new RegExp(`:${escape_regex(key)}(?![A-Za-z0-9_])`, 'g');
            const encoded_value = encodeURIComponent(String(value));
            endpoint = endpoint.replace(placeholder, () => encoded_value);
        }

        const unresolved = endpoint.match(/:[A-Za-z_][A-Za-z0-9_]*/g);

        if (unresolved) {
            console.warn(`endpointsModule.build: unresolved placeholders: ${unresolved.join(', ')}`);
        }

        return endpoint;
    };

    return obj;

}());
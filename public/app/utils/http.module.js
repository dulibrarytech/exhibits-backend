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

 Design history and rationale: NOTES/EXHIBITS_BACKEND_CODE_NOTES.md

 */

const httpModule = (function() {

    'use strict';

    const HTTP = axios;
    let obj = {};

    /**
     * Wraps axios requests with centralized auth-failure handling.
     *
     * Callers should set `validateStatus: (status) => status >= 200 && status < 600`
     * on their request config so that 4xx/5xx responses resolve normally and can
     * be inspected via response.status. This catch block is a fallback for
     * requests that don't opt in to that behavior, and for genuine network
     * failures (offline, DNS, CORS, timeout) where no response is received.
     *
     * @param {Object} request - Axios request config
     * @returns {Promise<Object|undefined>} Axios response object, or undefined on
     *   network failure / 401 redirect.
     */
    obj.req = async function(request) {

        try {
            return await HTTP(request);
        } catch (error) {

            // 401 Unauthorized: session expired — redirect to auth.
            // Use optional chaining so a missing error.response (network error,
            // aborted request) doesn't itself throw a TypeError.
            if (error.response?.status === 401) {
                authModule.redirect_to_auth();
                return;
            }

            // For other HTTP error statuses, return the axios response object
            // so the caller can inspect status and data. This prevents silent
            // `undefined` returns when a caller hasn't set validateStatus.
            if (error.response) {
                return error.response;
            }

            // No response means a true network failure (offline, DNS, CORS,
            // timeout, or aborted request). Log for diagnosis and return
            // undefined so callers can branch on !response.
            console.error('httpModule.req: network error', {
                message: error.message,
                code: error.code,
                url: request?.url
            });
            return;
        }
    };

    /* Missing-token behaviour: alert in #message, then authModule.logout()
     * after 1000 ms. */
    const MISSING_TOKEN_MESSAGE = 'Session expired. Please log in again.';
    const MISSING_TOKEN_LOGOUT_DELAY_MS = 1000;
    const DEFAULT_TIMEOUT_MS = 30000;

    /*
     * Permissive status predicate: 2xx-5xx resolve normally so callers keep
     * branching on response.status instead of catching.
     */
    const accept_any_status = (status) => status >= 200 && status < 600;

    /*
     * Reads the session token through authModule (a global loaded after this
     * module — resolved at call time, never at load time).
     */
    const resolve_token = () => {

        try {

            if (typeof authModule === 'undefined' || typeof authModule.get_user_token !== 'function') {
                return null;
            }

            const token = authModule.get_user_token();
            return (typeof token === 'string' && token.length > 0) ? token : null;

        } catch (error) {
            console.error('httpModule.api: unable to resolve token', error);
            return null;
        }
    };

    const handle_missing_token = () => {

        try {

            if (typeof domModule !== 'undefined'
                && typeof domModule.set_alert === 'function'
                && document.querySelector('#message')) {
                domModule.set_alert('#message', 'danger', MISSING_TOKEN_MESSAGE);
            }

        } catch (error) {
            console.error('httpModule.api: unable to render session alert', error);
        }

        setTimeout(() => {
            if (typeof authModule !== 'undefined' && typeof authModule.logout === 'function') {
                authModule.logout();
            }
        }, MISSING_TOKEN_LOGOUT_DELAY_MS);
    };

    /**
     * Token-injecting wrapper over obj.req for the dashboard's authenticated
     * JSON API calls. Modules call this instead of resolving the token and
     * assembling headers/timeout/validateStatus per call.
     *
     * Behaviour:
     *   - Resolves the token via authModule.get_user_token(). When missing:
     *     writes "Session expired. Please log in again." as a danger alert
     *     into #message (when domModule and #message exist), schedules
     *     authModule.logout() after 1000 ms, and resolves to null. Pass
     *     options.logout_on_missing_token === false to resolve to null
     *     silently instead (callers that report their own {success:false}).
     *   - Injects 'Content-Type: application/json' and 'x-access-token';
     *     caller-supplied headers are merged over those defaults.
     *   - Defaults timeout to 30000 ms and validateStatus to the permissive
     *     2xx-5xx predicate. Never throws on an HTTP status.
     *   - Every other axios config key (params, responseType, signal, ...)
     *     passes through untouched. `data` is passed as given (object or
     *     pre-serialised JSON string both work with axios).
     *   - Returns the axios response unchanged; undefined on network failure
     *     or after a 401 (redirect_to_auth is called whether the 401 rejected
     *     or resolved under the permissive validateStatus).
     *
     * @param {Object} options
     * @param {string} [options.method='GET']
     * @param {string} options.url
     * @param {*} [options.data]
     * @param {number} [options.timeout=30000]
     * @param {Object} [options.headers]
     * @param {Function} [options.validateStatus]
     * @param {boolean} [options.logout_on_missing_token=true]
     * @returns {Promise<Object|null|undefined>}
     */
    obj.api = async function(options) {

        const config = Object.assign({}, options || {});
        const method = config.method || 'GET';
        const timeout = (typeof config.timeout === 'number') ? config.timeout : DEFAULT_TIMEOUT_MS;
        const caller_headers = config.headers || {};
        const validate_status = (typeof config.validateStatus === 'function')
            ? config.validateStatus
            : accept_any_status;
        const logout_on_missing_token = config.logout_on_missing_token !== false;

        delete config.logout_on_missing_token;

        const token = resolve_token();

        if (!token) {

            if (logout_on_missing_token) {
                handle_missing_token();
            }

            return null;
        }

        const request = Object.assign(config, {
            method: method,
            timeout: timeout,
            headers: Object.assign({
                'Content-Type': 'application/json',
                'x-access-token': token
            }, caller_headers),
            validateStatus: validate_status
        });

        const response = await obj.req(request);

        /*
         * With the permissive validateStatus a 401 resolves instead of
         * rejecting, so obj.req's catch-block redirect never fires. The
         * session-expired contract is preserved here: redirect and resolve
         * undefined, exactly as obj.req does on a rejected 401.
         */
        if (response && response.status === 401) {
            if (typeof authModule !== 'undefined' && typeof authModule.redirect_to_auth === 'function') {
                authModule.redirect_to_auth();
            }
            return undefined;
        }

        return response;
    };

    return obj;

})();
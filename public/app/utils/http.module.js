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

    return obj;

})();
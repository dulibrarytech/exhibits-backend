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

'use strict';

const { APP_PATH, api_base } = require('../libs/endpoints_config');

const AUTH_BASE = `${APP_PATH}/auth`;

const ENDPOINTS = {
    auth: {
        auth_landing: {
            get: {
                description: 'Renders the sign-in landing page',
                endpoint: AUTH_BASE
            }
        },
        auth_login: {
            get: {
                description: 'Redirects the browser to the DU SSO login URL',
                endpoint: `${AUTH_BASE}/login`
            }
        },
        /* `/auth/sso`, not `/sso` — it must match the route auth/routes.js
         * registers. Pinned by
         * test/integration/auth_routes_integration.test.js. */
        sso: {
            post: {
                description: 'Accepts DU authproxy payload after SSO authentication has occurred',
                endpoint: `${AUTH_BASE}/sso`,
                body: 'sso payload - employeeID, HTTP_HOST'
            }
        },
        auth_permissions: {
            post: {
                description: 'Checks the signed-in user permissions',
                endpoint: `${AUTH_BASE}/permissions`,
                params: 'token'
            }
        },
        auth_roles: {
            get: {
                description: 'Gets all assignable roles',
                endpoint: `${AUTH_BASE}/roles`,
                params: 'token'
            }
        },
        auth_role: {
            get: {
                description: 'Gets the signed-in user role',
                endpoint: `${AUTH_BASE}/role`,
                params: 'token'
            }
        },
        authentication: {
            get: {
                description: 'Authenticates application admin users',
                endpoint: api_base('/authenticate'),
                params: 'token or api_key'
            }
        }
    }
};

module.exports = function() {
    return ENDPOINTS;
};

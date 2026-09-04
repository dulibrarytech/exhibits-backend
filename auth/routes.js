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

'use strict';

const CONTROLLER = require('../auth/controller');
const ENDPOINTS = require('../auth/endpoints');
const TOKENS = require('../libs/tokens');
const SSO_GUARD = require('../auth/sso_guard');
const {rate_limits} = require('../config/rate_limits_loader');
const { async_handler } = require('../libs/http');

module.exports = function (app) {

    /* Every path comes from auth/endpoints.js so the registry cannot drift
     * from what is actually registered. */
    const endpoints = ENDPOINTS().auth;

    app.route(endpoints.auth_landing.get.endpoint)
        .get(CONTROLLER.get_auth_landing);

    app.route(endpoints.auth_login.get.endpoint)
        .get(rate_limits.auth_operations, CONTROLLER.initiate_login);

    // SSO_GUARD runs first — it authenticates the request PATH
    // (shared-secret header injected by the local proxy and/or a source-IP
    // allowlist) so the body-only auth cannot be replayed by an arbitrary
    // client. Fails closed in production when unconfigured. See auth/sso_guard.js.
    app.route(endpoints.sso.post.endpoint)
        .post(SSO_GUARD, rate_limits.auth_identity_operations, async_handler(CONTROLLER.sso));

    app.route(endpoints.auth_permissions.post.endpoint)
        .post(TOKENS.verify, async_handler(CONTROLLER.check_permissions));

    app.route(endpoints.auth_roles.get.endpoint)
        .get(TOKENS.verify, async_handler(CONTROLLER.get_roles));

    app.route(endpoints.auth_role.get.endpoint)
        .get(TOKENS.verify, async_handler(CONTROLLER.get_user_role));

    app.route(endpoints.authentication.get.endpoint)
        .get(TOKENS.verify, async_handler(CONTROLLER.get_auth_user_data));
};

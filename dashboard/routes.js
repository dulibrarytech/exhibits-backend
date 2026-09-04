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

const APP_CONFIG = require('../config/app_config')();
const CONTROLLER = require('../dashboard/controller');
const TOKENS = require('../libs/tokens');
const APP_PATH = APP_CONFIG.app_path;

// Page-level auth for the dashboard HTML. verify_page reads the session from the
// `exhibits_token` cookie (sent on page navigations) and redirects to SSO if it's
// missing/invalid, so the admin UI isn't served to anonymous users. (Data APIs are
// already protected separately.) The auth/error pages — logout, session-out,
// access-denied — stay public.
const PAGE_AUTH = TOKENS.verify_page;

module.exports = function (app) {

    /*
     * One registration per PAGES entry (dashboard/controller.js). That table is
     * the single source of truth for a page's path, view, nav and auth posture —
     * add a page there, not here.
     */
    for (const page of CONTROLLER.PAGES) {

        const handler = CONTROLLER[page.handler];

        if (page.public === true) {
            app.route(APP_PATH + page.path).get(handler);
        } else {
            app.route(APP_PATH + page.path).get(PAGE_AUTH, handler);
        }
    }

};

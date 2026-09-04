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

const { api_base, unprefixed_api_base } = require('../libs/endpoints_config');

const BASE = api_base('/indexer');

/*
 * DELIBERATE: the per-record indexer routes are mounted WITHOUT APP_PATH, so
 * they answer on /api/v1/indexer/:uuid rather than
 * /exhibits-dashboard/api/v1/indexer/:uuid. Only the dashboard path prefix is
 * proxied publicly (nginx maps /exhibits-dashboard → :8004), which keeps these
 * routes reachable on the app port only. Nothing in public/app calls them; the
 * consumers are the live e2e specs (test/e2e/live/exhibit-delete-index.live.spec.js,
 * test/e2e/live/container-item-delete-index.live.spec.js), which hit
 * `/api/v1/indexer/${uuid}` directly. `index_utils` (the /manage screen) IS
 * browser-facing and therefore DOES carry APP_PATH.
 * Pinned by test/integration/client_endpoints_parity.test.js.
 */
const RECORD_BASE = unprefixed_api_base('/indexer');

const ENDPOINTS = {
    indexer: {
        index_records: {
            get: {
                description: 'gets indexed record',
                endpoint: `${RECORD_BASE}/:uuid`,
                params: 'token or api_key'
            },
            post: {
                description: 'indexes exhibit index record',
                endpoint: `${RECORD_BASE}/:uuid`,
                params: 'token or api_key'
            },
            delete: {
                description: 'Deletes exhibit indexed record',
                endpoint: `${RECORD_BASE}/:uuid`,
                params: 'token or api_key'
            }
        },
        index_utils: {
            get: {
                description: 'Retrieves search index information',
                endpoint: `${BASE}/manage`,
                params: 'token or api_key'
            },
            post: {
                description: 'Creates search index',
                endpoint: `${BASE}/manage`,
                params: 'token or api_key'
            }
        }
    }
};

module.exports = () => {
    return ENDPOINTS;
};

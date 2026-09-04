/**

 Copyright 2026 University of Denver

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

const APP_CONFIG = require('../config/app_config')();

/*
 * One definition of the URL prelude every endpoint registry is built from.
 *
 * Before this module each of the five registries (exhibits, users, auth,
 * indexer, media-library) re-declared APP_CONFIG / APP_PATH / PREFIX /
 * VERSION / ENDPOINT for itself, and then repeated
 * `${APP_PATH}${PREFIX}${VERSION}${ENDPOINT}` on every entry.
 *
 * Registries now do:
 *
 *   const { api_base } = require('../libs/endpoints_config');
 *   const BASE = api_base('/exhibits');
 *
 * and write `${BASE}/:exhibit_id`.
 */

const APP_PATH = APP_CONFIG.app_path;
const PREFIX = '/api/';
const VERSION = 'v1';

/* `${APP_PATH}/api/v1` — the stem shared by every versioned API route. */
const API_ROOT = `${APP_PATH}${PREFIX}${VERSION}`;

/**
 * Builds one registry's BASE from the module's own path segment.
 * @param {string} endpoint - leading-slash segment, e.g. '/exhibits'
 * @returns {string}
 */
const api_base = (endpoint) => `${API_ROOT}${endpoint}`;

/**
 * The same stem WITHOUT APP_PATH, for the handful of routes that are
 * deliberately not mounted under the dashboard's public path prefix.
 * See indexer/endpoints.js `index_records`.
 * @param {string} endpoint - leading-slash segment, e.g. '/indexer'
 * @returns {string}
 */
const unprefixed_api_base = (endpoint) => `${PREFIX}${VERSION}${endpoint}`;

module.exports = {
    APP_PATH,
    PREFIX,
    VERSION,
    API_ROOT,
    api_base,
    unprefixed_api_base
};

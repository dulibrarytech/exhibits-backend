/**

 Copyright 2025 University of Denver

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

/*
 * Single source of truth for UUID validation. Strict RFC 4122 shape
 * (version 1-5, variant 8-b), case-insensitive. Every record id in this
 * application is minted by the uuid library, so the strict shape is the
 * correct one.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates a UUID string
 * @param {*} uuid - Candidate value
 * @returns {boolean} True when `uuid` is a non-empty string in strict RFC 4122 shape
 */
const is_valid_uuid = (uuid) => {
    if (!uuid || typeof uuid !== 'string') {
        return false;
    }

    return UUID_REGEX.test(uuid);
};

module.exports = {
    UUID_REGEX,
    is_valid_uuid
};

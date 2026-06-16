/**

 Copyright 2024 University of Denver

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

/**
 * Validation schema for creating a media-library record. Consumed by the shared
 * libs/validate Validator (ajv), which marks every listed key as required and
 * checks its type. These are the columns that are NOT NULL without a default in
 * tbl_media_library, so every media record — uploaded, repo, or Kaltura — must
 * supply them; the optional metadata columns are not required here. Mirrors the
 * per-domain create schemas under exhibits/schemas.
 */
module.exports = () => {

    return {
        name: {type: 'string'},
        media_type: {type: 'string'},
        ingest_method: {type: 'string'}
    };
};

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

const UPLOAD_CONFIG = {
    exhibits_upload_path: process.env.EXHIBITS_UPLOAD_PATH,
    headings_upload_path: process.env.HEADINGS_UPLOAD_PATH,
    items_upload_path: process.env.ITEMS_UPLOAD_PATH
};

module.exports = () => {
    return UPLOAD_CONFIG;
};
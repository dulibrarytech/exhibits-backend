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

module.exports = () => {

    return {
        title: {type: 'string'},
        subtitle: {type: 'string'},
        banner_template: {type: 'string'},
        hero_image: {type: 'string'},
        description: {type: 'string'},
        page_layout: {type: 'string'},
        template: {type: 'string'},
        styles: {type: 'object'}
    };
};
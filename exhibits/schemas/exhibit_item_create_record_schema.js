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
        is_member_of_exhibit: {type: 'string'},
        uuid: {type: 'string'},
        date: {type: 'string'},
        title: {type: 'string'},
        caption: {type: 'string'},
        description: {type: 'string'},
        template: {type: 'string'},
        item_type: {type: 'string'},
        url: {type: 'string'},
        text: {type: 'string'},
        layout: {type: 'string'},
        styles: {type: 'string'},
        columns: {type: 'number'},
        order: {type: 'number'}
    };
};
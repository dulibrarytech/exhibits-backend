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

const homeModule = (function () {

    'use strict';

    let obj = {};

    obj.init = function() {

        if (authModule.check_user_auth_data() === false) {
            authModule.get_auth_user_data();
        }

        history.replaceState({}, '', '/dashboard/exhibits');
        history.pushState({}, '', '/dashboard/exhibits');

        let home_timer = setTimeout(async () => {
            document.querySelector('#message').innerHTML = '<div class="alert alert-primary" role="alert">Loading...</div>';
            await exhibitsModule.init();
            clearTimeout(home_timer);
        }, 0);

    };

    return obj;

}());

homeModule.init();

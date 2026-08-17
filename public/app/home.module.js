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

    const APP_PATH = endpointsModule.get_app_path();
    let obj = {};

    obj.init = async function() {

        /*
         * A token in the URL means an auth handshake just completed —
         * always process it. The profile in sessionStorage may belong to
         * an EXPIRED session (re-auth lands back here with ?t=&id= while
         * the old profile is still stored); gating the handshake on the
         * profile alone discards the fresh token, so the next check_auth
         * 401s and immediately logs the new session out again.
         */
        const handshake_token = helperModule.get_parameter_by_name('t');

        if ((handshake_token !== null && handshake_token !== '') || authModule.check_user_auth_data() === false) {
            await authModule.get_auth_user_data();
        }

        await exhibitsModule.init();
        history.replaceState({}, '', APP_PATH + '/exhibits');
        history.pushState({}, '', APP_PATH + '/exhibits');
    };

    return obj;

}());

(async () => {
    await homeModule.init();
})();
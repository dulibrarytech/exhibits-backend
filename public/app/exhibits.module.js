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

const exhibitsModule = (function () {

    'use strict';

    const api = configModule.getApi();
    const endpoints = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /**
     * Example
     */
    const addExhibit = function () {

        domModule.hide('#exhibit-form');
        domModule.html('#message', '<div class="alert alert-info">Saving Exhibit...</div>');

        let exhibit = domModule.serialize('#exhibit-form');
        let arr = exhibit.split('&');
        let obj = {};

        for (let i=0;i<arr.length;i++) {
            let propsVal = decodeURIComponent(arr[i]).split('=');
            obj[propsVal[0]] = propsVal[1];
        }

        let token = authModule.getUserToken();
        let url = api + endpoints.exhibits.exhibit_records.endpoint,
            request = new Request(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                },
                body: JSON.stringify(obj),
                mode: 'cors'
            });

        const callback = function (response) {

            if (response.status === 201) {

                response.json().then(function (data) {
                    domModule.html('#message', '<div class="alert alert-success">Exhibit created ( <a href="' + configModule.getApi() + '/dashboard/items/?uuid=' + DOMPurify.sanitize(data.uuid) + '">' + DOMPurify.sanitize(data.uuid) + '</a> )');
                    domModule.hide('#exhibits-form');
                });

                return false;

            } else if (response.status === 401) {

                response.json().then(function (response) {

                    helperModule.renderError('Error: (HTTP status ' + response.status + '). Your session has expired.  You will be redirected to the login page momentarily.');

                    setTimeout(function () {
                        window.location.replace('/login');
                    }, 4000);
                });

            } else {
                helperModule.renderError('Error: (HTTP status ' + response.status + ').  Unable to add exhibit.');
            }
        };

        httpModule.req(request, callback);
    };

    return obj;

}());
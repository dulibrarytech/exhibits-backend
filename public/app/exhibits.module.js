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

    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    /**
     * Gets all exhibits
     */
    async function get_exhibits() {

        try {

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                // domModule.html('#message', null);
                return response.data.data;
            }

        } catch (error) {
            console.log('ERROR: ', error.message);
            // TODO: authModule.session_expired();
        }
    }

    /**
     * Displays exhibits
     */
    async function display_exhibits() {

        let exhibits = await get_exhibits();
        let exhibit_cards = '';
            exhibit_cards += '<div class="row">';

        for (let i=0;i<exhibits.length;i++) {

            console.log(exhibits[i]);

            let title = helperModule.unescape(exhibits[i].title);
            let description = helperModule.unescape(exhibits[i].description);

            exhibit_cards += `
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">
                            <strong class="card-title mb-3">${title}</strong>
                        </div>
                        <div class="card-body">
                            <div class="mx-auto d-block">
                                <img class="rounded-circle mx-auto d-block" src="../../images/thumbnail.jpg"
                                     alt="exhibit thumbnail here?">
                                <div class="location text-sm-center"><i class=""></i> ${description}</div>
                            </div>
                            <hr>
                            <div class="card-text text-sm-center">
                                <a href="#" title="Add Items"><i class="fa fa-plus pr-1"></i> </a>&nbsp;
                                <a href="#" title="Edit Items"><i class="fa fa-edit pr-1"></i> </a>&nbsp;
                                <a href="#" title="Delete items"><i class="fa fa-minus pr-1"></i> </a>
                            </div>
                        </div>
                    </div>
                </div>`;

            if (i % 3 === 2) {
                exhibit_cards += '</div>';
                exhibit_cards += '<div class="row">';
            }
        }

        document.querySelector('#exhibits').innerHTML = exhibit_cards;
    }

    /**
     * Example
     */
    function create_exhibit() {

        domModule.hide('#exhibit-form');
        domModule.html('#message', '<div class="alert alert-info">Saving Exhibit...</div>');

        let exhibit = domModule.serialize('#exhibit-form');
        let arr = exhibit.split('&');
        let obj = {};

        for (let i = 0; i < arr.length; i++) {
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

    obj.init = async function () {
        await display_exhibits();
    };

    return obj;

}());
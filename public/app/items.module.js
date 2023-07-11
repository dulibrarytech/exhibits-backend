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

const itemsModule = (function () {

    'use strict';

    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};

    async function get_items(uuid) {

        console.log(uuid);

        /// let test = EXHIBITS_ENDPOINTS.exhibits.item_records.endpointtest.replace(':exhibit_id', uuid);

        // console.log('test ', test.replace(':exhibit_id', uuid));
        try {

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.item_records.endpoint.replace(':exhibit_id', uuid),
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                console.log(response.data.data);
                return response.data.data;
            }

        } catch (error) {
            console.log('ERROR: ', error.message);
        }
    }

    async function display_items() {

        const uuid = helperModule.get_parameter_by_name('uuid');
        let items = await get_items(uuid);
        console.log(items);
        return false;

        let exhibit_cards = '';
        exhibit_cards += '<div class="row">';

        for (let i=0;i<exhibits.length;i++) {

            console.log(exhibits[i]);

            let uuid = exhibits[i].uuid;
            let title = helperModule.unescape(exhibits[i].title);
            let description = helperModule.unescape(exhibits[i].description);

            exhibit_cards += `
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">
                            <strong class="card-title mb-3"><a href="/dashboard/items?uuid=${uuid}">${title}</a></strong>
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

    obj.init = async function () {
        await display_items();
    };

    return obj;

}());
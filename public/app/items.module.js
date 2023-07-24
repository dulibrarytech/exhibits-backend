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
                return response.data.data;
            }

        } catch (error) {
            console.log('ERROR: ', error.message);
        }
    }

    async function display_items() {

        const uuid = helperModule.get_parameter_by_name('uuid');
        let items = await get_items(uuid);
        let cards = '';

        cards += '<tbody>';
        cards += `<thead>
        <tr>
            <th>Order</th>
            <th>Item</th>
            <th>Status</th>
            <th>Actions</th>
        </tr>
        </thead>`;

        for (let i = 0; i < items.length; i++) {

            console.log(items[i]);
            let uuid = items[i].uuid;
            let type = items[i].type;
            let order = items[i].order;
            let is_published = items[i].is_published;
            let status;

            if (is_published === 1) {
                status = `<span title="published"><i class="fa fa-cloud"></i></span>`;
            } else if (is_published === 0) {
                status = `<span title="suppressed"><i class="fa fa-cloud-upload"></i></span>`;
            }

            cards += '<tr>';
            cards += `<td style="width: 5%">${order}</td>`;

            if (items[i].type === 'item') {

                let url = items[i].url;
                let title = helperModule.unescape(items[i].title);
                let description = helperModule.unescape(items[i].description);
                let date = items[i].date;

                cards += `<td style="width: 35%">
                    <p><button class="btn btn-primary"><small>${type}</small></button></p>
                    <p>${url}</p>
                    <p>${title}</p>
                    <p><small>${description}</small></p>
                    <p><small>${date}</small></p>
                    </td>`;

            } else if (items[i].type === 'heading') {

                let text = helperModule.unescape(items[i].text);
                let subtext = helperModule.unescape(items[i].subtext);

                cards += `<td style="width: 35%">
                    <p><button class="btn btn-primary"><small>${type}</small></button></p>
                    <p>${text}</p>
                    <p><small>${subtext}</small></p>
                    </td>`;
            }

            cards += `<td style="width: 5%">${status}</td>`;
            cards += `<td style="width: 10%"><a href="#" class="btn btn-default">Edit</a></td>`;
            cards += '</tr>';
        }

        cards += '</tbody>';
        document.querySelector('#items').innerHTML = cards;
        // $('#items').DataTable();

        /*
        console.log('rows: ', rows);
        new DataTable('#items', {
            columns: [
                { title: 'Type' },
                { title: 'Item' },
                { title: 'Description' }
            ],
            rows: rows
        });

         */

        /*
        setTimeout(() => {
            new DataTable('#items', '');
        }, 1000);
         */
    }

    obj.init = async function () {
        await display_items();
    };

    return obj;

}());
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

            if (token === false) {
                window.location.replace('/dashboard/login');
                return false;
            }

            if (EXHIBITS_ENDPOINTS === null) {
                setTimeout(() => {
                    location.reload();
                    return false;
                }, 0);
            }

            let response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });
            console.log(response);
            if (response !== undefined && response.status === 200) {
                return response.data.data;
            }

        } catch (error) {
            console.log('ERROR: ', error.message);
        }
    }

    /**
     *
     * @return {Promise<boolean>}
     */
    obj.display_exhibits = async function () {

        const exhibits = await get_exhibits();
        console.log('exhibits: ', exhibits);
        let exhibit_data = '';

        if (exhibits.length === 0) {
            document.querySelector('#exhibits').innerHTML = '<div class="alert alert-info" role="alert">No Exhibits found.</div>';
            return false;
        }

        for (let i = 0; i < exhibits.length; i++) {

            let uuid = exhibits[i].uuid;
            let is_published = exhibits[i].is_published;
            let status;

            if (is_published === 1) {
                status = `<span title="published"><i class="fa fa-cloud"></i><br>Published</span>`;
            } else if (is_published === 0) {
                status = `<span title="suppressed"><i class="fa fa-cloud-upload"></i><br>Suppressed</span>`;
            }

            exhibit_data += '<tr>';

            let thumbnail = exhibits[i].thumbnail_image;
            let title = helperModule.unescape(exhibits[i].title);
            // let description = helperModule.unescape(items[i].description);
            // <p>${thumbnail}</p>
            // class="card-title mb-3"

            exhibit_data += `<td style="width: 35%">
                    <p><strong><a href="/dashboard/items?uuid=${uuid}">${title}</a></strong></p>
                    <p><img src="${thumbnail}" height="100" width="100"></p>
                    <p><a class="btn btn-outline-secondary" href="/preview" title="preview"><i class="fa fa-eye"></i>&nbsp;Preview</a></p>
                    </td>`;

            exhibit_data += `<td style="width: 5%">${status}</td>`;
            exhibit_data += `<td style="width: 10%">
                                <div class="card-text text-sm-center">
                                    <a href="#" title="Edit"><i class="fa fa-edit pr-1"></i> </a>&nbsp;
                                    <a href="#" title="Delete"><i class="fa fa-minus pr-1"></i> </a>&nbsp;
                                    <a href="#" title="Add Items"><i class="fa fa-plus pr-1"></i> </a>
                                </div>
                            </td>`;
            exhibit_data += '</tr>';
        }

        document.querySelector('#exhibits-data').innerHTML = exhibit_data;
        let table = new DataTable('#exhibits');
        setTimeout(() => {
            document.querySelector('#exhibit-card').style.visibility = 'visible';
            document.querySelector('#message').innerHTML = '';
        }, 1000);
    };

    /**
     * Gets exhibit title
     * @param uuid
     * @return {Promise<*>}
     */
    obj.get_exhibit_title = async function (uuid) {

        try {

            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.get.endpoint.replace(':exhibit_id', uuid),
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                return helperModule.strip_html(helperModule.unescape(response.data.data[0].title));
            }

        } catch (error) {
            console.log('ERROR: ', error.message);
        }
    };

    obj.set_preview_link = function() {

        let uuid = helperModule.get_parameter_by_name('uuid');
        let preview_link = `/preview?uuid=${uuid}`;
        let preview_menu_fragment = `
                <li>
                    <a href="#" onClick="window.open('${preview_link}', '_blank', 'location=yes,scrollbars=yes,status=yes');">
                        <i class=" menu-icon fa fa-eye"></i>Preview
                    </a>
                </li>`;

        document.querySelector('#preview-link').innerHTML = preview_menu_fragment;
    };

    obj.init = async function () {
        await exhibitsModule.display_exhibits();
    };

    return obj;

}());

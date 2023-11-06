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
    let link;
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
        let exhibit_data = '';

        if (exhibits.length === 0) {
            document.querySelector('#message').innerHTML = '<div class="alert alert-info" role="alert">No Exhibits found.</div>';
            return false;
        }

        for (let i = 0; i < exhibits.length; i++) {

            let uuid = exhibits[i].uuid;
            let is_published = exhibits[i].is_published;
            let preview_link = `/preview?uuid=${uuid}`;
            let exhibit_items = `<a href="/dashboard/items?uuid=${exhibits[i].uuid}" title="Exhibit items"><i class="fa fa-search pr-1"></i></a>&nbsp;`;
            let thumbnail = '';
            let status;
            let title;

            if (is_published === 1) {
                status = `<a href="#" class="suppress-exhibit"><span title="published"><i class="fa fa-cloud"></i><br>Published</span></a>`;
            } else if (is_published === 0) {
                status = `<a href="#" id="${exhibits[i].uuid}" class="publish-exhibit"><span title="suppressed"><i class="fa fa-cloud-upload"></i><br>Suppressed</span></a>`;
            }

            if (exhibits[i].thumbnail.length > 0) {
                thumbnail = `/api/v1/exhibits/${uuid}/media/${exhibits[i].thumbnail}`;
                exhibit_data = `<p><img src="${thumbnail}" height="100" width="100"></p>`;
            }

            title = helperModule.unescape(exhibits[i].title);
            exhibit_data += '<tr>';
            exhibit_data += `<td style="width: 35%">
                    <p><strong><a href="/dashboard/items?uuid=${uuid}">${title}</a></strong></p>
                    ${thumbnail}
                    <p id="preview-link">
                        <a class="btn btn-outline-secondary" href="#" onclick="exhibitsModule.open_preview('${preview_link}');">
                            <i class=" menu-icon fa fa-eye"></i> Preview
                        </a>
                    </p>
                    </td>`;

            exhibit_data += `<td style="width: 5%;text-align: center"><small>${status}</small></td>`;
            exhibit_data += `<td style="width: 10%">
                                <div class="card-text text-sm-center">
                                    ${exhibit_items}
                                    <a href="#" title="Edit"><i class="fa fa-edit pr-1"></i> </a>&nbsp;
                                    <a href="#" title="Add Items"><i class="fa fa-plus pr-1"></i> </a>
                                    &nbsp;
                                    <a href="#" title="Delete"><i class="fa fa-trash pr-1"></i> </a>&nbsp;
                                </div>
                            </td>`;
            exhibit_data += '</tr>';
        }

        document.querySelector('#exhibits-data').innerHTML = exhibit_data;
        bind_publish_exhibit_event();

        let table = new DataTable('#exhibits');
        setTimeout(() => {
            document.querySelector('#exhibit-card').style.visibility = 'visible';
            document.querySelector('#message').innerHTML = '';
        }, 1000);
    };

    /**
     * Gets exhibit title
     * @param uuid
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

    obj.set_preview_link = function () {

        let uuid = helperModule.get_parameter_by_name('uuid');
        let preview_link = `/preview?uuid=${uuid}`;
        let preview_menu_fragment = `
                    <a href="#" onclick="exhibitsModule.open_preview('${preview_link}')">
                        <i class=" menu-icon fa fa-eye"></i>Preview
                    </a>`;

        document.querySelector('#preview-link').innerHTML = preview_menu_fragment;
    };

    obj.open_preview = function (preview_link) {

        if (link !== undefined) {
            exhibitsModule.close_preview();
        }

        link = window.open(preview_link, '_blank', 'location=yes,scrollbars=yes,status=yes');
    };

    obj.close_preview = function () {
        link.close();
    };

    function publish_exhibit(uuid) {
        console.log('Publishing: ', uuid);

    }

    function bind_publish_exhibit_event() {

        const exhibit_links = Array.from(document.getElementsByClassName('publish-exhibit'));

        exhibit_links.forEach(exhibit_link => {
            exhibit_link.addEventListener('click', function handleClick(event) {
                const uuid = exhibit_link.getAttribute('id');
                publish_exhibit(uuid);
            });
        });
    }

    obj.init = async function () {
        await exhibitsModule.display_exhibits();
    };

    return obj;

}());

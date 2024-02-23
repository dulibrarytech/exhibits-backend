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

    const APP_PATH = '/exhibits-backend'
    let obj = {};
    let link;

    /**
     * Gets all exhibits
     */
    async function get_exhibits() {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const token = authModule.get_user_token();

            if (token === false || EXHIBITS_ENDPOINTS === null) {

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/dashboard/login');
                }, 3000);

                return false;
            }

            let response = await httpModule.req({
                method: 'GET',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoint,
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

    /**
     * Display exhibits
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
            let preview_link = `${APP_PATH}/preview?uuid=${uuid}`;
            let exhibit_items = `<a href="${APP_PATH}/dashboard/items?uuid=${exhibits[i].uuid}" title="Exhibit items"><i class="fa fa-search pr-1"></i></a>&nbsp;`;
            let thumbnail_url = '';
            let thumbnail_fragment = '';
            let status;
            let title;
            let exhibit_edit = '';
            let trash = '';

            if (is_published === 1) {
                status = `<a href="#" id="${exhibits[i].uuid}" class="suppress-exhibit"><span id="suppress" title="published"><i class="fa fa-cloud" style="color: green"></i><br>Published</span></a>`;
            } else if (is_published === 0) {
                status = `<a href="#" id="${exhibits[i].uuid}" class="publish-exhibit"><span id="publish" title="suppressed"><i class="fa fa-cloud-upload" style="color: darkred"></i><br>Suppressed</span></a>`;
                exhibit_edit = `<a href="${APP_PATH}/dashboard/exhibits/exhibit/edit?uuid=${uuid}" title="Edit"><i class="fa fa-edit pr-1"></i> </a>`;
                trash = `<a href="#" title="Delete"><i class="fa fa-trash pr-1"></i> </a>`;
            }

            if (exhibits[i].thumbnail.length > 0) {
                thumbnail_url = `${APP_PATH}/api/v1/exhibits/${uuid}/media/${exhibits[i].thumbnail}`;
                thumbnail_fragment = `<p><img src="${thumbnail_url}" height="100" width="100"></p>`;
            }

            title = helperModule.unescape(exhibits[i].title);
            exhibit_data += '<tr>';
            exhibit_data += `<td style="width: 35%">
                    <p><strong><a href="${APP_PATH}/dashboard/items?uuid=${uuid}">${title}</a></strong></p>
                    ${thumbnail_fragment}
                    <div class="d-flex justify-content-between align-items-center">
                                <div class="btn-group">
                                     <span id="preview-link">
                                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="exhibitsModule.open_preview('${preview_link}');">
                                        <i class=" menu-icon fa fa-eye"></i>
                                        <small>Preview</small>
                                    </button>
                                    </span>
                                </div>
                            </div>
                    </td>`;

            exhibit_data += `<td style="width: 5%;text-align: center"><small>${status}</small></td>`;
            exhibit_data += `<td style="width: 10%">
                                <div class="card-text text-sm-center">
                                    ${exhibit_items}
                                    ${exhibit_edit}
                                    &nbsp;
                                    <a href="${APP_PATH}/dashboard/items/standard?uuid=${uuid}" title="Add Items"><i class="fa fa-plus pr-1"></i> </a>
                                    &nbsp;
                                    ${trash}
                                </div>
                            </td>`;
            exhibit_data += '</tr>';
        }

        document.querySelector('#exhibits-data').innerHTML = exhibit_data;
        bind_publish_exhibit_events();
        bind_suppress_exhibit_events();

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

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const token = authModule.get_user_token();
            const response = await httpModule.req({
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

    /**
     * Sets preview link
     */
    obj.set_preview_link = function () {

        let uuid = helperModule.get_parameter_by_name('uuid');
        let preview_link = `${APP_PATH}/preview?uuid=${uuid}`;
        let preview_menu_fragment = `
                    <a href="#" onclick="exhibitsModule.open_preview('${preview_link}')">
                        <i class=" menu-icon fa fa-eye"></i>Preview
                    </a>`;

        document.querySelector('#preview-link').innerHTML = preview_menu_fragment;
    };

    /**
     * Opens a window for the preview
     * @param preview_link
     */
    obj.open_preview = function (preview_link) {

        if (link !== undefined) {
            exhibitsModule.close_preview();
        }

        link = window.open(preview_link, '_blank', 'location=yes,scrollbars=yes,status=yes');
    };

    /**
     * Closes preview window
     */
    obj.close_preview = function () {
        link.close();
    };

    /**
     * Publishes exhibit
     * @param uuid
     */
    async function publish_exhibit(uuid) {

        const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
        const token = authModule.get_user_token();
        const response = await httpModule.req({
            method: 'POST',
            url: EXHIBITS_ENDPOINTS.exhibits.exhibit_publish.post.endpoint.replace(':exhibit_id', uuid),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            }
        });

        if (response.status === 200) {

            setTimeout(() => {
                let elem = document.getElementById(uuid);
                document.getElementById(uuid).classList.remove('publish-exhibit');
                document.getElementById(uuid).classList.add('suppress-exhibit');
                document.getElementById(uuid).replaceWith(elem.cloneNode(true));
                document.getElementById(uuid).innerHTML = '<span id="suppress" title="published"><i class="fa fa-cloud" style="color: green"></i><br>Published</span>';
                document.getElementById(uuid).addEventListener('click', async () => {
                    const uuid = elem.getAttribute('id');
                    await suppress_exhibit(uuid);
                }, false);
            }, 0);
        }
    }

    /**
     * Suppresses exhibit
     * @param uuid
     */
    async function suppress_exhibit(uuid) {

        const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
        const token = authModule.get_user_token();
        const response = await httpModule.req({
            method: 'POST',
            url: EXHIBITS_ENDPOINTS.exhibits.exhibit_suppress.post.endpoint.replace(':exhibit_id', uuid),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': token
            }
        });

        if (response.status === 200) {

            setTimeout(() => {
                let elem = document.getElementById(uuid);
                document.getElementById(uuid).classList.remove('suppress-exhibit');
                document.getElementById(uuid).classList.add('publish-exhibit');
                document.getElementById(uuid).replaceWith(elem.cloneNode(true));
                document.getElementById(uuid).innerHTML = '<span id="publish" title="suppressed"><i class="fa fa-cloud-upload" style="color: darkred"></i><br>Suppressed</span>';
                document.getElementById(uuid).addEventListener('click', async (event) => {
                    const uuid = elem.getAttribute('id');
                    await publish_exhibit(uuid);
                }, false);
            }, 0);
        }
    }

    /**
     * Binds publish click behavior to exhibit links
     */
    function bind_publish_exhibit_events() {

        const exhibit_links = Array.from(document.getElementsByClassName('publish-exhibit'));

        exhibit_links.forEach(exhibit_link => {
            exhibit_link.addEventListener('click', async (event) => {
                const uuid = exhibit_link.getAttribute('id');
                await publish_exhibit(uuid);
            });
        });
    }

    /**
     * Binds suppress click behavior to exhibit links
     */
    function bind_suppress_exhibit_events() {

        const exhibit_links = Array.from(document.getElementsByClassName('suppress-exhibit'));

        exhibit_links.forEach(exhibit_link => {
            exhibit_link.addEventListener('click', async () => {
                const uuid = exhibit_link.getAttribute('id');
                await suppress_exhibit(uuid);
            });
        });
    }

    /**
     * Runs functions when page loads
     */
    obj.init = async function () {
        await exhibitsModule.display_exhibits();
    };

    return obj;

}());

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

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    let obj = {};
    let link;

    async function get_exhibits() {

        try {

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            const token = authModule.get_user_token();
            const response = await httpModule.req({
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
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.display_exhibits = async function () {

        const exhibits = await get_exhibits();
        let exhibit_data = '';

        if (exhibits === false) {
            document.querySelector('#exhibit-card').innerHTML = '';
            return false;
        }

        if (exhibits.length === 0) {
            document.querySelector('.card').innerHTML = '';
            document.querySelector('#message').innerHTML = '<div class="alert alert-info" role="alert">No Exhibits found.</div>';
            return false;
        }

        for (let i = 0; i < exhibits.length; i++) {

            let uuid = exhibits[i].uuid;
            let is_published = exhibits[i].is_published;
            let preview_link = `${APP_PATH}/preview?uuid=${uuid}`;
            let exhibit_items = `<a href="${APP_PATH}/items?exhibit_id=${uuid}" title="View Exhibit Items"><i class="fa fa-list pr-1"></i></a>&nbsp;`;
            let order = `${exhibits[i].order}`;
            let thumbnail_url = '';
            let thumbnail_fragment = '';
            let status;
            let title;
            let exhibit_edit = '';
            let trash = '';

            if (is_published === 1) {
                order = `<td style="width: 4%" class="item-order" aria-label="exhibit-order"><span style="padding-left: 4px;">${order}</span></td>`;
                status = `<a href="#" id="${uuid}" class="suppress-exhibit" aria-label="exhibit-status"><span id="suppress" title="published"><i class="fa fa-cloud" style="color: green"></i><br>Published</span></a>`;
                exhibit_edit = `<i title="Can only edit if unpublished" style="color: #d3d3d3" class="fa fa-edit pr-1" aria-label="edit-exhibit"></i>`;
                trash = `<i title="Can only delete if unpublished" style="color: #d3d3d3" class="fa fa-trash pr-1" aria-label="delete-exhibit"></i>`;
            } else if (is_published === 0) {
                order = `<td style="width: 4%;" class="grabbable item-order" aria-label="exhibit-order"><i class="fa fa-reorder"></i><span style="padding-left: 4px;">${order}</span></td>`;
                status = `<a href="#" id="${uuid}" class="publish-exhibit" aria-label="exhibit-status"><span id="publish" title="suppressed"><i class="fa fa-cloud-upload" style="color: darkred"></i><br>Unpublished</span></a>`;
                exhibit_edit = `<a href="${APP_PATH}/exhibits/exhibit/edit?exhibit_id=${uuid}" title="Edit" aria-label="edit-exhibit"><i class="fa fa-edit pr-1"></i> </a>`;
                trash = `<a href="${APP_PATH}/exhibits/exhibit/delete?exhibit_id=${uuid}" title="Delete exhibit" aria-label="delete-exhibit"><i class="fa fa-trash pr-1"></i></a>`;
            }

            if (exhibits[i].thumbnail.length > 0) {
                thumbnail_url = `${APP_PATH}/api/v1/exhibits/${uuid}/media/${exhibits[i].thumbnail}`;
                thumbnail_fragment = `<p><img src="${thumbnail_url}" alt="${uuid}-thumbnail" height="100" width="100"></p>`;
            } else {
                thumbnail_url = `${APP_PATH}/static/images/image-tn.png`;
                thumbnail_fragment = `<p><img src="${thumbnail_url}" alt="${uuid}-thumbnail" height="100" width="100"></p>`;
            }

            title = helperModule.strip_html(helperModule.unescape(exhibits[i].title));

            exhibit_data += `<tr id="${uuid}">`;
            exhibit_data += order;
            exhibit_data += `<td style="width: 35%">
                    <p><strong>${title}</strong></p>
                    ${thumbnail_fragment}
                    <div class="d-flex justify-content-between align-items-center">
                                <div class="btn-group">
                                     <span id="preview-link">
                                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="exhibitsModule.open_preview('${preview_link}');">
                                        <i class=" menu-icon fa fa-eye"></i>
                                        <small>Preview</small>
                                    </button>
                                    </span>
                                    &nbsp;&nbsp;
                                    <span id="share-link">
                                    <button type="button" class="btn btn-sm btn-outline-secondary" data-toggle="modal" data-target=".shared-url-modal" onclick="exhibitsModule.create_shared_preview_url('${uuid}');">
                                        <i class="fa fa-share-alt"></i>
                                        <small>Share</small>
                                    </button>
                                    </span>
                                </div>
                            </div>
                    </td>`;

            exhibit_data += `<td style="width: 5%;text-align: center"><small>${status}</small></td>`;
            exhibit_data += `<td style="width: 10%">
                                <div class="card-text text-sm-center">
                                    ${exhibit_items}&nbsp;
                                    <a href="${APP_PATH}/items/standard?exhibit_id=${uuid}" title="Add Items" aria-label="add-items"><i class="fa fa-plus pr-1"></i> </a>
                                    &nbsp;
                                    ${exhibit_edit}
                                    &nbsp;
                                    ${trash}
                                </div>
                            </td>`;
            exhibit_data += '</tr>';
        }

        document.querySelector('#exhibits-data').innerHTML = exhibit_data;

        const EXHIBIT_LIST = new DataTable('#exhibits', {
            paging: true,
            rowReorder: true
        });

        EXHIBIT_LIST.on('row-reordered', async (e, reordered_exhibits) => {
            await helperModule.reorder_exhibits(e, reordered_exhibits);
        });

        bind_publish_exhibit_events();
        bind_suppress_exhibit_events();
    };

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
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    obj.set_exhibit_title = async function (uuid) {
        let title = await exhibitsModule.get_exhibit_title(uuid);
        document.querySelector('#exhibit-title').innerHTML = `${title}`;
        return false;
    };

    obj.open_preview = function (preview_link) {

        scrollTo(0, 0);
        const token = authModule.get_user_token();

        if (link !== undefined) {
            exhibitsModule.close_preview();
        }

        document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info-circle"></i> Building Exhibit Preview...</div>`;

        setTimeout(() => {
            link = window.open(preview_link + '&t=' + token, '_blank', 'location=yes,scrollbars=yes,status=yes');
            document.querySelector('#message').innerHTML = '';
        }, 900);
    };

    obj.close_preview = function () {
        link.close();
    };

    obj.delete_exhibit = function () {

        try {

            (async function () {

                document.querySelector('#delete-message').innerHTML = 'Deleting exhibit...';
                const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
                const uuid = helperModule.get_parameter_by_name('exhibit_id');
                const token = authModule.get_user_token();
                const response = await httpModule.req({
                    method: 'DELETE',
                    url: EXHIBITS_ENDPOINTS.exhibits.exhibit_records.endpoints.delete.endpoint.replace(':exhibit_id', uuid),
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                });

                if (response !== undefined && response.status === 204) {

                    setTimeout(() => {
                        window.location.replace(APP_PATH + '/exhibits');
                    }, 900);

                } else {
                    document.querySelector('#exhibit-no-delete').innerHTML = `<i class="fa fa-exclamation"></i> ${response.data.message}`;
                }

            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }

        return false;
    };

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

            scrollTo(0, 0);
            document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-check"></i> Exhibit published</div>`;

            setTimeout(() => {
                location.reload();
            }, 900);

            /*
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

             */
        }

        if (response.status === 204) {
            scrollTo(0, 0);
            document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-warning"></i> Exhibit must contain at least one item to publish</div>`;

            setTimeout(() => {
                document.querySelector('#message').innerHTML = '';
            }, 5000);
        }
    }

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

            scrollTo(0, 0);
            document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-check"></i> Exhibit suppressed</div>`;

            setTimeout(() => {
                location.reload();
            }, 900);

            /*
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

             */
        }

        if (response.status === 204) {
            scrollTo(0, 0);
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to suppress exhibit</div>`;

            setTimeout(() => {
                document.querySelector('#message').innerHTML = '';
            }, 5000);
        }
    }

    function bind_publish_exhibit_events() {

        try {

            const exhibit_links = Array.from(document.getElementsByClassName('publish-exhibit'));

            exhibit_links.forEach(exhibit_link => {
                exhibit_link.addEventListener('click', async (event) => {
                    const uuid = exhibit_link.getAttribute('id');
                    await publish_exhibit(uuid);
                });
            });

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    function bind_suppress_exhibit_events() {

        try {

            const exhibit_links = Array.from(document.getElementsByClassName('suppress-exhibit'));

            exhibit_links.forEach(exhibit_link => {
                exhibit_link.addEventListener('click', async () => {
                    const uuid = exhibit_link.getAttribute('id');
                    await suppress_exhibit(uuid);
                });
            });

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    obj.create_shared_preview_url = function (uuid) {

        (async function () {

            document.querySelector('#shared-url').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Generating Shared URL...</div>`;

            const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
            let token = authModule.get_user_token();
            let response;

            if (token === false) {

                setTimeout(() => {
                    document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Unable to get session token</div>`;
                    authModule.logout();
                }, 1000);

                return false;
            }

            response = await httpModule.req({
                method: 'POST',
                url: EXHIBITS_ENDPOINTS.exhibits.exhibit_shared.get.endpoint + '?uuid=' + uuid,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                document.querySelector('#shared-url-copy').innerText = response.data.shared_url;
                setTimeout(async () => {

                    document.querySelector('#shared-url').innerHTML = `<div class="d-flex align-items-center">
                                                                                    <p>
                                                                                    - Shared URL created.&nbsp;&nbsp; 
                                                                                    <button type="button" class="btn btn-sm btn-primary" onclick="exhibitsModule.copy();">
                                                                                    <i class="fa fa-copy"> Copy</i>
                                                                                    </button>
                                                                                    <br>
                                                                                    - Shared URL expires in 7 days.
                                                                                    </p>
                                                                                </div>`;
                }, 900);
            }

            return false;

        })();
    };

    obj.copy = function () {

        try {

            (async function () {
                let elem = document.querySelector('#shared-url-copy');
                const shared_url = elem.textContent;
                await navigator.clipboard.writeText(shared_url);
                document.querySelector('#copy-message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> URL copied to clipboard!</div>`;

                setTimeout(() => {
                    document.querySelector('#copy-message').innerHTML = '';
                }, 5000);
            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Failed to copy shared URL to clipboard. Error: ${error.message}</div>`;
        }
    }

    obj.init = async function () {

        try {

            const token = authModule.get_user_token();
            await authModule.check_auth(token);

            await exhibitsModule.display_exhibits();
            helperModule.show_form();
            navModule.set_logout_link();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }

    };

    return obj;

}());

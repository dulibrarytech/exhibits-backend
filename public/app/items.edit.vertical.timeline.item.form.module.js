/**

 Copyright 2024 University of Denver

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

const itemsEditTimelineItemFormModule = (function () {

    'use strict';

    const APP_PATH = window.localStorage.getItem('exhibits_app_path');
    const EXHIBITS_ENDPOINTS = endpointsModule.get_exhibits_endpoints();
    let obj = {};
    let rich_text_data = {};

    function set_rich_text_editors() {
        const ids = ['item-title-input',
            'item-description-input',
            'item-text-input'];

        ids.forEach((id) => {
            rich_text_data[id] = helperModule.set_rich_text_editor(id);
        });
    }

    async function get_timeline_item_record () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');
            const item_id = helperModule.get_parameter_by_name('item_id');
            const token = authModule.get_user_token();
            let etmp = EXHIBITS_ENDPOINTS.exhibits.timeline_item_record.get.endpoint.replace(':exhibit_id', exhibit_id);
            let itmp = etmp.replace(':timeline_id', timeline_id);
            let endpoint = itmp.replace(':item_id', item_id);

            if (token === false) {

                document.querySelector('#message').innerHTML = 'ERROR: Unable to get API endpoints';

                setTimeout(() => {
                    window.location.replace(APP_PATH + '/exhibits-dashboard/auth');
                }, 1000);

                return false;
            }

            let response = await httpModule.req({
                method: 'GET',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 200) {
                return response.data.data[0];
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    async function display_edit_record () {

        let record = await get_timeline_item_record();
        let thumbnail_fragment = '';
        let thumbnail_url = '';

        // item data
        rich_text_data['item-title-input'] = helperModule.set_rich_text_editor('item-title-input');
        rich_text_data['item-title-input'].setHTMLCode(helperModule.unescape(record.title));
        rich_text_data['item-description-input'] = helperModule.set_rich_text_editor('item-description-input');
        rich_text_data['item-description-input'].setHTMLCode(helperModule.unescape(record.description));
        rich_text_data['item-text-input'] = helperModule.set_rich_text_editor('item-text-input');
        rich_text_data['item-text-input'].setHTMLCode(helperModule.unescape(record.text));
        document.querySelector('#item-caption-input').value = record.caption;

        let date_arr = record.date.split('T');
        let date = date_arr.shift();
        document.querySelector('#item-date-input').value = date;

        if (record.media.length > 0) {

            if (record.is_repo_item === 0 && record.is_kaltura_item === 0) {

                if (record.mime_type.indexOf('image') !== -1) {
                    thumbnail_url = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', record.is_member_of_exhibit).replace(':media', record.thumbnail);
                    thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
                } else if (record.mime_type.indexOf('video') !== -1) {
                    thumbnail_url = '/exhibits-dashboard/static/images/video-tn.png';
                    thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
                } else if (record.mime_type.indexOf('audio') !== -1) {
                    thumbnail_url = '/exhibits-dashboard/static/images/audio-tn.png';
                    thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
                } else if (record.mime_type.indexOf('pdf') !== -1) {
                    thumbnail_url = '/exhibits-dashboard/static/images/pdf-tn.png';
                    thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
                    document.querySelector('#toggle-open-to-page').style.visibility = 'visible';
                } else {
                    console.log('Unable to Determine Type');
                }

                document.querySelector('#item-media-trash').style.display = 'inline';
                document.querySelector('#item-media-filename-display').innerHTML = `<span style="font-size: 11px">${record.media}</span>`;
            }

            document.querySelector('#item-type').value = record.item_type;

            if (record.is_repo_item === 1) {

                document.getElementById('upload-media-tab').classList.remove('active');
                document.getElementById('import-repo-media-tab').classList.add('active');
                document.getElementById('upload-media').classList.remove('active');
                document.getElementById('upload-media').classList.remove('show');
                document.getElementById('import-repo-media').classList.add('show');
                document.getElementById('import-repo-media').classList.add('active');
                document.getElementById('upload-media-tab').setAttribute('aria-selected', 'false');
                document.getElementById('import-repo-media-tab').setAttribute('aria-selected', 'true');
                document.querySelector('#repo-uuid').value = record.media;
                await helperModule.get_repo_item_data();
            }

            if (record.is_kaltura_item === 1) {

                document.getElementById('upload-media-tab').classList.remove('active');
                document.getElementById('import-audio-video-tab').classList.add('active');
                document.getElementById('upload-media').classList.remove('active');
                document.getElementById('upload-media').classList.remove('show');
                document.getElementById('import-audio-video').classList.add('show');
                document.getElementById('import-audio-video').classList.add('active');
                document.getElementById('upload-media-tab').setAttribute('aria-selected', 'false');
                document.getElementById('import-audio-video-tab').setAttribute('aria-selected', 'true');
                document.querySelector('#audio-video').value = record.media;

                let item_types = document.getElementsByName('item_type');

                for (let j = 0; j < item_types.length; j++) {
                    if (item_types[j].value === record.item_type) {
                        document.querySelector('#' + item_types[j].id).checked = true;
                    }
                }

                document.querySelector('#item-type').value = 'kaltura';
            }

            document.querySelector('#item-mime-type').value = helperModule.unescape(record.mime_type);
            document.querySelector('#item-media-thumbnail-image-display').innerHTML = thumbnail_fragment;
            document.querySelector('#item-media').value = record.media;
            document.querySelector('#item-media-prev').value = record.media;

        }

        if (record.thumbnail.length > 0) {

            thumbnail_url = EXHIBITS_ENDPOINTS.exhibits.exhibit_media.get.endpoint.replace(':exhibit_id', record.is_member_of_exhibit).replace(':media', record.thumbnail);
            thumbnail_fragment = `<p><img src="${thumbnail_url}" height="200" ></p>`;
            document.querySelector('#item-thumbnail-image-display').innerHTML = thumbnail_fragment;
            document.querySelector('#item-thumbnail-filename-display').innerHTML = `<span style="font-size: 11px">${record.thumbnail}</span>`;
            document.querySelector('#item-thumbnail').value = record.thumbnail;
            document.querySelector('#item-thumbnail-image-prev').value = record.thumbnail;
            document.querySelector('#item-thumbnail-trash').style.display = 'inline';
        }

        let layouts = document.getElementsByName('layout');

        for (let j = 0; j < layouts.length; j++) {
            if (layouts[j].value === record.layout) {
                document.querySelector('#' + layouts[j].id).checked = true;
            }
        }

        let media_width = document.getElementsByName('media_width');

        for (let j = 0; j < media_width.length; j++) {
            if (parseInt(media_width[j].value) === parseInt(record.media_width)) {
                document.querySelector('#' + media_width[j].id).checked = true;
            }
        }

        let styles = JSON.parse(record.styles);

        if (Object.keys(styles).length !== 0) {

            if (styles.backgroundColor !== undefined) {
                document.querySelector('#item-background-color').value = styles.backgroundColor;
            } else {
                document.querySelector('#item-background-color').value = '';
            }

            if (styles.color !== undefined) {
                document.querySelector('#item-font-color').value = styles.color;
            } else {
                document.querySelector('#item-font-color').value = '';
            }

            let font_values = document.querySelector('#item-font');

            for (let i=0;i<font_values.length;i++) {
                if (font_values[i].value === styles.fontFamily) {
                    document.querySelector('#item-font').value = styles.fontFamily;
                }
            }

            if (styles.fontSize !== undefined) {
                document.querySelector('#item-font-size').value = styles.fontSize.replace('px', '');
            } else {
                document.querySelector('#item-font-size').value = '';
            }
        }

        return false;
    }

    obj.update_timeline_item_record = async function () {

        try {

            window.scrollTo(0, 0);
            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            const timeline_id = helperModule.get_parameter_by_name('timeline_id');
            const item_id = helperModule.get_parameter_by_name('item_id');

            if (exhibit_id === undefined || timeline_id === undefined || item_id === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-warning" role="alert"><i class="fa fa-info"></i> Unable to update timeline item record.</div>`;
                return false;
            }

            document.querySelector('#message').innerHTML = `<div class="alert alert-info" role="alert"><i class="fa fa-info"></i> Updating timeline item record...</div>`;

            let data = itemsCommonVerticalTimelineItemFormModule.get_common_timeline_item_form_fields(rich_text_data);
            console.log(data);
            return false;

            if (data === undefined) {
                document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> Unable to get form field values</div>`;
                return false;
            } else if (data === false) {
                return false;
            }

            let etmp = EXHIBITS_ENDPOINTS.exhibits.timeline_item_records.put.endpoint.replace(':exhibit_id', exhibit_id);
            let itmp = etmp.replace(':timeline_id', timeline_id);
            let endpoint = itmp.replace(':item_id', item_id);
            let token = authModule.get_user_token();
            let response = await httpModule.req({
                method: 'PUT',
                url: endpoint,
                data: data,
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': token
                }
            });

            if (response !== undefined && response.status === 201) {

                let message = 'Timeline item record updated';
                document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> ${message}</div>`;

                setTimeout(() => {
                    location.reload();
                }, 900);
            }

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    function delete_media () {

        try {

            (async function() {

                const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
                const timeline_id = helperModule.get_parameter_by_name('timeline_id');
                const item_id = helperModule.get_parameter_by_name('item_id');
                let media = document.querySelector('#item-media').value;
                let etmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_media.delete.endpoint.replace(':exhibit_id', exhibit_id);
                let gtmp = etmp.replace(':timeline_id', timeline_id);
                let itmp = gtmp.replace(':item_id', item_id);
                let endpoint = itmp.replace(':media', media);
                let token = authModule.get_user_token();
                let response = await httpModule.req({
                    method: 'DELETE',
                    url: endpoint,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                });

                if (response !== undefined && response.status === 204) {

                    document.querySelector('#item-media').value = '';
                    document.querySelector('#item-media-filename-display').innerHTML = '';
                    document.querySelector('#item-media-trash').style.display = 'none';
                    document.querySelector('#item-media-thumbnail-image-display').innerHTML = '';
                    document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Media deleted</div>`;

                    setTimeout(() => {
                        document.querySelector('#message').innerHTML = '';
                        window.location.reload();
                    }, 900);
                }

            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    }

    function delete_thumbnail_image() {

        try {

            (async function() {

                const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
                const timeline_id = helperModule.get_parameter_by_name('timeline_id');
                const item_id = helperModule.get_parameter_by_name('item_id');
                let thumbnail = document.querySelector('#item-thumbnail').value;
                let etmp = EXHIBITS_ENDPOINTS.exhibits.grid_item_media.delete.endpoint.replace(':exhibit_id', exhibit_id);
                let gtmp = etmp.replace(':timeline_id', timeline_id);
                let itmp = gtmp.replace(':item_id', item_id);
                let endpoint = itmp.replace(':media', thumbnail);
                let token = authModule.get_user_token();
                let response = await httpModule.req({
                    method: 'DELETE',
                    url: endpoint,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-access-token': token
                    }
                });

                if (response !== undefined && response.status === 204) {

                    document.querySelector('#item-thumbnail').value = '';
                    document.querySelector('#item-thumbnail-filename-display').innerHTML = '';
                    document.querySelector('#item-thumbnail-trash').style.display = 'none';
                    document.querySelector('#item-thumbnail-image-display').innerHTML = '';
                    document.querySelector('#message').innerHTML = `<div class="alert alert-success" role="alert"><i class="fa fa-info"></i> Thumbnail deleted</div>`;

                    setTimeout(() => {
                        document.querySelector('#message').innerHTML = '';
                        window.location.reload();
                    }, 900);
                }

            })();

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }

        return false;
    }

    obj.init = async function () {

        try {

            const exhibit_id = helperModule.get_parameter_by_name('exhibit_id');
            exhibitsModule.set_exhibit_title(exhibit_id);
            navModule.set_timeline_item_nav_menu_links(); // TODO: must go back to timeline item list
            helperModule.set_rich_text_editor_config();
            set_rich_text_editors();
            await display_edit_record();
            document.querySelector('#save-item-btn').addEventListener('click', itemsEditTimelineItemFormModule.update_timeline_item_record);

            setTimeout(() => {

                if (document.querySelector('#item-media').value.length === 0) {
                    document.querySelector('#item-media-trash').removeEventListener('click', delete_media);
                    document.querySelector('#item-media-trash').addEventListener('click', itemsCommonVerticalTimelineItemFormModule.delete_media);
                } else if (document.querySelector('#item-media').value !== 0) {
                    document.querySelector('#item-media-trash').removeEventListener('click', itemsCommonVerticalTimelineItemFormModule.delete_media);
                    document.querySelector('#item-media-trash').addEventListener('click', delete_media);
                }

                if (document.querySelector('#item-thumbnail').value.length === 0) {
                    document.querySelector('#item-thumbnail-trash').removeEventListener('click', delete_thumbnail_image);
                    document.querySelector('#item-thumbnail-trash').addEventListener('click', itemsCommonVerticalTimelineItemFormModule.delete_thumbnail_image);
                } else if (document.querySelector('#item-thumbnail').value.length !== 0) {
                    document.querySelector('#item-thumbnail-trash').removeEventListener('click', itemsCommonVerticalTimelineItemFormModule.delete_thumbnail_image);
                    document.querySelector('#item-thumbnail-trash').addEventListener('click', delete_thumbnail_image);
                }

            }, 1000);

        } catch (error) {
            document.querySelector('#message').innerHTML = `<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation"></i> ${error.message}</div>`;
        }
    };

    return obj;

}());
